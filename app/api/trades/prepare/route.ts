/**
 * Trade Preparation API
 *
 * Calculates stake skim and builds a partially-signed transaction for the user.
 * The backend signs with protocol authority, then returns to user for final signature.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { VeritasCuration } from '@/lib/solana/target/types/veritas_curation';
import { PDAHelper } from '@/lib/solana/sdk/transaction-builders';
import { getUsdcMint, getRpcEndpoint, getProgramId } from '@/lib/solana/network-config';
import { calculateStakeSkim } from '@/lib/stake/calculate-skim';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';
import idl from '@/lib/solana/target/idl/veritas_curation.json';

interface PrepareTradeRequest {
  postId: string;
  poolAddress?: string; // Optional - can be derived from postId
  tradeType: 'buy' | 'sell' | 'BUY' | 'SELL';
  side: 'long' | 'short' | 'LONG' | 'SHORT';
  amount?: number; // USDC for buy (micro-USDC), tokens for sell
  usdcAmount?: number; // Alternative field name from hooks
  tokenAmount?: number; // Alternative field name for sells
  walletAddress: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: PrepareTradeRequest = await req.json();

    // Normalize field names and values
    const tradeType = (body.tradeType?.toLowerCase() || '') as 'buy' | 'sell';
    const side = (body.side?.toLowerCase() || '') as 'long' | 'short';

    // Handle different field names for amount
    const amount = body.amount || body.usdcAmount || body.tokenAmount || 0;

    // Validate request
    if (!body.postId || !tradeType || !side || !amount || !body.walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get user from Privy token (if you're using auth)
    // For now, we'll use wallet address to lookup user
    const supabase = getSupabaseServiceRole();

    // Get pool address if not provided
    let poolAddress = body.poolAddress;
    if (!poolAddress) {
      const { data: poolDeployment } = await supabase
        .from('pool_deployments')
        .select('pool_address')
        .eq('post_id', body.postId)
        .single();

      if (!poolDeployment) {
        return NextResponse.json(
          { error: 'Pool not found for this post' },
          { status: 404 }
        );
      }
      poolAddress = poolDeployment.pool_address;
    }

    // Get user ID from wallet address (via agents table)
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('solana_address', body.walletAddress)
      .single();

    if (!agent) {
      return NextResponse.json(
        { error: 'User not found. Please ensure you have a Veritas account.' },
        { status: 404 }
      );
    }

    // Get user record from agent
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('agent_id', agent.id)
      .single();

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please ensure you have a Veritas account.' },
        { status: 404 }
      );
    }

    // Calculate stake skim
    const stakeSkim = await calculateStakeSkim({
      userId: user.id,
      poolAddress: poolAddress,
      tradeType: tradeType,
      tradeAmount: amount,
      walletAddress: body.walletAddress,
      side: side.toUpperCase() as 'LONG' | 'SHORT',
    });

    // Validate sufficient balance
    const connection = new Connection(getRpcEndpoint(), 'confirmed');
    const walletPubkey = new PublicKey(body.walletAddress);
    const usdcMint = getUsdcMint();

    if (tradeType === 'buy') {
      const userUsdcAccount = await getAssociatedTokenAddress(usdcMint, walletPubkey);

      try {
        const usdcBalance = await connection.getTokenAccountBalance(userUsdcAccount);
        const available = parseInt(usdcBalance.value.amount);
        const totalRequired = amount + stakeSkim;

        if (available < totalRequired) {
          return NextResponse.json({
            error: 'Insufficient balance',
            required: totalRequired,
            available: available,
            trade: amount,
            stake: stakeSkim,
          }, { status: 400 });
        }
      } catch (error) {
        return NextResponse.json({
          error: 'USDC account not found. Please fund your wallet with USDC first.',
        }, { status: 400 });
      }
    }

    // Build transaction (already signed by protocol authority inside buildTradeTransaction)
    const transaction = await buildTradeTransaction({
      connection,
      walletAddress: body.walletAddress,
      postId: body.postId,
      poolAddress: poolAddress,
      side: side,
      tradeType: tradeType,
      amount: amount,
      stakeSkim,
    });

    // Serialize and return
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // Calculate expected trade outputs by reading pool state
    const tradeOutputs = await calculateTradeOutputs({
      connection,
      poolAddress: poolAddress,
      side,
      tradeType,
      amount,
    });

    return NextResponse.json({
      transaction: serialized.toString('base64'),
      stakeSkim,
      skimAmount: stakeSkim, // Alternative name used by hooks
      totalRequired: tradeType === 'buy' ? amount + stakeSkim : amount,
      // Expected trade outputs
      expectedTokensOut: tradeOutputs.tokensOut,
      expectedUsdcOut: tradeOutputs.usdcOut,
    });

  } catch (error) {
    console.error('Error preparing trade:', error);
    return NextResponse.json(
      {
        error: 'Failed to prepare trade',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate expected trade outputs by reading pool state and simulating ICBS pricing
 */
