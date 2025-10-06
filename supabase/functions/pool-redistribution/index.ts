import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Connection, Keypair, PublicKey } from 'https://esm.sh/@solana/web3.js@1.87.6'
import * as anchor from 'https://esm.sh/@coral-xyz/anchor@0.29.0'
import { Program, AnchorProvider, Wallet } from 'https://esm.sh/@coral-xyz/anchor@0.29.0'
import { TOKEN_PROGRAM_ID } from 'https://esm.sh/@solana/spl-token@0.3.9'
import { Buffer } from 'https://deno.land/std@0.177.0/node/buffer.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PoolData {
  pool_address: string
  usdc_vault_address: string
  reserve: number
  belief_id: string
  delta_relevance: number | null
  certainty: number | null
}

interface ConfigValue {
  key: string
  value: string
}

interface PenaltyRewardAdjustment {
  poolAddress: string
  poolUsdcVault: string
  penaltyLamports: number
  rewardLamports: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Pool Redistribution Service Starting')

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Initialize Solana connection
    const rpcEndpoint = Deno.env.get('SOLANA_RPC_ENDPOINT') ?? 'http://127.0.0.1:8899'
    const programIdStr = Deno.env.get('SOLANA_PROGRAM_ID')

    if (!programIdStr) {
      console.log('⚠️  SOLANA_PROGRAM_ID not configured. Skipping pool redistribution.')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Solana not configured',
          penalties: 0,
          rewards: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const connection = new Connection(rpcEndpoint, 'confirmed')
    const programId = new PublicKey(programIdStr)

    // Load authority keypair
    const authoritySecretKey = Deno.env.get('SOLANA_AUTHORITY_SECRET_KEY')
    if (!authoritySecretKey) {
      throw new Error('SOLANA_AUTHORITY_SECRET_KEY not configured')
    }

    const secretKeyBytes = Uint8Array.from(JSON.parse(authoritySecretKey))
    const authorityKeypair = Keypair.fromSecretKey(secretKeyBytes)

    // Initialize Anchor program
    const wallet = new Wallet(authorityKeypair)
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
    anchor.setProvider(provider)

    // Load IDL
    const idlResponse = await fetch(
      new URL('../../../solana/veritas-curation/target/idl/veritas_curation.json', import.meta.url)
    )
    const idl = await idlResponse.json()
    const program = new Program(idl, programId, provider)

    // Derive treasury PDA
    const [treasuryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury')],
      programId
    )

    const [treasuryUsdcVaultAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury-vault')],
      programId
    )

    console.log('📋 Fetching pool deployments with certainty and delta_relevance...')

    // 1. Get all confirmed pools with delta_relevance and certainty
    const { data: pools, error: poolsError } = await supabaseClient
      .from('pool_deployments')
      .select(`
        pool_address,
        usdc_vault_address,
        reserve,
        belief_id,
        beliefs!inner (
          delta_relevance,
          certainty
        )
      `)
      .not('deployment_tx_signature', 'is', null) // Only confirmed pools

    if (poolsError) {
      throw new Error(`Failed to fetch pools: ${poolsError.message}`)
    }

    if (!pools || pools.length === 0) {
      console.log('⚠️  No confirmed pools found. Skipping redistribution.')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pools to process',
          penalties: 0,
          rewards: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Found ${pools.length} confirmed pools`)

    // 2. Validate pool data
    const validPools = (pools as any[]).filter(pool => {
      const deltaR = pool.beliefs?.delta_relevance
      const certainty = pool.beliefs?.certainty
      const reserve = pool.reserve

      // Validate required fields exist
      if (deltaR === null || deltaR === undefined) {
        console.warn(`⚠️  Pool ${pool.pool_address} missing delta_relevance, skipping`)
        return false
      }
      if (certainty === null || certainty === undefined) {
        console.warn(`⚠️  Pool ${pool.pool_address} missing certainty, skipping`)
        return false
      }

      // Validate ranges
      if (certainty < 0 || certainty > 1) {
        console.warn(`⚠️  Pool ${pool.pool_address} has invalid certainty ${certainty}, skipping`)
        return false
      }
      if (deltaR < -1 || deltaR > 1) {
        console.warn(`⚠️  Pool ${pool.pool_address} has invalid delta_relevance ${deltaR}, skipping`)
        return false
      }
      if (reserve < 0) {
        console.warn(`⚠️  Pool ${pool.pool_address} has invalid reserve ${reserve}, skipping`)
        return false
      }

      return true
    })

    if (validPools.length === 0) {
      console.log('⚠️  No valid pools found after validation. Skipping redistribution.')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No valid pools to process',
          penalties: 0,
          rewards: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ ${validPools.length} pools validated`)

    // 3. Get config values
    const { data: configs, error: configsError } = await supabaseClient
      .from('configs')
      .select('key, value')
      .in('key', ['base_skim_rate', 'epoch_rollover_balance'])

    if (configsError) {
      throw new Error(`Failed to fetch configs: ${configsError.message}`)
    }

    const baseSkimRate = parseFloat(
      (configs as ConfigValue[]).find(c => c.key === 'base_skim_rate')?.value || '0.01'
    )
    let penaltyPot = parseFloat(
      (configs as ConfigValue[]).find(c => c.key === 'epoch_rollover_balance')?.value || '0'
    )

    console.log(`💰 Starting penalty pot: ${penaltyPot.toFixed(2)} USDC`)
    console.log(`📉 Base skim rate: ${(baseSkimRate * 100).toFixed(1)}%`)

    // 4. Calculate penalty rates and amounts
    const poolsWithPenalties = validPools.map(pool => {
      const deltaR = pool.beliefs.delta_relevance
      const certainty = pool.beliefs.certainty
      let penaltyRate = 0

      if (deltaR < 0) {
        penaltyRate = Math.min(Math.abs(deltaR) * certainty, 0.10)
      } else if (deltaR === 0) {
        penaltyRate = baseSkimRate
      }

      const penaltyAmount = (pool.reserve || 0) * penaltyRate
      penaltyPot += penaltyAmount

      return {
        pool_address: pool.pool_address,
        usdc_vault_address: pool.usdc_vault_address,
        reserve: pool.reserve || 0,
        deltaR,
        certainty,
        penaltyRate,
        penaltyAmountLamports: Math.floor(penaltyAmount * 1_000_000)
      }
    })

    // 4. Calculate reward distribution (probability simplex)
    const positivePools = poolsWithPenalties.filter(p => p.deltaR > 0)
    const poolsWithImpact = positivePools.map(p => ({
      ...p,
      impact: p.deltaR * p.certainty
    }))
    const totalPositiveImpact = poolsWithImpact.reduce((sum, p) => sum + p.impact, 0)

    let adjustments: PenaltyRewardAdjustment[]

    // 5. Update rollover balance FIRST (before transactions) to prevent double-spending on retry
    if (totalPositiveImpact > 0) {
      console.log(`📈 ${positivePools.length} pools with positive impact`)
      console.log(`🎯 Total positive impact: ${totalPositiveImpact.toFixed(4)}`)

      // Distribute rewards proportionally
      adjustments = poolsWithPenalties.map(pool => {
        let rewardAmountLamports = 0

        if (pool.deltaR > 0) {
          const impact = pool.deltaR * pool.certainty
          const rewardAmount = (penaltyPot * impact) / totalPositiveImpact
          rewardAmountLamports = Math.floor(rewardAmount * 1_000_000)
        }

        return {
          poolAddress: pool.pool_address,
          poolUsdcVault: pool.usdc_vault_address,
          penaltyLamports: pool.penaltyAmountLamports,
          rewardLamports: rewardAmountLamports
        }
      })

      // Reset rollover BEFORE applying transactions (idempotent)
      console.log(`💾 Resetting rollover balance to 0`)
      const { error: rolloverResetError } = await supabaseClient
        .from('configs')
        .update({ value: '0' })
        .eq('key', 'epoch_rollover_balance')

      if (rolloverResetError) {
        console.error('⚠️  Failed to reset rollover balance:', rolloverResetError.message)
        throw new Error(`Critical: Failed to update rollover balance: ${rolloverResetError.message}`)
      }

    } else {
      // No winners - rollover
      console.log(`⏭️  No positive impact. Rolling over ${penaltyPot.toFixed(2)} USDC to next epoch.`)

      // Only apply penalties
      adjustments = poolsWithPenalties.map(pool => ({
        poolAddress: pool.pool_address,
        poolUsdcVault: pool.usdc_vault_address,
        penaltyLamports: pool.penaltyAmountLamports,
        rewardLamports: 0
      }))

      // Update rollover BEFORE applying penalties (idempotent)
      console.log(`💾 Updating rollover balance to ${penaltyPot.toFixed(2)}`)
      const { error: rolloverUpdateError } = await supabaseClient
        .from('configs')
        .update({ value: penaltyPot.toString() })
        .eq('key', 'epoch_rollover_balance')

      if (rolloverUpdateError) {
        console.error('⚠️  Failed to update rollover balance:', rolloverUpdateError.message)
        throw new Error(`Critical: Failed to update rollover balance: ${rolloverUpdateError.message}`)
      }
    }

    // 6. Phase 1: Apply penalties
    const penalties = adjustments.filter(a => a.penaltyLamports > 0)
    console.log(`\n🔥 Phase 1: Applying ${penalties.length} penalties`)

    const penaltySignatures: string[] = []
    const failedPenalties: Array<{pool: string, error: string}> = []

    for (const { poolAddress, poolUsdcVault, penaltyLamports } of penalties) {
      try {
        const signature = await program.methods
          .applyPoolPenalty(new anchor.BN(penaltyLamports))
          .accounts({
            pool: new PublicKey(poolAddress),
            treasury: treasuryPDA,
            poolUsdcVault: new PublicKey(poolUsdcVault),
            treasuryUsdcVault: treasuryUsdcVaultAddress,
            tokenProgram: TOKEN_PROGRAM_ID,
            authority: authorityKeypair.publicKey,
          })
          .signers([authorityKeypair])
          .rpc()

        penaltySignatures.push(signature)
        console.log(`  ✅ Penalty applied to ${poolAddress.slice(0, 8)}...: ${(penaltyLamports / 1_000_000).toFixed(2)} USDC`)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`  ❌ Failed to apply penalty to ${poolAddress}:`, errorMsg)
        failedPenalties.push({ pool: poolAddress, error: errorMsg })
      }
    }

