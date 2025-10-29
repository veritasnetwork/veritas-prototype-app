import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import idl from '../src/lib/solana/target/idl/veritas_curation.json';
import { formatPoolAccountData } from '../src/lib/solana/sqrt-price-helpers';

async function debugReserveParsing() {
  const connection = new Connection('http://localhost:8899', 'confirmed');
  const poolAddress = new PublicKey('Ck5gGkp4s9KdDkauLJwZZyZah8FdQ79sXnXpJLeJ63EG');

  // Create a dummy wallet for the provider
  const dummyKeypair = Keypair.generate();
  const wallet = {
    publicKey: dummyKeypair.publicKey,
    signTransaction: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(tx: T): Promise<T> => {
      if ('sign' in tx && typeof tx.sign === 'function') {
        tx.sign([dummyKeypair]);
      }
      return tx;
    },
    signAllTransactions: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(txs: T[]): Promise<T[]> => {
      return txs.map(tx => {
        if ('sign' in tx && typeof tx.sign === 'function') {
          tx.sign([dummyKeypair]);
        }
        return tx;
      });
    },
  };

  const provider = new anchor.AnchorProvider(connection, wallet as anchor.Wallet, {});
  const program = new anchor.Program(idl as anchor.Idl, provider);

  try {
    // Fetch pool account using Anchor's deserializer
    const poolData = await program.account.contentPool.fetch(poolAddress);

    console.log('\n=== RAW POOL DATA FROM CHAIN ===');
    console.log('rLong (raw BN):', poolData.rLong);
    console.log('rShort (raw BN):', poolData.rShort);

    // Manually parse the BN values
    console.log('\n=== MANUAL BN PARSING ===');
    if (poolData.rLong && typeof poolData.rLong === 'object') {
      if ('toNumber' in poolData.rLong) {
        console.log('rLong.toNumber():', poolData.rLong.toNumber());
        console.log('rLong in USDC:', poolData.rLong.toNumber() / 1_000_000);
      }
      if ('toString' in poolData.rLong) {
        console.log('rLong.toString(10):', poolData.rLong.toString(10));
        console.log('rLong.toString(16):', poolData.rLong.toString(16));
      }
      if ('_bn' in poolData.rLong) {
        console.log('rLong._bn:', poolData.rLong._bn);
      }
    }

    if (poolData.rShort && typeof poolData.rShort === 'object') {
      if ('toNumber' in poolData.rShort) {
        console.log('rShort.toNumber():', poolData.rShort.toNumber());
        console.log('rShort in USDC:', poolData.rShort.toNumber() / 1_000_000);
      }
      if ('toString' in poolData.rShort) {
        console.log('rShort.toString(10):', poolData.rShort.toString(10));
        console.log('rShort.toString(16):', poolData.rShort.toString(16));
      }
      if ('_bn' in poolData.rShort) {
        console.log('rShort._bn:', poolData.rShort._bn);
      }
    }

    // Now test our formatPoolAccountData function
    console.log('\n=== formatPoolAccountData OUTPUT ===');
    const formatted = formatPoolAccountData(poolData);
    console.log('formatted.rLong:', formatted.rLong);
    console.log('formatted.rShort:', formatted.rShort);
    console.log('formatted._raw.rLong:', formatted._raw.rLong);
    console.log('formatted._raw.rShort:', formatted._raw.rShort);

    // Check if the issue is in the sync function
    console.log('\n=== SYNC FUNCTION TEST ===');
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

    const { syncPoolFromChain } = await import('../src/lib/solana/sync-pool-from-chain');
    const result = await syncPoolFromChain(poolAddress.toString(), connection, 10000, true);

    if (result) {
      console.log('Sync result r_long:', result.r_long);
      console.log('Sync result r_short:', result.r_short);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

debugReserveParsing();