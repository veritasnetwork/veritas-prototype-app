import { NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = getSupabaseServiceRole();

    // Fetch ICBS pool config from system_config table
    const { data, error } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', [
        'default_pool_f',
        'default_pool_beta_num',
        'default_pool_beta_den',
        'default_pool_reserve_cap',
        'default_pool_linear_slope',
        'default_pool_virtual_liquidity',
        'default_pool_supply_offset'
      ]);

    if (error) {
      console.error('Error fetching pool config:', error);
      return NextResponse.json(
        { error: 'Failed to fetch pool config' },
        { status: 500 }
      );
    }

    // Convert array to object
    const config = data.reduce((acc, { key, value }) => {
      // Remove 'default_pool_' prefix and convert to number
      const configKey = key.replace('default_pool_', '');
      acc[configKey] = Number(value);
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error in pool config API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
