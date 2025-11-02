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
import { verifyAuthHeader } from '@/lib/auth/privy-server';
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
  try {
    const body: PrepareTradeRequest = await req.json();

    // Auth check
    const authHeader = req.headers.get('Authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = getSupabaseServiceRole();

    // Normalize field names and values
    const tradeType = (body.tradeType?.toLowerCase() || '') as 'buy' | 'sell';
    const side = (body.side?.toLowerCase() || '') as 'long' | 'short';
    const rawAmount = body.amount || body.usdcAmount || body.tokenAmount || 0;

    // Validate and convert to type-safe units
    let amount: number;
    try {
      if (tradeType === 'buy') {
        // For buys, rawAmount is already micro-USDC from the hook
        amount = asMicroUsdc(Math.floor(rawAmount)); // Validate as micro-USDC
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


    // Validate request
    if (!body.postId || !tradeType || !side || !amount || !body.walletAddress) {
      console.error('[PREPARE] ❌ Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }


    // Verify wallet ownership
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, agent_id')
      .eq('auth_id', privyUserId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's Solana address
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('solana_address')
      .eq('id', user.agent_id)
      .single();

    if (agentError || !agent || !agent.solana_address) {
      return NextResponse.json({ error: 'User has no Solana wallet' }, { status: 400 });
    }

    const userWalletAddress = agent.solana_address;

    if (userWalletAddress !== body.walletAddress) {
      return NextResponse.json({ error: 'Wallet does not belong to authenticated user' }, { status: 403 });
    }

    // Check rate limit (50 trades per hour)
    try {
      const { success, headers } = await checkRateLimit(body.walletAddress, rateLimiters.trade);

      if (!success) {
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

    // Get pool address and post creator info
    let poolAddress = body.poolAddress;

    // Batch database queries
    const [postResult, poolResult, slippageConfig] = await Promise.all([
      // Fetch post with creator info
      supabase
        .from('posts')
        .select(`
          id,
          user_id,
          users!inner(agent_id, agents!inner(solana_address))
        `)
        .eq('id', body.postId)
        .single(),
      // Fetch pool deployment (if poolAddress not provided)
      !body.poolAddress
        ? supabase
            .from('pool_deployments')
            .select('pool_address, status')
            .eq('post_id', body.postId)
            .single()
        : Promise.resolve({ data: null, error: null }),
      // Fetch slippage config
      supabase
        .from('system_config')
        .select('value')
        .eq('key', 'default_slippage_bps')
        .single()
    ]);

    // Handle post result
    const { data: post, error: postError } = postResult;
    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Extract creator's Solana wallet address
    const creatorAgent = (post.users as { agents?: { solana_address?: string } })?.agents;
    if (!creatorAgent || !creatorAgent.solana_address) {
      return NextResponse.json(
        { error: 'Post creator has no Solana wallet' },
        { status: 400 }
      );
    }
    const postCreatorWallet = creatorAgent.solana_address;

    // Handle pool address result
    if (!poolAddress) {
      const { data: poolDeployment } = poolResult;
      if (!poolDeployment) {
        return NextResponse.json(
          { error: 'Pool not found for this post' },
          { status: 404 }
        );
      }
      poolAddress = poolDeployment.pool_address;
    }

    // Calculate stake skim with UX check
    // Note: amount is already in µUSDC for buys, calculateStakeSkim expects and returns µUSDC
    // At this point, poolAddress is guaranteed to be defined (checked above)
    const stakeSkim = await calculateStakeSkim({
      userId: user.id,
      poolAddress: poolAddress!,
      tradeType: tradeType,
      tradeAmount: amount, // µUSDC for buys
      walletAddress: body.walletAddress,
      side: side.toUpperCase() as 'LONG' | 'SHORT',
    });

    // Check if skim is excessive (> 30% of trade)
    // This indicates underwater positions that should be topped up first
    if (tradeType === 'buy' && stakeSkim > 0) {
      const skimPercentage = (stakeSkim / amount) * 100;

      if (skimPercentage > 30) {
        // Import the underwater check function
        const { checkUnderwaterPositions } = await import('@/lib/stake/check-underwater-positions');
        const underwaterCheck = await checkUnderwaterPositions(user.id, user.agent_id);

        // Calculate required deposit to bring skim down to 2%
        // Target: stakeSkim = 2% of tradeAmount
        // stakeSkim = max(0, (totalLocks + newLock) - (currentStake + deposit))
        // For 2% skim: stakeSkim = 0.02 * tradeAmount
        // We need: (totalLocks + newLock) - (currentStake + deposit) = 0.02 * tradeAmount
        // Solving for deposit: deposit = (totalLocks + newLock) - currentStake - (0.02 * tradeAmount)

        const targetSkimPercentage = 2; // 2% target
        const targetSkim = Math.floor((targetSkimPercentage / 100) * amount); // µUSDC
        const newLock = Math.floor(amount * 0.02); // 2% of trade amount becomes new lock
        const requiredDeposit = Math.max(0,
          (underwaterCheck.totalLocks + newLock) - underwaterCheck.currentStake - targetSkim
        );

        // Block the trade with error
        return NextResponse.json({
          error: 'excessive_skim',
          blocked: true,
          skimAmount: stakeSkim,
          skimPercentage: Math.round(skimPercentage),
          tradeAmount: amount,
          message: `This trade requires ${Math.round(skimPercentage)}% skim (${(stakeSkim / 1_000_000).toFixed(2)} USDC). Please deposit funds to continue.`,
          underwaterInfo: {
            isUnderwater: underwaterCheck.isUnderwater,
            currentStake: underwaterCheck.currentStake / 1_000_000,
            totalLocks: underwaterCheck.totalLocks / 1_000_000,
            deficit: underwaterCheck.deficit / 1_000_000,
            positions: underwaterCheck.positions.map((p) => ({
              poolAddress: p.poolAddress,
              postId: p.postId,
              side: p.tokenType,
              lock: p.beliefLock / 1_000_000,
              balance: p.tokenBalance,
            })),
          },
          recommendedDeposit: requiredDeposit / 1_000_000, // Convert to display USDC
          recommendedDepositMicro: requiredDeposit, // Keep micro-USDC for API calls
          recommendation: `Deposit ${(requiredDeposit / 1_000_000).toFixed(2)} USDC to reduce skim to ${targetSkimPercentage}% and enable this trade.`,
        }, { status: 400 }); // 400 Bad Request (blocking error)
      }
    }


    // Prepare connection and accounts for later use
    const connection = new Connection(getRpcEndpoint(), 'confirmed');
    const walletPubkey = new PublicKey(body.walletAddress);
    const usdcMint = getUsdcMint();
    const userUsdcAccount = await getAssociatedTokenAddress(usdcMint, walletPubkey);

    // Validate sufficient balance (for buys only)
    if (tradeType === 'buy') {
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

    // Extract slippage tolerance (already fetched above)
    const slippageBps = slippageConfig?.data?.value ? parseInt(slippageConfig.data.value) : 100;

    // Build transaction (already signed by protocol authority inside buildTradeTransaction)
    const transaction = await buildTradeTransaction({
      connection,
      walletAddress: body.walletAddress,
      postId: body.postId,
      poolAddress: poolAddress!,
      postCreatorWallet: postCreatorWallet!,
      side: side,
      tradeType: tradeType,
      amount: amount,
      stakeSkim,
      slippageBps,
    });

    // Serialize and return
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // Calculate expected trade outputs by reading pool state
    const tradeOutputs = await calculateTradeOutputs({
      connection,
      poolAddress: poolAddress!,
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
      slippageBps,
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
 * Build a trade transaction with stake skim and slippage protection
 */
async function buildTradeTransaction(params: {
  connection: Connection;
  walletAddress: string;
  postId: string;
  poolAddress: string;
  postCreatorWallet: string;
  side: 'long' | 'short';
  tradeType: 'buy' | 'sell';
  amount: number;
  stakeSkim: number;
  slippageBps: number;
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

  // Get post creator's USDC account
  const postCreatorPubkey = new PublicKey(params.postCreatorWallet);
  const postCreatorUsdcAccount = await getAssociatedTokenAddress(usdcMint, postCreatorPubkey);

  // Fetch custodian and factory in parallel
  const [custodian, factory] = await Promise.all([
    program.account.veritasCustodian.fetch(custodianPda),
    program.account.poolFactory.fetch(factoryPda)
  ]);

  const stakeVault = custodian.usdcVault;
  // TypeScript types may not match on-chain structure - cast to access protocol_treasury
  const protocolTreasuryPubkey = (factory as any).protocolTreasury || (factory as any).protocol_treasury;
  const protocolTreasuryUsdcAccount = await getAssociatedTokenAddress(usdcMint, protocolTreasuryPubkey);

  // Get factory authority (field name from IDL: protocol_authority)
  const expectedAuthority = (factory as any).protocolAuthority || (factory as any).protocol_authority;

  console.log('[TRADE] Factory data:', {
    keys: Object.keys(factory || {}),
    expectedAuthority: expectedAuthority?.toBase58?.(),
  });

  // Load protocol authority keypair
  console.log('[TRADE] About to load protocol authority...');
  const authorityKeypair = loadProtocolAuthority();
  console.log('[TRADE] Loaded keypair:', {
    type: typeof authorityKeypair,
    keys: Object.keys(authorityKeypair || {}),
    hasPublicKey: !!(authorityKeypair as { publicKey?: unknown })?.publicKey,
    publicKeyType: typeof (authorityKeypair as { publicKey?: unknown })?.publicKey,
  });

  // Debug: verify we got a valid keypair
  if (!authorityKeypair) {
    throw new Error('loadProtocolAuthority returned undefined');
  }
  if (!authorityKeypair.publicKey) {
    console.error('[TRADE] authorityKeypair:', authorityKeypair);
    console.error('[TRADE] authorityKeypair.publicKey:', (authorityKeypair as { publicKey?: unknown }).publicKey);
    throw new Error('authorityKeypair.publicKey is undefined');
  }

  console.log('[TRADE] Authority public key:', authorityKeypair.publicKey.toBase58());
  console.log('[TRADE] Expected authority:', expectedAuthority.toBase58());

  // Verify the loaded keypair matches the factory's expected authority
  if (!authorityKeypair.publicKey.equals(expectedAuthority)) {
    throw new Error(
      `Protocol authority mismatch. Expected: ${expectedAuthority.toBase58()}, Got: ${authorityKeypair.publicKey.toBase58()}`
    );
  }

  // Calculate slippage-protected minimum outputs
  const tradeOutputs = await calculateTradeOutputs({
    connection: params.connection,
    poolAddress: params.poolAddress,
    side: params.side,
    tradeType: params.tradeType,
    amount: params.amount,
    stakeSkim: params.stakeSkim,
  });

  // Apply slippage tolerance to expected outputs
  // For BUY: minTokensOut = expectedTokensOut * (1 - slippage%)
  // For SELL: minUsdcOut = expectedUsdcOut * (1 - slippage%)
  const minTokensOut = params.tradeType === 'buy'
    ? Math.floor(tradeOutputs.tokensOut * (10000 - params.slippageBps) / 10000)
    : 0;

  const minUsdcOut = params.tradeType === 'sell'
    ? Math.floor(tradeOutputs.usdcOut * (10000 - params.slippageBps) / 10000)
    : 0;

  // Build transaction using Anchor's transaction builder (includes signers)
  const tx = await program.methods
    .trade(
      params.side === 'long' ? { long: {} } : { short: {} },
      params.tradeType === 'buy' ? { buy: {} } : { sell: {} },
      new anchor.BN(params.amount),
      new anchor.BN(params.stakeSkim),
      new anchor.BN(minTokensOut), // Slippage-protected minimum tokens for BUY
      new anchor.BN(minUsdcOut)     // Slippage-protected minimum USDC for SELL
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
      postCreatorUsdcAccount: postCreatorUsdcAccount,
      protocolTreasuryUsdcAccount: protocolTreasuryUsdcAccount,
    } as any)
    .preInstructions([
      // Add compute budget
      (await import('@solana/web3.js')).ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      // Add memo for wallet transparency
      new (await import('@solana/web3.js')).TransactionInstruction({
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        keys: [],
        data: Buffer.from(
          `Veritas: ${params.tradeType.toUpperCase()} ${params.side.toUpperCase()} tokens ${params.tradeType === 'buy' ? (params.amount / 1_000_000).toFixed(2) + ' USDC' : (params.amount / 1_000_000).toFixed(2) + ' tokens'}`
        )
      })
    ])
    .transaction();

  // Check all accounts in parallel (batched RPC call)
  const accountsToCheck = [
    postCreatorUsdcAccount,
    protocolTreasuryUsdcAccount,
    ...(params.tradeType === 'buy' ? [traderTokenAccount] : [])
  ];

  const accountInfos = await params.connection.getMultipleAccountsInfo(accountsToCheck);

  // Map results back to account types
  const postCreatorAccountInfo = accountInfos[0];
  const protocolTreasuryAccountInfo = accountInfos[1];
  const tokenAccountInfo = params.tradeType === 'buy' ? accountInfos[2] : null;

  // Create missing ATAs
  let insertIndex = 1; // Start after compute budget instruction

  // Create token ATA if it doesn't exist (needed for receiving tokens on buy)
  if (params.tradeType === 'buy' && !tokenAccountInfo) {
    const createAtaIx = createAssociatedTokenAccountInstruction(
      walletPubkey, // payer
      traderTokenAccount, // ata
      walletPubkey, // owner
      tokenMintPda // mint
    );
    tx.instructions.splice(insertIndex, 0, createAtaIx);
    insertIndex++;
  }

  // Create post creator's USDC ATA if it doesn't exist (needed for fee distribution)
  if (!postCreatorAccountInfo) {
    const createCreatorAtaIx = createAssociatedTokenAccountInstruction(
      walletPubkey, // payer (trader pays for account creation)
      postCreatorUsdcAccount, // ata
      postCreatorPubkey, // owner
      usdcMint // mint
    );
    tx.instructions.splice(insertIndex, 0, createCreatorAtaIx);
    insertIndex++;
  }

  // Create protocol treasury's USDC ATA if it doesn't exist (needed for fee distribution)
  if (!protocolTreasuryAccountInfo) {
    const createTreasuryAtaIx = createAssociatedTokenAccountInstruction(
      walletPubkey, // payer (trader pays for account creation)
      protocolTreasuryUsdcAccount, // ata
      protocolTreasuryPubkey, // owner
      usdcMint // mint
    );
    tx.instructions.splice(insertIndex, 0, createTreasuryAtaIx);
    insertIndex++;
  }

  // Set recent blockhash and fee payer
  const { blockhash } = await params.connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = walletPubkey;

  // Protocol authority will sign in /api/trades/execute (user signs first)
  // Transaction is returned unsigned to user for proper signing order

  return tx;
}
