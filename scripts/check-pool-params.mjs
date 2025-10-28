import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const IDL = JSON.parse(readFileSync('./src/lib/solana/target/idl/veritas_curation.json', 'utf-8'));
const connection = new Connection('http://127.0.0.1:8899');
const provider = new anchor.AnchorProvider(connection, {} , {});
const program = new anchor.Program(IDL, provider);

// Get a pool address from database
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const { data: pools } = await supabase.from('pool_deployments').select('pool_address, post_id, f, beta_num, beta_den').limit(1);
if (!pools || pools.length === 0) {
  console.log('No pools found in database');
  process.exit(0);
}

const poolAddress = new PublicKey(pools[0].pool_address);
console.log('Checking pool:', pools[0].pool_address);
console.log('Post ID:', pools[0].post_id);
console.log('\nDatabase values:');
console.log('f:', pools[0].f);
console.log('beta_num:', pools[0].beta_num);
console.log('beta_den:', pools[0].beta_den);

const pool = await program.account.contentPool.fetch(poolAddress);
console.log('\nOn-chain values:');
console.log('f:', pool.f);
console.log('beta_num:', pool.betaNum);
console.log('beta_den:', pool.betaDen);
console.log('s_long:', pool.sLong.toString());
console.log('s_short:', pool.sShort.toString());