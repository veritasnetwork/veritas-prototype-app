import { NextResponse } from 'next/server';

export async function GET() {
  // Test price calculation with actual values from your pools
  const testPools = [
    {
      pool_address: "45NMjDDnfNpK1Mi69js234xk6CrfJEZccpBjtFxB89Fe",
      sqrt_price_long_x96: "75628169538636796668660995325952",
      sqrt_price_short_x96: "82396263801372326422408226406400",
      r_long: 22.779701,
      r_short: 32.095799,
      s_long: 25,
      s_short: 30
    }
  ];

  // Different calculation methods to find the right one
  const methods = [];

  const pool = testPools[0];

  // Method 1: Direct reserves ratio (what prices should approximate)
  methods.push({
    method: "Direct R ratio",
    description: "r_long/s_long and r_short/s_short",
    price_long: pool.r_long / pool.s_long,
    price_short: pool.r_short / pool.s_short
  });

  // Method 2: Original sqrt calculation
  {
    const sqrtPriceLong = BigInt(pool.sqrt_price_long_x96);
    const sqrtPriceShort = BigInt(pool.sqrt_price_short_x96);
    const Q96 = BigInt(2) ** BigInt(96);

    const priceLongQ192 = sqrtPriceLong * sqrtPriceLong;
    const priceShortQ192 = sqrtPriceShort * sqrtPriceShort;
    const Q192 = Q96 * Q96;

    methods.push({
      method: "Original sqrt (price = (sqrt/Q96)^2)",
      description: "What we're currently using",
      price_long: Number(priceLongQ192 * BigInt(1000000) / Q192) / 1000000,
      price_short: Number(priceShortQ192 * BigInt(1000000) / Q192) / 1000000
    });
  }

  // Method 3: Maybe it's already price * Q96, not sqrt(price) * Q96
  {
    const priceLongX96 = BigInt(pool.sqrt_price_long_x96);
    const priceShortX96 = BigInt(pool.sqrt_price_short_x96);
    const Q96 = BigInt(2) ** BigInt(96);

    methods.push({
      method: "Direct X96 (not sqrt)",
      description: "Treat as price * Q96, not sqrt",
      price_long: Number(priceLongX96 * BigInt(1000000) / Q96) / 1000000,
      price_short: Number(priceShortX96 * BigInt(1000000) / Q96) / 1000000
    });
  }

  // Method 4: Maybe it needs reciprocal or different scaling
  {
    const sqrtPriceLong = BigInt(pool.sqrt_price_long_x96);
    const sqrtPriceShort = BigInt(pool.sqrt_price_short_x96);
    const Q96 = BigInt(2) ** BigInt(96);
    const Q64 = BigInt(2) ** BigInt(64);

    // Try with Q64 instead
    const priceLongQ128 = sqrtPriceLong * sqrtPriceLong;
    const priceShortQ128 = sqrtPriceShort * sqrtPriceShort;
    const Q128 = Q64 * Q64;

    methods.push({
      method: "Q64 scaling",
      description: "Using Q64 instead of Q96",
      price_long: Number(priceLongQ128 * BigInt(1000000) / Q128) / 1000000,
      price_short: Number(priceShortQ128 * BigInt(1000000) / Q128) / 1000000
    });
  }

  // Method 5: Reciprocal of Q96
  {
    const sqrtPriceLong = BigInt(pool.sqrt_price_long_x96);
    const sqrtPriceShort = BigInt(pool.sqrt_price_short_x96);
    const Q96 = BigInt(2) ** BigInt(96);

    // price = (Q96 / sqrtPrice)^2
    const Q192 = Q96 * Q96;
    const sqrtLongSquared = sqrtPriceLong * sqrtPriceLong;
    const sqrtShortSquared = sqrtPriceShort * sqrtPriceShort;

    methods.push({
      method: "Reciprocal",
      description: "price = (Q96/sqrt)^2",
      price_long: sqrtLongSquared > 0 ? Number(Q192 * BigInt(1000000) / sqrtLongSquared) / 1000000 : 0,
      price_short: sqrtShortSquared > 0 ? Number(Q192 * BigInt(1000000) / sqrtShortSquared) / 1000000 : 0
    });
  }

  // Evaluate each method
  const results = methods.map(m => ({
    ...m,
    sum: (m.price_long + m.price_short).toFixed(6),
    ratio: (m.price_long / (m.price_long + m.price_short) * 100).toFixed(1) + "%",
    value_3_LONG: (3 * m.price_long).toFixed(2),
    looks_correct: Math.abs((m.price_long + m.price_short) - 1) < 0.1 ? "✅ YES" : "❌ NO"
  }));

  return NextResponse.json({
    pool_data: {
      r_long: pool.r_long,
      r_short: pool.r_short,
      s_long: pool.s_long,
      s_short: pool.s_short,
      expected_relevance: ((pool.r_long / (pool.r_long + pool.r_short)) * 100).toFixed(1) + "%"
    },
    calculation_methods: results,
    correct_method: "The one where sum ≈ 1.0 and prices are reasonable"
  });
}