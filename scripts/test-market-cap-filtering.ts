import { fetchPoolStateWithDecay } from '../src/lib/solana/fetch-pool-data';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899';
  const pools = [
    { addr: 'FoE4GBED1kC6UpXXito4ih9qZTdCw9tCs7etDcsqGhPL', desc: '0 supplies' },
    { addr: '2LaFeJ6s3aDTDHC69u7BszuqJQUnuUfqjPj12FWNqi5M', desc: '0 supplies' },
    { addr: 'BbbZTALyMbxDwrV6PsZvNZfTxRrcHfRCJr1bupfmdX7T', desc: 'Has supplies' },
  ];

  const MIN_MARKET_CAP = 1_000_000; // $1 in micro-USDC

  console.log('\n=== Testing Market Cap Filtering ===\n');
  console.log('Filter rule: BOTH LONG and SHORT market caps must be < $1 to filter out\n');

  for (const { addr, desc } of pools) {
    try {
      console.log(`Pool: ${addr} (${desc})`);
      const state = await fetchPoolStateWithDecay(addr, rpcEndpoint);

      const sLong = state.sLong;
      const sShort = state.sShort;
      const priceLong = state.priceLong;
      const priceShort = state.priceShort;

      // Calculate market caps (supply is in atomic units, price is in USDC per token)
      const marketCapLong = sLong * priceLong;
      const marketCapShort = sShort * priceShort;

      // Market cap is already in USDC (supply * USDC per token = USDC)
      console.log(`  LONG: ${sLong} supply × $${priceLong.toFixed(4)} = $${marketCapLong.toFixed(2)} market cap`);
      console.log(`  SHORT: ${sShort} supply × $${priceShort.toFixed(4)} = $${marketCapShort.toFixed(2)} market cap`);

      // Convert MIN_MARKET_CAP to USDC for comparison
      const minMarketCapUsdc = MIN_MARKET_CAP / 1_000_000; // $1
      const shouldFilter = marketCapLong < minMarketCapUsdc && marketCapShort < minMarketCapUsdc;
      console.log(`  Result: ${shouldFilter ? '❌ FILTERED OUT' : '✅ SHOWS IN FEED'}`);
      console.log('');
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}\n`);
    }
  }
}

main().catch(console.error);
