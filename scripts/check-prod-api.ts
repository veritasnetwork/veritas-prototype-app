/**
 * Check what the production holdings API is actually returning
 */

async function main() {
  const username = 'josh';
  const response = await fetch(`https://veritas.surf/api/users/${username}/holdings`);

  if (!response.ok) {
    console.error('API Error:', response.status, response.statusText);
    const text = await response.text();
    console.error('Response:', text);
    return;
  }

  const data = await response.json();

  console.log('\n📊 Holdings API Response:\n');
  console.log(`Total holdings: ${data.holdings?.length || 0}\n`);

  if (data.holdings && data.holdings.length > 0) {
    const holding = data.holdings[0];

    console.log('First holding structure:');
    console.log('========================');
    console.log('\npost object keys:', Object.keys(holding.post || {}));
    console.log('\npool object keys:', Object.keys(holding.pool || {}));
    console.log('\nholdings object keys:', Object.keys(holding.holdings || {}));

    console.log('\n\nFull first holding:');
    console.log('===================');
    console.log(JSON.stringify(holding, null, 2));

    console.log('\n\nChecking key fields:');
    console.log('====================');
    console.log('post.token_volume_usdc:', holding.post?.token_volume_usdc);
    console.log('pool.r_long:', holding.pool?.r_long);
    console.log('pool.r_short:', holding.pool?.r_short);
    console.log('pool.price_long:', holding.pool?.price_long);
    console.log('pool.price_short:', holding.pool?.price_short);
  }
}

main().catch(console.error);
