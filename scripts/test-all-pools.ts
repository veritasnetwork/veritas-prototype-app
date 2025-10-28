import { fetchPoolStateWithDecay } from '../src/lib/solana/fetch-pool-data';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899';
  const poolAddresses = [
    { addr: 'FoE4GBED1kC6UpXXito4ih9qZTdCw9tCs7etDcsqGhPL', desc: '0 supplies' },
    { addr: '2LaFeJ6s3aDTDHC69u7BszuqJQUnuUfqjPj12FWNqi5M', desc: '0 supplies' },
    { addr: 'BbbZTALyMbxDwrV6PsZvNZfTxRrcHfRCJr1bupfmdX7T', desc: 'Has supplies (211, 1109)' },
  ];

  for (const { addr, desc } of poolAddresses) {
    try {
      console.log(`\n=== Pool: ${addr} (${desc}) ===`);
      const state = await fetchPoolStateWithDecay(addr, rpcEndpoint);

      console.log('✅ SUCCESS - Pool State:');
      console.log('  q (relevance):', state.q);
      console.log('  priceLong:', state.priceLong);
      console.log('  priceShort:', state.priceShort);
      console.log('  sLong:', state.sLong);
      console.log('  sShort:', state.sShort);
      console.log('  Total Vault:', state.rLong + state.rShort, `($${((state.rLong + state.rShort) / 1_000_000).toFixed(2)})`);
    } catch (error: any) {
      console.log('❌ FAILED:', error.message);
      if (error.simulationResponse) {
        console.log('   Simulation error:', error.simulationResponse.err);
      }
    }
  }
}

main().catch(console.error);