    console.log(`\n✅ Phase 1 complete. ${penaltySignatures.length}/${penalties.length} penalties applied.`)
    if (failedPenalties.length > 0) {
      console.warn(`⚠️  ${failedPenalties.length} penalties failed (may need manual retry)`)
    }

    // 7. Phase 2: Apply rewards
    const rewards = adjustments.filter(a => a.rewardLamports > 0)
    console.log(`\n🎁 Phase 2: Distributing ${rewards.length} rewards`)

    const rewardSignatures: string[] = []
    const failedRewards: Array<{pool: string, error: string}> = []

    for (const { poolAddress, poolUsdcVault, rewardLamports } of rewards) {
      try {
        const signature = await program.methods
          .applyPoolReward(new anchor.BN(rewardLamports))
          .accounts({
            pool: new PublicKey(poolAddress),
            treasury: treasuryPDA,
            treasuryUsdcVault: treasuryUsdcVaultAddress,
            poolUsdcVault: new PublicKey(poolUsdcVault),
            tokenProgram: TOKEN_PROGRAM_ID,
            authority: authorityKeypair.publicKey,
          })
          .signers([authorityKeypair])
          .rpc()

        rewardSignatures.push(signature)
        console.log(`  ✅ Reward distributed to ${poolAddress.slice(0, 8)}...: ${(rewardLamports / 1_000_000).toFixed(2)} USDC`)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`  ❌ Failed to distribute reward to ${poolAddress}:`, errorMsg)
        failedRewards.push({ pool: poolAddress, error: errorMsg })
      }
    }

    console.log(`\n✅ Phase 2 complete. ${rewardSignatures.length}/${rewards.length} rewards distributed.`)
    if (failedRewards.length > 0) {
      console.warn(`⚠️  ${failedRewards.length} rewards failed (may need manual retry)`)
    }

    console.log(`\n🎉 Pool Redistribution Complete`)
    console.log(`   - Penalties: ${penaltySignatures.length}/${penalties.length}`)
    console.log(`   - Rewards: ${rewardSignatures.length}/${rewards.length}`)
    console.log(`   - Total transactions: ${penaltySignatures.length + rewardSignatures.length}`)

    return new Response(
      JSON.stringify({
        success: true,
        penalties: penaltySignatures.length,
        rewards: rewardSignatures.length,
        penaltyPot: penaltyPot,
        totalTransactions: penaltySignatures.length + rewardSignatures.length,
        failedPenalties,
        failedRewards,
        penaltySignatures,
        rewardSignatures
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Pool redistribution error:', error)
    return new Response(
      JSON.stringify({
        error: 'Pool redistribution failed',
        message: error.message,
        code: 500
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
