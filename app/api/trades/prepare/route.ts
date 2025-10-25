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
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import idl from '@/lib/solana/target/idl/veritas_curation.json';
import { asMicroUsdc, asAtomic } from '@/lib/units';

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
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔵 [/api/trades/prepare] Trade preparation request received');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const body: PrepareTradeRequest = await req.json();

    console.log('[PREPARE] Raw request body:', body);

    // Normalize field names and values
    const tradeType = (body.tradeType?.toLowerCase() || '') as 'buy' | 'sell';
    const side = (body.side?.toLowerCase() || '') as 'long' | 'short';

    // Handle different field names for amount
    const rawAmount = body.amount || body.usdcAmount || body.tokenAmount || 0;

    // Validate and convert to type-safe units
    let amount: number;
    try {
      if (tradeType === 'buy') {
        // For buys, amount should be micro-USDC (already atomic)
        amount = asMicroUsdc(Math.floor(rawAmount)); // Ensure integer micro-USDC
      } else {
        // For sells, amount should be atomic tokens
        amount = asAtomic(Math.floor(rawAmount)); // Ensure integer atomic tokens
      }
    } catch (unitError) {
      console.error('[PREPARE] ❌ Invalid amount units:', unitError);
      return NextResponse.json(
        { error: `Invalid amount: ${unitError instanceof Error ? unitError.message : 'Unit validation failed'}` },
        { status: 400 }
      );
    }

    console.log('[PREPARE] Normalized parameters:', {
      tradeType,
      side,
      amount,
      rawAmount,
      postId: body.postId,
      walletAddress: body.walletAddress
    });

    // Validate request
    if (!body.postId || !tradeType || !side || !amount || !body.walletAddress) {
      console.error('[PREPARE] ❌ Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('[PREPARE] ✅ Validation passed');

    // Check rate limit (50 trades per hour)
    try {
      const { success, headers } = await checkRateLimit(body.walletAddress, rateLimiters.trade);

      if (!success) {
        console.log('[/api/trades/prepare] Rate limit exceeded for wallet:', body.walletAddress);
        return NextResponse.json(
          {
            error: 'Rate limit exceeded. You can make up to 50 trades per hour.',
            rateLimitExceeded: true
          },
          { status: 429, headers }
        );
      }
    } catch (rateLimitError) {
      // Log error but don't block the request if rate limiting fails
      console.error('[/api/trades/prepare] Rate limit check failed:', rateLimitError);
      // Continue with request - fail open for availability
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
    // Note: amount is already in µUSDC for buys, calculateStakeSkim expects and returns µUSDC
    const stakeSkim = await calculateStakeSkim({
      userId: user.id,
      poolAddress: poolAddress,
      tradeType: tradeType,
      tradeAmount: amount, // µUSDC for buys
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
      } catch {
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
      stakeSkim, // << add this to subtract from buy amount
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
  amount: number;     // µUSDC for buys; atomic tokens for sells
  stakeSkim?: number; // µUSDC
}): Promise<{ tokensOut: number; usdcOut: number }> {
  try {
    const { fetchPoolData } = await import('@/lib/solana/fetch-pool-data');
    const { estimateTokensOut, estimateUsdcOut, TokenSide } = await import('@/lib/solana/icbs-pricing');

    const poolData = await fetchPoolData(params.poolAddress, params.connection.rpcEndpoint);

    const side = params.side.toUpperCase() as 'LONG' | 'SHORT';
    const icbsSide = side === 'LONG' ? TokenSide.Long : TokenSide.Short;
    const currentSupply = side === 'LONG' ? poolData.supplyLong : poolData.supplyShort; // display units
    const otherSupply = side === 'LONG' ? poolData.supplyShort : poolData.supplyLong;   // display units
    const lambdaScale = 1.0;

    if (params.tradeType === 'buy') {
      // Subtract stake skim to get net amount that goes to the curve
      const netMicro = Math.max(0, params.amount - (params.stakeSkim ?? 0));
      const tokensOut = estimateTokensOut(
        currentSupply,
        otherSupply,
        netMicro / 1_000_000, // µUSDC -> USDC (display)
        icbsSide,
        lambdaScale,
        poolData.f,
        poolData.betaNum,
        poolData.betaDen
      );
      return { tokensOut, usdcOut: 0 };
    } else {
      const usdcOut = estimateUsdcOut(
        currentSupply,
        otherSupply,
        params.amount / 1_000_000, // atomic -> display tokens
        icbsSide,
        lambdaScale,
        poolData.f,
        poolData.betaNum,
        poolData.betaDen
      );
      return { tokensOut: 0, usdcOut };
    }
  } catch (error) {
    console.warn('[TRADE SIMULATION] Could not simulate trade:', error);
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
    signTransaction: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(tx: T): Promise<T> => tx,
    signAllTransactions: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(txs: T[]): Promise<T[]> => txs,
  };

  // Create provider and program
  const provider = new AnchorProvider(params.connection, dummyWallet as anchor.Wallet, {
    commitment: 'confirmed',
  });
  const program = new Program<VeritasCuration>(
    idl as anchor.Idl,
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

  // Amounts are already validated before this function is called
  // params.amount is micro-USDC for buys, atomic tokens for sells
  // params.stakeSkim is micro-USDC

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
