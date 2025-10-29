/**
 * useDeployPool Hook
 * Deploys a pool with initial liquidity in ONE atomic transaction
 *
 * Combines create_pool + deploy_market into a single transaction for atomicity.
 * If either instruction fails, the entire transaction rolls back.
 */

import { useState, useCallback } from 'react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { usePrivy } from './usePrivyHooks';
import { useSolanaWallet } from './useSolanaWallet';
import { getRpcEndpoint } from '@/lib/solana/network-config';
import { getUsdcMint } from '@/lib/solana/network-config';
import {
  buildCreatePoolTx,
  buildDeployMarketTx,
  uuidToContentId,
  PDAHelper,
  ProtocolAddresses,
} from '@/lib/solana/sdk/transaction-builders';
import idl from '@/lib/solana/target/idl/veritas_curation.json';
import { VeritasCuration } from '@/lib/solana/target/types/veritas_curation';

interface DeployPoolParams {
  postId: string;
  initialDeposit: number; // USDC amount (will be converted to micro-USDC)
  longAllocationPercent: number; // 0-100
}

interface DeployPoolResult {
  poolAddress: string;
  signature: string; // combined transaction signature
}

export function useDeployPool() {
  const { getAccessToken } = usePrivy();
  const { wallet, isConnected } = useSolanaWallet();
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deployPool = useCallback(
    async (params: DeployPoolParams): Promise<DeployPoolResult | null> => {

      setIsDeploying(true);
      setError(null);

      try {

        const jwt = await getAccessToken();

        if (!jwt) {
          throw new Error('Authentication required');
        }


        if (!wallet || !isConnected) {
          throw new Error('No wallet connected. Please refresh the page and try again.');
        }

        const walletAddress = wallet.address;

        const connection = new Connection(getRpcEndpoint(), 'confirmed');

        console.log('━━━━━━━━━━━━━━━���━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 [DEPLOY POOL] Starting deployment');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📍 Post ID:', params.postId);
        console.log('💰 Initial Deposit:', params.initialDeposit, 'USDC');
        console.log('📊 LONG Allocation:', params.longAllocationPercent, '%');
        console.log('👛 Wallet Address:', walletAddress);
        console.log('🔗 Wallet Type:', wallet.walletClientType || 'unknown');

        // Check wallet SOL and USDC balance
        const { getAssociatedTokenAddress } = await import('@solana/spl-token');
        const usdcMintPubkey = getUsdcMint();

        let solBalance = 0;
        let usdcBalance = 0;

        try {
          solBalance = await connection.getBalance(new PublicKey(walletAddress));
          console.log('💵 SOL Balance:', (solBalance / 1e9).toFixed(4), 'SOL');

          const usdcAta = await getAssociatedTokenAddress(usdcMintPubkey, new PublicKey(walletAddress));

          try {
            const tokenBalance = await connection.getTokenAccountBalance(usdcAta);
            usdcBalance = tokenBalance.value.uiAmount || 0;
            console.log('💵 USDC Balance:', usdcBalance, 'USDC');
          } catch (e) {
            console.log('💵 USDC Balance: 0 USDC (no token account)');
            usdcBalance = 0;
          }
        } catch (balanceError) {
          console.warn('⚠️  Could not fetch wallet balances:', balanceError);
          throw new Error('Unable to check wallet balance. Please try again.');
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Validate sufficient balances BEFORE building transaction
        const solBalanceInSol = solBalance / 1e9;
        const minSolRequired = 0.01; // Minimum SOL needed for transaction fees

        const hasInsufficientSol = solBalanceInSol < minSolRequired;
        const hasInsufficientUsdc = usdcBalance < params.initialDeposit;

        if (hasInsufficientSol && hasInsufficientUsdc) {
          throw new Error(
            `You need ${minSolRequired} SOL and ${params.initialDeposit} USDC to deploy this pool. ` +
            `Please fund your wallet and try again.`
          );
        }

        if (hasInsufficientSol) {
          throw new Error(
            `You need at least ${minSolRequired} SOL for transaction fees. Please add SOL to your wallet and try again.`
          );
        }

        if (hasInsufficientUsdc) {
          throw new Error(
            `You need ${params.initialDeposit} USDC to deploy this pool. Please add USDC to your wallet and try again.`
          );
        }

        const programId = new PublicKey(process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID!);

        // Step 1: Validate with backend

        const validateRes = await fetch('/api/pools/deploy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ postId: params.postId }),
        });


        if (!validateRes.ok) {
          const errorData = await validateRes.json();
          console.error('[STEP 4/7] ❌ Validation failed:', errorData);

          // Check if this is a recoverable situation (pool exists on-chain but not in DB)
          if (validateRes.status === 409 && errorData.canRecover && errorData.existingPoolAddress) {

            // Attempt to recover the pool
            const recoverRes = await fetch('/api/pools/recover', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
              },
              body: JSON.stringify({
                postId: params.postId,
                poolAddress: errorData.existingPoolAddress,
              }),
            });

            if (recoverRes.ok) {
              const recoverData = await recoverRes.json();

              return {
                poolAddress: errorData.existingPoolAddress,
                signature: recoverData.signature || '',
              };
            } else {
              const recoverError = await recoverRes.json();
              console.error('[STEP 4/7] ❌ Recovery failed:', recoverError);
              throw new Error(`Recovery failed: ${recoverError.error || 'Unknown error'}`);
            }
          }

          throw new Error(errorData.error || 'Validation failed');
        }

        const validationData = await validateRes.json();

        // Extract post creator's Solana address from validation response
        const postCreatorSolanaAddress = validationData.postCreatorSolanaAddress;
        if (!postCreatorSolanaAddress) {
          throw new Error('Post creator Solana address not found in validation response');
        }

        // Check if pool is orphaned (created but not deployed)
        const isOrphaned = validationData.poolExists && validationData.isOrphaned;
        if (isOrphaned) {
        } else if (validationData.poolExists) {
        } else {
        }

        // Step 2: Build transaction instructions (create_pool + deploy_market, or just deploy_market if orphaned)

        const pdaHelper = new PDAHelper(programId);
        const contentId = uuidToContentId(params.postId);
        const [factoryPda] = pdaHelper.getFactoryPda();

        // Create provider
        const provider = new AnchorProvider(
          connection,
          wallet as any,
          { commitment: 'confirmed' }
        );

        const program = new Program<VeritasCuration>(idl as any, provider);

        // Fetch factory to get pool authority (field name from IDL: protocol_authority)
        const factory = await program.account.poolFactory.fetch(factoryPda);
        const poolAuthority = ((factory as any).protocolAuthority || (factory as any).protocol_authority) as PublicKey;

        const protocolAddresses: ProtocolAddresses = {
          programId,
          configPda: pdaHelper.getConfigPda()[0],
          factoryPda,
          treasuryPda: pdaHelper.getTreasuryPda()[0],
          usdcMint: usdcMintPubkey,
          protocolAuthority: poolAuthority,
        };

        // Build create_pool instruction (only if pool doesn't exist)
        let createPoolTx: Transaction | null = null;
        if (!isOrphaned) {
          createPoolTx = await buildCreatePoolTx(
            program,
            new PublicKey(walletAddress),
            new PublicKey(postCreatorSolanaAddress),
            contentId,
            protocolAddresses
          );
        }

        // Build deploy_market instruction
        const initialDepositLamports = new BN(params.initialDeposit * 1_000_000); // Convert to micro-USDC
        const longAllocationLamports = initialDepositLamports.muln(params.longAllocationPercent).divn(100);


        const deployMarketTx = await buildDeployMarketTx(program, {
          deployer: new PublicKey(walletAddress),
          contentId: contentId,
          initialDeposit: initialDepositLamports,
          longAllocation: longAllocationLamports,
          usdcMint: usdcMintPubkey,
        });


        // Combine instructions into a single atomic transaction
        const combinedTx = new Transaction();

        // Remove compute budget instructions from individual transactions to avoid duplicates
        const deployMarketInstructions = deployMarketTx.instructions.filter(
          ix => !ix.programId.equals(new PublicKey('ComputeBudget111111111111111111111111111111'))
        );

        // Add a single compute budget instruction for the combined transaction
        const { ComputeBudgetProgram } = await import('@solana/web3.js');
        const computeUnits = isOrphaned ? 500_000 : 900_000; // Less CU needed if only deploy_market
        combinedTx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }));

        // Add create_pool instructions if pool doesn't exist
        if (createPoolTx) {
          const createPoolInstructions = createPoolTx.instructions.filter(
            ix => !ix.programId.equals(new PublicKey('ComputeBudget111111111111111111111111111111'))
          );
          combinedTx.add(...createPoolInstructions);
        }

        // Add deploy_market instructions
        combinedTx.add(...deployMarketInstructions);

        // Set transaction metadata
        let blockhashData = await connection.getLatestBlockhash();
        combinedTx.recentBlockhash = blockhashData.blockhash;
        combinedTx.lastValidBlockHeight = blockhashData.lastValidBlockHeight;
        combinedTx.feePayer = new PublicKey(walletAddress);


        // Step 3: Sign and send ONE atomic transaction

        if (!wallet.signTransaction) {
          console.error('[STEP 6/7] ❌ Wallet missing signTransaction method!');
          throw new Error('Wallet does not support signing transactions. Please reconnect your wallet.');
        }

        console.log('🔐 [SIGNING] About to sign transaction...');
        console.log('🔐 Wallet type:', wallet.walletClientType);
        console.log('🔐 Wallet address:', walletAddress);
        console.log('🔐 Fee payer:', combinedTx.feePayer?.toBase58());

        let txSignature: string;

        try {
          console.log('🔐 [SIGNING] Calling wallet.signTransaction()...');
          const signedTx = await wallet.signTransaction(combinedTx);
          console.log('✅ [SIGNING] Transaction signed successfully!');


          // Send the transaction
          txSignature = await connection.sendRawTransaction(signedTx.serialize());

          // Wait for confirmation
          await connection.confirmTransaction(txSignature, 'confirmed');
        } catch (signError: any) {
          console.error('[STEP 6/7] ❌ Signing/sending failed!');
          console.error('[STEP 6/7] Error details:', {
            name: signError?.name,
            message: signError?.message,
            code: signError?.code,
            stack: signError?.stack,
          });
          throw new Error(`Failed to sign/send transaction: ${signError?.message || 'Unknown error'}. Make sure Phantom is unlocked and try again.`);
        }


        const poolPda = pdaHelper.getContentPoolPda(contentId)[0];
        const poolAddress = poolPda.toBase58();

        // Fetch pool state to get ICBS parameters and mint addresses

        let poolAccount;
        let retries = 3;
        while (retries > 0) {
          try {
            poolAccount = await program.account.contentPool.fetch(poolPda);
            break;
          } catch (fetchError) {
            console.warn('[useDeployPool] Pool fetch attempt failed, retrying...', fetchError);
            retries--;
            if (retries === 0) {
              throw new Error('Failed to fetch pool state after transaction confirmation. Pool may not be initialized yet.');
            }
            // Wait 1 second before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (!poolAccount) {
          throw new Error('Failed to fetch pool account');
        }

        if (!poolAccount.longMint || !poolAccount.shortMint || !poolAccount.vault) {
          throw new Error('Pool state not fully initialized - mints or vault missing');
        }

        const longMintAddress = poolAccount.longMint.toBase58();
        const shortMintAddress = poolAccount.shortMint.toBase58();
        const usdcVaultAddress = poolAccount.vault.toBase58();

        // Step 4: Record in database

        const recordResponse = await fetch('/api/pools/record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            postId: params.postId,
            poolAddress,
            signature: txSignature,
            initialDeposit: params.initialDeposit,
            longAllocation: longAllocationLamports.toNumber(),
            sLongSupply: poolAccount.sLong?.toNumber(), // Actual minted LONG tokens (on-manifold)
            sShortSupply: poolAccount.sShort?.toNumber(), // Actual minted SHORT tokens (on-manifold)
            longMintAddress,
            shortMintAddress,
            usdcVaultAddress,
            f: poolAccount.f,
            betaNum: poolAccount.betaNum,
            betaDen: poolAccount.betaDen,
            sqrtLambdaX96: (poolAccount as any).sqrtLambdaLongX96?.toString() || (poolAccount as any).sqrt_lambda_long_x96?.toString(),
            sScaleLongQ64: (poolAccount as any).sScaleLongQ64?.toString() || (poolAccount as any).s_scale_long_q64?.toString(),
            sScaleShortQ64: (poolAccount as any).sScaleShortQ64?.toString() || (poolAccount as any).s_scale_short_q64?.toString(),
            sqrtPriceLongX96: (poolAccount as any).sqrtPriceLongX96?.toString() || (poolAccount as any).sqrt_price_long_x96?.toString(),
            sqrtPriceShortX96: (poolAccount as any).sqrtPriceShortX96?.toString() || (poolAccount as any).sqrt_price_short_x96?.toString(),
          }),
        });

        if (!recordResponse.ok) {
          const errorData = await recordResponse.json();
          console.error('[useDeployPool] Recording failed:', errorData);
          throw new Error(`Failed to record deployment: ${errorData.error || 'Unknown error'}`);
        }

        const recordData = await recordResponse.json();


        return {
          poolAddress,
          signature: txSignature,
        };
      } catch (err) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ [DEPLOY POOL] FAILED!');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('Error:', err);
        if (err instanceof Error) {
          console.error('Message:', err.message);
          console.error('Stack:', err.stack);
        }
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const errorMessage = err instanceof Error ? err.message : 'Failed to deploy pool';
        setError(errorMessage);
        return null;
      } finally {
        setIsDeploying(false);
      }
    },
    [getAccessToken, wallet, isConnected]
  );

  return {
    deployPool,
    isDeploying,
    error,
  };
}
