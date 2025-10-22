import { createClient } from '@supabase/supabase-js';

export interface StakeSkimParams {
  userId: string;
  walletAddress: string;
  poolAddress: string;
  tradeType: 'buy' | 'sell';
  tradeAmount: number;  // micro-USDC
  side: 'LONG' | 'SHORT';
}

export async function calculateStakeSkim(params: StakeSkimParams): Promise<number> {
  if (params.tradeType === 'sell') return 0;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: params.userId,
    p_wallet_address: params.walletAddress,
    p_pool_address: params.poolAddress,
    p_side: params.side,
    p_trade_amount_micro: params.tradeAmount
  });

  if (error) throw new Error(`Skim calculation failed: ${error.message}`);
  if (!data || data.length === 0) throw new Error('No skim result returned');

  return Math.max(0, Math.ceil(data[0].skim_amount));
}
