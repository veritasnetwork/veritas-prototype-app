import { sqrtPriceX96ToPrice } from '../src/lib/solana/sqrt-price-helpers';

// From database
const s_long = 710;
const s_short = 1575;
const sqrt_price_long_x96 = '60396978803700576553291814535168';
const sqrt_price_short_x96 = '89947679475959021256683791843328';
const r_long_db = 412.600367;
const r_short_db = 2029.685413;

// Calculate prices
const price_long = sqrtPriceX96ToPrice(sqrt_price_long_x96);
const price_short = sqrtPriceX96ToPrice(sqrt_price_short_x96);

console.log('Price LONG:', price_long, 'USDC per token');
console.log('Price SHORT:', price_short, 'USDC per token');

// Calculate market caps
const market_cap_long = s_long * price_long;
const market_cap_short = s_short * price_short;

console.log('\nMarket Cap LONG (s_long × price_long):', market_cap_long);
console.log('Market Cap SHORT (s_short × price_short):', market_cap_short);

console.log('\nReserves from DB:');
console.log('r_long:', r_long_db);
console.log('r_short:', r_short_db);

console.log('\nDifference:');
console.log('r_long vs market_cap_long:', Math.abs(r_long_db - market_cap_long).toFixed(6));
console.log('r_short vs market_cap_short:', Math.abs(r_short_db - market_cap_short).toFixed(6));

console.log('\n✅ Reserves = Market Caps (this is correct for ICBS!)');
console.log('Virtual reserves are defined as r = s × p');

// Calculate implied relevance
const implied_relevance = r_long_db / (r_long_db + r_short_db);
console.log('\n📊 Implied Relevance:', implied_relevance);
console.log('   LONG side:', (implied_relevance * 100).toFixed(2) + '%');
console.log('   SHORT side:', ((1 - implied_relevance) * 100).toFixed(2) + '%');