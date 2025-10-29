/**
 * Protocol Deposit API Endpoint
 *
 * Builds a deposit transaction using the VeritasCustodian's deposit instruction.
 * This properly:
 * 1. Transfers USDC from user to the global custodian's USDC vault via CPI
 * 2. Updates custodian.total_deposits counter
 * 3. Emits DepositEvent for the indexer to record and update agent.total_stake
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { VeritasCuration } from '@/lib/solana/target/types/veritas_curation';
import { PDAHelper } from '@/lib/solana/sdk/transaction-builders';
import { getUsdcMint, getRpcEndpoint, getProgramId } from '@/lib/solana/network-config';
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { asMicroUsdc, microToUsdc } from '@/lib/units';
import idl from '@/lib/solana/target/idl/veritas_curation.json';

interface DepositRequest {
  amount: number; // USDC (display units)
  walletAddress: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: DepositRequest = await req.json();

    // Auth check
    const authHeader = req.headers.get('Authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = getSupabaseServiceRole();

    // Validate request
    if (!body.amount || body.amount <= 0 || !body.walletAddress) {
      console.error('[DEPOSIT] ❌ Invalid request:', body);
      return NextResponse.json(
        { error: 'Invalid deposit amount or wallet address' },
        { status: 400 }
      );
    }

    // Enforce minimum deposit (1 USDC)
    if (body.amount < 1) {
      return NextResponse.json(
        { error: 'Minimum deposit is 1 USDC' },
        { status: 400 }
      );
    }

    // Convert amount to micro-USDC
    const amountMicro = asMicroUsdc(Math.floor(body.amount * 1_000_000));

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

    // Check rate limit (20 deposits per hour)
    try {
      const { success, headers } = await checkRateLimit(body.walletAddress, rateLimiters.deposit);

      if (!success) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded. You can make up to 20 deposits per hour.',
            rateLimitExceeded: true
          },
          { status: 429, headers }
        );
      }
    } catch (rateLimitError) {
      // Log error but don't block the request if rate limiting fails
      console.error('[/api/users/deposit] Rate limit check failed:', rateLimitError);
      // Continue with request - fail open for availability
    }

    // Build transaction
    const connection = new Connection(getRpcEndpoint(), 'confirmed');
    const transaction = await buildDepositTransaction({
      connection,
      walletAddress: body.walletAddress,
      amountMicro,
    });

    // Serialize and return
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    return NextResponse.json({
      transaction: serialized.toString('base64'),
      amount: microToUsdc(amountMicro),
      amountMicro,
    });

  } catch (error) {
    console.error('Error preparing deposit:', error);
    return NextResponse.json(
      {
        error: 'Failed to prepare deposit',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Build deposit transaction using VeritasCustodian's deposit instruction
 * This properly emits DepositEvent for indexing and updates total_deposits
 */
async function buildDepositTransaction(params: {
  connection: Connection;
  walletAddress: string;
  amountMicro: number; // micro-USDC
}): Promise<Transaction> {
  const programId = getProgramId();
  const programPubkey = new PublicKey(programId);
  const walletPubkey = new PublicKey(params.walletAddress);
  const usdcMint = getUsdcMint();

  // Create dummy wallet for provider
  const dummyWallet = {
    publicKey: walletPubkey,
    signTransaction: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(tx: T): Promise<T> => tx,
    signAllTransactions: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(txs: T[]): Promise<T[]> => txs,
  };

  const provider = new AnchorProvider(params.connection, dummyWallet as anchor.Wallet, {
    commitment: 'confirmed',
  });
  const program = new Program<VeritasCuration>(idl as anchor.Idl, provider);

  // Derive custodian PDA and get vault address
  const pdaHelper = new PDAHelper(programPubkey);
  const [custodianPda] = pdaHelper.getGlobalCustodianPda();
  const custodian = await program.account.veritasCustodian.fetch(custodianPda);
  const custodianUsdcVault = custodian.usdcVault;

  // Get user's USDC account
  const depositorUsdcAccount = await getAssociatedTokenAddress(usdcMint, walletPubkey);

  // Build deposit instruction
  const depositIx = await program.methods
    .deposit(new anchor.BN(params.amountMicro))
    .accounts({
      custodian: custodianPda,
      custodianUsdcVault: custodianUsdcVault,
      depositorUsdcAccount: depositorUsdcAccount,
      depositor: walletPubkey,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .instruction();

  // Build transaction
  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }));
  tx.add(depositIx);

  // Set recent blockhash and fee payer
  const { blockhash } = await params.connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = walletPubkey;

  return tx;
}