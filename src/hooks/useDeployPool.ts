/**
 * useDeployPool Hook
 * Deploys a pool with initial liquidity in TWO sequential transactions
 *
 * First: create_pool (creates ContentPool via PoolFactory)
 * Second: deploy_market (deposits initial USDC, mints LONG/SHORT tokens)
 *
 * User signs both transactions at once, then they're sent sequentially.
 * This avoids stack overflow issues from combining complex instructions.
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
  signature: string; // deploy_market transaction signature (for backwards compat)
  createPoolSignature?: string; // create_pool transaction signature
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
          throw new Error(errorData.error || 'Validation failed');
        }

        const validationData = await validateRes.json();
        console.log('[STEP 4/7] ✅ Validation passed:', validationData);

        // Step 2: Build combined transaction (create_pool + deploy_market)
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

        // Build create_pool instruction
        const createPoolTx = await buildCreatePoolTx(
          program,
          new PublicKey(walletAddress),
          contentId,
          protocolAddresses
        );

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
          createPoolInstructions: createPoolTx.instructions.length,
          deployMarketInstructions: deployMarketTx.instructions.length,
        });

        // Set transaction metadata for create_pool
        console.log('[STEP 5/7] Preparing create_pool transaction...');
        let blockhashData = await connection.getLatestBlockhash();
        createPoolTx.recentBlockhash = blockhashData.blockhash;
        createPoolTx.lastValidBlockHeight = blockhashData.lastValidBlockHeight;
        createPoolTx.feePayer = new PublicKey(walletAddress);

        // Set transaction metadata for deploy_market
        console.log('[STEP 5/7] Preparing deploy_market transaction...');
        deployMarketTx.recentBlockhash = blockhashData.blockhash;
        deployMarketTx.lastValidBlockHeight = blockhashData.lastValidBlockHeight;
        deployMarketTx.feePayer = new PublicKey(walletAddress);

        console.log('[STEP 5/7] ✅ Both transactions prepared');

        // Step 3: Sign and send TWO transactions sequentially
        console.log('[STEP 6/7] ✍️  Requesting wallet signatures...');
        console.log('[STEP 6/7] Wallet interface check:', {
          address: wallet.address,
          chainType: wallet.chainType,
          walletClientType: wallet.walletClientType,
          hasSignTransaction: typeof wallet.signTransaction === 'function',
          hasSignAllTransactions: typeof wallet.signAllTransactions === 'function',
        });

        if (!wallet.signAllTransactions) {
          console.error('[STEP 6/7] ❌ Wallet missing signAllTransactions method!');
          throw new Error('Wallet does not support signing multiple transactions. Please reconnect your wallet.');
        }

        let createPoolSignature: string;
        let deployMarketSignature: string;

        try {
          console.log('[STEP 6/7] 🔐 Signing both transactions...');
          const [signedCreatePoolTx, signedDeployMarketTx] = await wallet.signAllTransactions([createPoolTx, deployMarketTx]);

          console.log('[STEP 6/7] ✅ Both transactions signed!');

          // Send create_pool first
          console.log('[STEP 6/7] 📤 Sending create_pool transaction...');
          createPoolSignature = await connection.sendRawTransaction(signedCreatePoolTx.serialize());
          console.log('[STEP 6/7] ✅ create_pool sent! Signature:', createPoolSignature);

          // Wait for create_pool to confirm
          console.log('[STEP 6/7] ⏳ Waiting for create_pool confirmation...');
          await connection.confirmTransaction(createPoolSignature, 'confirmed');
          console.log('[STEP 6/7] ✅ create_pool confirmed!');

          // Send deploy_market second
          console.log('[STEP 6/7] 📤 Sending deploy_market transaction...');
          deployMarketSignature = await connection.sendRawTransaction(signedDeployMarketTx.serialize());
          console.log('[STEP 6/7] ✅ deploy_market sent! Signature:', deployMarketSignature);

          // Wait for deploy_market to confirm
          console.log('[STEP 6/7] ⏳ Waiting for deploy_market confirmation...');
          await connection.confirmTransaction(deployMarketSignature, 'confirmed');
          console.log('[STEP 6/7] ✅ deploy_market confirmed!');
        } catch (signError: any) {
          console.error('[STEP 6/7] ❌ Signing/sending failed!');
          console.error('[STEP 6/7] Error details:', {
            name: signError?.name,
            message: signError?.message,
            code: signError?.code,
            stack: signError?.stack,
          });
          throw new Error(`Failed to sign/send transactions: ${signError?.message || 'Unknown error'}. Make sure Phantom is unlocked and try again.`);
        }

        console.log('[STEP 7/7] ⏳ Both transactions confirmed!');

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
            signature: deployMarketSignature,
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
        console.log('create_pool Transaction:', createPoolSignature);
        console.log('deploy_market Transaction:', deployMarketSignature);
        console.log('Record ID:', recordData.recordId);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return {
          poolAddress,
          signature: deployMarketSignature,
          createPoolSignature,
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
