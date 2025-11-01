/**
 * Withdrawal Preparation API
 *
 * Calculates withdrawable amount and builds a partially-signed transaction for the user.
 * The backend signs with protocol authority, then returns to user for final signature.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { VeritasCuration } from '@/lib/solana/target/types/veritas_curation';
import { PDAHelper } from '@/lib/solana/sdk/transaction-builders';
import { getUsdcMint, getRpcEndpoint, getProgramId } from '@/lib/solana/network-config';
import { calculateWithdrawable } from '@/lib/stake/calculate-withdrawable';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { asMicroUsdc, microToUsdc, type MicroUSDC } from '@/lib/units';
import idl from '@/lib/solana/target/idl/veritas_curation.json';

interface WithdrawRequest {
  amount: number; // USDC (display units)
  walletAddress: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: WithdrawRequest = await req.json();

    // Auth check
    const authHeader = req.headers.get('Authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = getSupabaseServiceRole();

    // Validate request
    if (!body.amount || body.amount <= 0 || !body.walletAddress) {
      console.error('[WITHDRAW] ❌ Invalid request:', body);
      return NextResponse.json(
        { error: 'Invalid withdrawal amount or wallet address' },
        { status: 400 }
      );
    }

    // Convert amount to micro-USDC
    const requestedMicro = asMicroUsdc(Math.floor(body.amount * 1_000_000));

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

    // Check rate limit (10 withdrawals per hour)
    try {
      const { success, headers } = await checkRateLimit(body.walletAddress, rateLimiters.withdraw);

      if (!success) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded. You can make up to 10 withdrawals per hour.',
            rateLimitExceeded: true
          },
          { status: 429, headers }
        );
      }
    } catch (rateLimitError) {
      // Log error but don't block the request if rate limiting fails
      console.error('[/api/users/withdraw] Rate limit check failed:', rateLimitError);
      // Continue with request - fail open for availability
    }

    // Calculate withdrawable amount (all values in micro-USDC)
    const { totalStakeMicro, totalLocksMicro, withdrawableMicro } = await calculateWithdrawable(user.id);

    // Check if user has sufficient withdrawable balance
    if (withdrawableMicro <= 0) {
      return NextResponse.json({
        error: 'No unlocked stake available. Close positions to free up stake.',
        totalStake: microToUsdc(totalStakeMicro as MicroUSDC),
        totalLocked: microToUsdc(totalLocksMicro as MicroUSDC),
        withdrawable: microToUsdc(withdrawableMicro as MicroUSDC),
      }, { status: 400 });
    }

    if (requestedMicro > withdrawableMicro) {
      return NextResponse.json({
        error: 'Withdrawal amount exceeds available balance',
        requested: microToUsdc(requestedMicro as MicroUSDC),
        available: microToUsdc(withdrawableMicro as MicroUSDC),
        totalStake: microToUsdc(totalStakeMicro as MicroUSDC),
        totalLocked: microToUsdc(totalLocksMicro as MicroUSDC),
      }, { status: 400 });
    }

    // Build transaction (already signed by protocol authority inside buildWithdrawTransaction)
    const connection = new Connection(getRpcEndpoint(), 'confirmed');
    const transaction = await buildWithdrawTransaction({
      connection,
      walletAddress: body.walletAddress,
      amountMicro: requestedMicro,
    });

    // Serialize and return
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    return NextResponse.json({
      transaction: serialized.toString('base64'),
      amount: microToUsdc(requestedMicro as MicroUSDC),
      amountMicro: requestedMicro,
      withdrawable: microToUsdc(withdrawableMicro as MicroUSDC),
      totalStake: microToUsdc(totalStakeMicro as MicroUSDC),
      totalLocked: microToUsdc(totalLocksMicro as MicroUSDC),
    });

  } catch (error) {
    console.error('Error preparing withdrawal:', error);
    return NextResponse.json(
      {
        error: 'Failed to prepare withdrawal',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Build a withdrawal transaction
 * Protocol authority withdraws USDC from custodian vault to user's wallet
 */
async function buildWithdrawTransaction(params: {
  connection: Connection;
  walletAddress: string;
  amountMicro: number; // micro-USDC
}): Promise<Transaction> {
  const programId = getProgramId();
  const programPubkey = new PublicKey(programId);
  const walletPubkey = new PublicKey(params.walletAddress);

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

  // Derive custodian PDA
  const pdaHelper = new PDAHelper(programPubkey);
  const [custodianPda] = pdaHelper.getGlobalCustodianPda();

  // Fetch custodian to get USDC vault address
  const custodian = await program.account.veritasCustodian.fetch(custodianPda);
  const custodianUsdcVault = custodian.usdcVault;

  // Get recipient's USDC account
  const usdcMint = getUsdcMint();
  const recipientUsdcAccount = await getAssociatedTokenAddress(usdcMint, walletPubkey);

  // Load protocol authority keypair
  const authorityKeypair = loadProtocolAuthority();

  // Verify the loaded keypair matches the custodian's expected authority
  if (!authorityKeypair.publicKey.equals(custodian.protocolAuthority)) {
    throw new Error(
      `Protocol authority mismatch. Expected: ${custodian.protocolAuthority.toBase58()}, Got: ${authorityKeypair.publicKey.toBase58()}`
    );
  }

  // Build withdrawal transaction using Anchor
  const tx = await program.methods
    .withdraw(
      new anchor.BN(params.amountMicro), // amount in micro-USDC
      walletPubkey // recipient
    )
    .accounts({
      custodian: custodianPda,
      custodianUsdcVault: custodianUsdcVault,
      recipientUsdcAccount: recipientUsdcAccount,
      authority: authorityKeypair.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .preInstructions([
      // Add compute budget
      (await import('@solana/web3.js')).ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
      // Add memo for wallet transparency
      (await import('@solana/web3.js')).TransactionInstruction.fromObject({
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        keys: [],
        data: Buffer.from(`Veritas: Withdraw ${(params.amountMicro / 1_000_000).toFixed(2)} USDC from stake`)
      })
    ])
    .transaction();

  // Set recent blockhash and fee payer
  const { blockhash } = await params.connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = walletPubkey;

  // Sign with protocol authority
  tx.partialSign(authorityKeypair);

  return tx;
}