async function calculateTradeOutputs(params: {
  connection: Connection;
  poolAddress: string;
  side: 'long' | 'short';
  tradeType: 'buy' | 'sell';
  amount: number;
}): Promise<{ tokensOut: number; usdcOut: number }> {
  try {
    const { fetchPoolData } = await import('@/lib/solana/fetch-pool-data');
    const { simulateTrade } = await import('@/lib/solana/icbs-pricing');

    const poolData = await fetchPoolData(params.poolAddress, params.connection.rpcEndpoint);

    // Simulate the trade
    const result = simulateTrade({
      supplyLong: poolData.supplyLong,
      supplyShort: poolData.supplyShort,
      sqrtLambdaLong: poolData._raw.sqrtLambdaLongX96,
      sqrtLambdaShort: poolData._raw.sqrtLambdaShortX96,
      f: poolData.f,
      betaNum: poolData.betaNum,
      betaDen: poolData.betaDen,
      side: params.side.toUpperCase() as 'LONG' | 'SHORT',
      isBuy: params.tradeType === 'buy',
      amount: params.amount,
    });

    return {
      tokensOut: result.tokensOut,
      usdcOut: result.usdcOut,
    };
  } catch (error) {
    console.warn('[TRADE SIMULATION] Could not simulate trade:', error);
    // Return zeros if simulation fails - trade will still work
    return { tokensOut: 0, usdcOut: 0 };
  }
}

/**
 * Build a trade transaction with stake skim
 */
async function buildTradeTransaction(params: {
  connection: Connection;
  walletAddress: string;
  postId: string;
  poolAddress: string;
  side: 'long' | 'short';
  tradeType: 'buy' | 'sell';
  amount: number;
  stakeSkim: number;
}): Promise<Transaction> {
  const programId = getProgramId();
  const programPubkey = new PublicKey(programId);
  const walletPubkey = new PublicKey(params.walletAddress);
  const poolPubkey = new PublicKey(params.poolAddress);

  // Convert UUID to 32-byte buffer
  const postIdBytes16 = Buffer.from(params.postId.replace(/-/g, ''), 'hex');
  const postIdBytes32 = Buffer.alloc(32);
  postIdBytes16.copy(postIdBytes32, 0);
  const contentId = new PublicKey(postIdBytes32);

  // Create dummy wallet for provider
  const dummyWallet = {
    publicKey: walletPubkey,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };

  // Create provider and program
  const provider = new AnchorProvider(params.connection, dummyWallet as any, {
    commitment: 'confirmed',
  });
  const program = new Program<VeritasCuration>(
    idl as VeritasCuration,
    provider
  );

  // Derive PDAs using ICBS methods
  const pdaHelper = new PDAHelper(programPubkey);
  const [factoryPda] = pdaHelper.getFactoryPda();
  const [poolVaultPda] = pdaHelper.getContentPoolVaultPda(contentId);
  const [custodianPda] = pdaHelper.getGlobalCustodianPda();

  // Get token mint based on side (LONG or SHORT)
  const tokenMintPda = params.side === 'long'
    ? pdaHelper.getLongMintPda(contentId)[0]
    : pdaHelper.getShortMintPda(contentId)[0];

  // Get trader's accounts
  const usdcMint = getUsdcMint();
  const traderUsdcAccount = await getAssociatedTokenAddress(usdcMint, walletPubkey);
  const traderTokenAccount = await getAssociatedTokenAddress(tokenMintPda, walletPubkey);

  // Fetch custodian to get stake vault address
  const custodian = await program.account.veritasCustodian.fetch(custodianPda);
  const stakeVault = custodian.usdcVault;

  // Get pool authority from factory
  const factory = await program.account.poolFactory.fetch(factoryPda);
  const expectedAuthority = factory.poolAuthority;

  // Load protocol authority keypair
  const authorityKeypair = loadProtocolAuthority();

  // Verify the loaded keypair matches the factory's expected authority
  if (!authorityKeypair.publicKey.equals(expectedAuthority)) {
    throw new Error(
      `Protocol authority mismatch. Expected: ${expectedAuthority.toBase58()}, Got: ${authorityKeypair.publicKey.toBase58()}`
    );
  }

  // Build transaction using Anchor's transaction builder (includes signers)
  const tx = await program.methods
    .trade(
      params.side === 'long' ? { long: {} } : { short: {} },
      params.tradeType === 'buy' ? { buy: {} } : { sell: {} },
      new anchor.BN(params.amount),
      new anchor.BN(params.stakeSkim),
      new anchor.BN(0), // minTokensOut - client can calculate slippage
      new anchor.BN(0)  // minUsdcOut - client can calculate slippage
    )
    .accounts({
      pool: poolPubkey,
      factory: factoryPda,
      traderUsdc: traderUsdcAccount,
      vault: poolVaultPda,
      stakeVault: stakeVault,
      traderTokens: traderTokenAccount,
      tokenMint: tokenMintPda,
      usdcMint: usdcMint,
      trader: walletPubkey,
      protocolAuthority: authorityKeypair.publicKey,
      payer: walletPubkey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .preInstructions([
      // Add compute budget
      (await import('@solana/web3.js')).ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 })
    ])
    .transaction();

  // Create token ATA if it doesn't exist (needed for receiving tokens on buy)
  if (params.tradeType === 'buy') {
    const tokenAccountInfo = await params.connection.getAccountInfo(traderTokenAccount);
    if (!tokenAccountInfo) {
      const createAtaIx = createAssociatedTokenAccountInstruction(
        walletPubkey, // payer
        traderTokenAccount, // ata
        walletPubkey, // owner
        tokenMintPda // mint
      );
      // Insert ATA creation before trade instruction but after compute budget
      tx.instructions.splice(1, 0, createAtaIx);
    }
  }

  // Set recent blockhash and fee payer
  const { blockhash } = await params.connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = walletPubkey;

  // Sign with protocol authority
  tx.partialSign(authorityKeypair);

  return tx;
}
