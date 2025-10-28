import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import IDL from '../src/lib/solana/target/idl/veritas_curation.json';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

class NodeWallet {
  constructor(readonly payer: Keypair) {}
  async signTransaction(tx: any) { return tx; }
  async signAllTransactions(txs: any[]) { return txs; }
  get publicKey() { return this.payer.publicKey; }
}

async function main() {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899';
  const connection = new Connection(rpcUrl, 'confirmed');

  const dummyWallet = new NodeWallet(Keypair.generate());
  const provider = new AnchorProvider(connection, dummyWallet as any, { commitment: 'confirmed' });
  const program = new Program(IDL as any, provider);

  const pools = [
    { addr: 'FoE4GBED1kC6UpXXito4ih9qZTdCw9tCs7etDcsqGhPL', desc: '0 supplies' },
    { addr: '2LaFeJ6s3aDTDHC69u7BszuqJQUnuUfqjPj12FWNqi5M', desc: '0 supplies' },
    { addr: 'BbbZTALyMbxDwrV6PsZvNZfTxRrcHfRCJr1bupfmdX7T', desc: 'Has supplies' },
  ];

  for (const { addr, desc } of pools) {
    console.log(`\n=== Checking ${addr} (${desc}) ===`);
    try {
      const poolAccount = await program.account.contentPool.fetch(new PublicKey(addr));
      console.log('✅ Pool account exists and can be fetched!');
      console.log('  s_long:', poolAccount.sLong.toString());
      console.log('  s_short:', poolAccount.sShort.toString());
      console.log('  r_long:', poolAccount.rLong.toString());
      console.log('  r_short:', poolAccount.rShort.toString());
    } catch (err: any) {
      console.error('❌ Error fetching pool:', err.message);
    }
  }
}

main().catch(console.error);
