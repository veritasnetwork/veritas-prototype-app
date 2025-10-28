import { fetchPoolStateWithDecay } from '../src/lib/solana/fetch-pool-data';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899';
  const poolAddress = 'FoE4GBED1kC6UpXXito4ih9qZTdCw9tCs7etDcsqGhPL';

  try {
    console.log('Fetching pool state with decay for:', poolAddress);
    const state = await fetchPoolStateWithDecay(poolAddress, rpcEndpoint);

    console.log('\nPool State:');
    console.log('  q (relevance):', state.q);
    console.log('  priceLong:', state.priceLong);
    console.log('  priceShort:', state.priceShort);
    console.log('  sLong:', state.sLong);
    console.log('  sShort:', state.sShort);
    console.log('  rLong:', state.rLong, `($${(state.rLong / 1_000_000).toFixed(2)})`);
    console.log('  rShort:', state.rShort, `($${(state.rShort / 1_000_000).toFixed(2)})`);
    console.log('  Total Vault:', state.rLong + state.rShort, `($${((state.rLong + state.rShort) / 1_000_000).toFixed(2)})`);
    console.log('  decayPending:', state.decayPending);
    console.log('  daysExpired:', state.daysExpired);
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);
