const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');

const IDL = JSON.parse(fs.readFileSync('/Users/josh/veritas/veritas-prototype-app/solana/veritas-curation/target/idl/veritas_curation.json'));

const connection = new Connection('http://127.0.0.1:8899');
const provider = new anchor.AnchorProvider(connection, {}, {});
const program = new anchor.Program(IDL, 'D1tNYkzevBrxRM9XNALUVAHU4Lg7W7YQkK8eFTxuMhRC', provider);

const poolAddress = new PublicKey('92pMRnonP3aR3wkf12WXT816E8JAJy4kKRHUVofCvDcf');

program.account.contentPool.fetch(poolAddress)
  .then(pool => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📡 ON-CHAIN Pool State:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Supplies:');
    console.log('  s_long:', pool.sLong.toString());
    console.log('  s_short:', pool.sShort.toString());
    console.log('Sqrt Prices:');
    console.log('  sqrt_price_long_x96:', pool.sqrtPriceLongX96.toString());
    console.log('  sqrt_price_short_x96:', pool.sqrtPriceShortX96.toString());
    console.log('Vault:');
    console.log('  vault_balance:', pool.vaultBalance.toString(), 'micro-USDC');
    console.log('  vault_balance:', (pool.vaultBalance.toNumber() / 1000000).toFixed(2), 'USDC');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  })
  .catch(err => console.error('Error:', err.message));
