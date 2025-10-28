import { PublicKey, Connection } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import idl from '../src/lib/solana/target/idl/veritas_curation.json';

async function main() {
  const poolAddress = process.argv[2] || '2Exe9LSWkmEZMXxQx4sKF2GWLv8tPkHRhPGhguP8Lm8y';

  const connection = new Connection('http://127.0.0.1:8899');
  const dummyKeypair = Keypair.generate();
  const wallet = {
    publicKey: dummyKeypair.publicKey,
    signTransaction: async (tx: any) => { tx.sign([dummyKeypair]); return tx; },
    signAllTransactions: async (txs: any[]) => txs
  };
  const provider = new AnchorProvider(connection, wallet as any, {});
  const program = new Program(idl as any, provider);

  const poolPda = new PublicKey(poolAddress);
  const poolData = await program.account.contentPool.fetch(poolPda);

  console.log('Pool data for', poolAddress);
  console.log('  Vault:', poolData.vault.toBase58());
  console.log('  sLong:', poolData.sLong?.toString());
  console.log('  sShort:', poolData.sShort?.toString());
  console.log('  rLong:', poolData.rLong?.toString());
  console.log('  rShort:', poolData.rShort?.toString());
  console.log('  sqrtPriceLongX96:', poolData.sqrtPriceLongX96?.toString());
  console.log('  sqrtPriceShortX96:', poolData.sqrtPriceShortX96?.toString());

  // Check vault balance
  if (poolData.vault.toBase58() !== '11111111111111111111111111111111') {
    try {
      const vaultInfo = await connection.getTokenAccountBalance(poolData.vault);
      console.log('  Vault USDC balance (micro):', vaultInfo.value.amount);
      console.log('  Vault USDC balance (display):', vaultInfo.value.uiAmount);
    } catch (e) {
      console.log('  Vault balance: ERROR -', e);
    }
  } else {
    console.log('  Vault: NOT INITIALIZED');
  }
}

main().catch(console.error);