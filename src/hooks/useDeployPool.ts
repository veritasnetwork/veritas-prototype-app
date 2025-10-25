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
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 [DEPLOY POOL] Starting deployment flow');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      setIsDeploying(true);
      setError(null);

      try {
        console.log('[STEP 1/7] 📋 Deployment parameters:', {
          postId: params.postId,
          initialDeposit: params.initialDeposit,
          longAllocationPercent: params.longAllocationPercent,
        });

        console.log('[STEP 2/7] 🔐 Getting authentication token...');
        const jwt = await getAccessToken();
        console.log('[STEP 2/7] ✅ Access token obtained:', jwt ? 'YES' : 'NO');

        if (!jwt) {
          throw new Error('Authentication required');
        }

        console.log('[STEP 3/7] 👛 Checking wallet status...');
        console.log('[STEP 3/7] Wallet details:', {
          isConnected,
          hasWallet: !!wallet,
          address: wallet?.address,
          chainType: wallet?.chainType,
          walletClientType: wallet?.walletClientType,
          hasSignTransaction: wallet ? typeof wallet.signTransaction : 'no wallet',
          hasSignAllTransactions: wallet ? typeof wallet.signAllTransactions : 'no wallet',
        });

        if (!wallet || !isConnected) {
          throw new Error('No wallet connected. Please refresh the page and try again.');
        }

        const walletAddress = wallet.address;
        console.log('[STEP 3/7] ✅ Wallet ready:', walletAddress);

        console.log('[STEP 4/7] 🌐 Setting up Solana connection...');
        const connection = new Connection(getRpcEndpoint(), 'confirmed');
        const programId = new PublicKey(process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID!);
        const usdcMint = getUsdcMint();
        console.log('[STEP 4/7] Connection details:', {
          rpc: getRpcEndpoint(),
          programId: programId.toBase58(),
          usdcMint: usdcMint.toBase58(),
        });

        // Step 1: Validate with backend
        console.log('[STEP 4/7] 📡 Validating deployment with backend...');
        console.log('[STEP 4/7] Request:', { postId: params.postId });

        const validateRes = await fetch('/api/pools/deploy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ postId: params.postId }),
        });

        console.log('[STEP 4/7] Response status:', validateRes.status);

        if (!validateRes.ok) {
          const errorData = await validateRes.json();
          console.error('[STEP 4/7] ❌ Validation failed:', errorData);

          // Check if this is a recoverable situation (pool exists on-chain but not in DB)
          if (validateRes.status === 409 && errorData.canRecover && errorData.existingPoolAddress) {
            console.log('[STEP 4/7] 🔄 Pool exists on-chain but not in DB. Attempting recovery...');
            console.log('[STEP 4/7] Pool address:', errorData.existingPoolAddress);

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
              console.log('[STEP 4/7] ✅ Pool recovered successfully:', recoverData);

              // Trigger a refresh of the UI
              if (params.onSuccess) {
                params.onSuccess(errorData.existingPoolAddress);
              }

              return {
                success: true,
                poolAddress: errorData.existingPoolAddress,
                recovered: true,
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
        console.log('[STEP 4/7] ✅ Validation response:', {
          success: validationData.success,
          poolExists: validationData.poolExists,
          isOrphaned: validationData.isOrphaned,
          postId: validationData.postId,
        });

        // Check if pool is orphaned (created but not deployed)
        const isOrphaned = validationData.poolExists && validationData.isOrphaned;
        if (isOrphaned) {
          console.log('[STEP 4/7] ⚠️  Pool is orphaned - will skip create_pool and only execute deploy_market');
        } else if (validationData.poolExists) {
          console.log('[STEP 4/7] Pool exists and is fully deployed');
        } else {
          console.log('[STEP 4/7] New pool - will execute both create_pool and deploy_market');
        }

        // Step 2: Build transaction instructions (create_pool + deploy_market, or just deploy_market if orphaned)
        console.log('[STEP 5/7] 🔨 Building transaction instructions...');

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

        // Fetch factory to get pool authority
        const factory = await program.account.poolFactory.fetch(factoryPda);
        const poolAuthority = factory.poolAuthority as PublicKey;

        const protocolAddresses: ProtocolAddresses = {
          programId,
          configPda: pdaHelper.getConfigPda()[0],
          factoryPda,
          treasuryPda: pdaHelper.getTreasuryPda()[0],
          usdcMint,
          protocolAuthority: poolAuthority,
        };

        // Build create_pool instruction (only if pool doesn't exist)
        let createPoolTx: Transaction | null = null;
        if (!isOrphaned) {
          createPoolTx = await buildCreatePoolTx(
            program,
            new PublicKey(walletAddress),
            contentId,
            protocolAddresses
          );
        }

        // Build deploy_market instruction
        const initialDepositLamports = new BN(params.initialDeposit * 1_000_000); // Convert to micro-USDC
        const longAllocationLamports = initialDepositLamports.muln(params.longAllocationPercent).divn(100);

        console.log('[STEP 5/7] Calculated amounts:', {
          initialDeposit: params.initialDeposit + ' USDC',
          initialDepositLamports: initialDepositLamports.toString() + ' lamports',
          longAllocationPercent: params.longAllocationPercent + '%',
          longAllocationLamports: longAllocationLamports.toString() + ' lamports',
          shortAllocationLamports: initialDepositLamports.sub(longAllocationLamports).toString() + ' lamports',
        });

        const deployMarketTx = await buildDeployMarketTx(program, {
          deployer: new PublicKey(walletAddress),
          contentId: contentId,
          initialDeposit: initialDepositLamports,
          longAllocation: longAllocationLamports,
          usdcMint,
        });

        console.log('[STEP 5/7] Transaction details:', {
          createPoolInstructions: createPoolTx?.instructions.length || 0,
          deployMarketInstructions: deployMarketTx.instructions.length,
          isOrphaned,
        });

        // Combine instructions into a single atomic transaction
        console.log('[STEP 5/7] Combining instructions into one atomic transaction...');
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
        console.log('[STEP 5/7] Preparing combined transaction...');
        let blockhashData = await connection.getLatestBlockhash();
        combinedTx.recentBlockhash = blockhashData.blockhash;
        combinedTx.lastValidBlockHeight = blockhashData.lastValidBlockHeight;
        combinedTx.feePayer = new PublicKey(walletAddress);

        console.log('[STEP 5/7] ✅ Combined transaction prepared with', combinedTx.instructions.length, 'instructions');

        // Step 3: Sign and send ONE atomic transaction
        console.log('[STEP 6/7] ✍️  Requesting wallet signature...');
        console.log('[STEP 6/7] Wallet interface check:', {
          address: wallet.address,
          chainType: wallet.chainType,
          walletClientType: wallet.walletClientType,
          hasSignTransaction: typeof wallet.signTransaction === 'function',
        });

        if (!wallet.signTransaction) {
          console.error('[STEP 6/7] ❌ Wallet missing signTransaction method!');
          throw new Error('Wallet does not support signing transactions. Please reconnect your wallet.');
        }

        let txSignature: string;

        try {
          console.log('[STEP 6/7] 🔐 Signing transaction...');
          const signedTx = await wallet.signTransaction(combinedTx);

          console.log('[STEP 6/7] ✅ Transaction signed!');

          // Send the transaction
          console.log('[STEP 6/7] 📤 Sending transaction...');
          txSignature = await connection.sendRawTransaction(signedTx.serialize());
          console.log('[STEP 6/7] ✅ Transaction sent! Signature:', txSignature);

          // Wait for confirmation
          console.log('[STEP 6/7] ⏳ Waiting for confirmation...');
          await connection.confirmTransaction(txSignature, 'confirmed');
          console.log('[STEP 6/7] ✅ Transaction confirmed!');
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

        console.log('[STEP 7/7] ⏳ Transaction confirmed!');

        const poolPda = pdaHelper.getContentPoolPda(contentId)[0];
        const poolAddress = poolPda.toBase58();

        // Fetch pool state to get ICBS parameters and mint addresses
        console.log('[STEP 7/7] 📊 Fetching pool state from chain...');
        console.log('[STEP 7/7] Pool PDA:', poolAddress);

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

        console.log('[useDeployPool] Pool account data:', {
          longMint: poolAccount.longMint?.toString(),
          shortMint: poolAccount.shortMint?.toString(),
          vault: poolAccount.vault?.toString(),
        });

        if (!poolAccount.longMint || !poolAccount.shortMint || !poolAccount.vault) {
          throw new Error('Pool state not fully initialized - mints or vault missing');
        }

        const longMintAddress = poolAccount.longMint.toBase58();
        const shortMintAddress = poolAccount.shortMint.toBase58();
        const usdcVaultAddress = poolAccount.vault.toBase58();

        // Step 4: Record in database
        console.log('[useDeployPool] Recording deployment...');
        console.log('[useDeployPool] Token supplies from on-chain:', {
          sLong: poolAccount.sLong?.toString(),
          sShort: poolAccount.sShort?.toString(),
        });

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
            sqrtLambdaX96: poolAccount.sqrtLambdaLongX96?.toString(), // Use sqrt_lambda_long (same as short)
            sqrtPriceLongX96: poolAccount.sqrtPriceLongX96?.toString(),
            sqrtPriceShortX96: poolAccount.sqrtPriceShortX96?.toString(),
          }),
        });

        if (!recordResponse.ok) {
          const errorData = await recordResponse.json();
          console.error('[useDeployPool] Recording failed:', errorData);
          throw new Error(`Failed to record deployment: ${errorData.error || 'Unknown error'}`);
        }

        const recordData = await recordResponse.json();
        console.log('[useDeployPool] Recording successful:', recordData);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ [DEPLOY POOL] SUCCESS!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Pool Address:', poolAddress);
        console.log('Transaction Signature:', txSignature);
        console.log('Record ID:', recordData.recordId);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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
