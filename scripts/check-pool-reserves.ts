import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import idl from '../src/lib/solana/target/idl/veritas_curation.json';

async function checkPoolReserves() {
  const connection = new Connection('http://localhost:8899', 'confirmed');
  const poolAddress = new PublicKey('CmpMo4z4iT5ZNx7trB5kt34wKZym6K8DyiMjrtfT6qWK');

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

    console.log('Raw pool data from chain:');
    console.log('-------------------------');
    console.log('r_long:', poolData.r_long);
    console.log('r_short:', poolData.r_short);
    console.log('rLong:', poolData.rLong);
    console.log('rShort:', poolData.rShort);
    console.log('s_long:', poolData.s_long);
    console.log('s_short:', poolData.s_short);
    console.log('sLong:', poolData.sLong);
    console.log('sShort:', poolData.sShort);
    console.log('vaultBalance:', poolData.vaultBalance);
    console.log('vault_balance:', poolData.vault_balance);
    console.log('sqrtPriceLongX96:', poolData.sqrtPriceLongX96?.toString());
    console.log('sqrtPriceShortX96:', poolData.sqrtPriceShortX96?.toString());

    // Check all field names
    console.log('\nAll field names in poolData:');
    console.log(Object.keys(poolData));

  } catch (error) {
    console.error('Error fetching pool:', error);
  }
}

checkPoolReserves();