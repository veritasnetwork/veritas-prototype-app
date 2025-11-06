import { NextResponse } from 'next/server';

export async function GET() {
  // Test price calculation with actual values from your pools
  const testPools = [
    {
      pool_address: "45NMjDDnfNpK1Mi69js234xk6CrfJEZccpBjtFxB89Fe",
      sqrt_price_long_x96: "75628169538636796668660995325952",
      sqrt_price_short_x96: "82396263801372326422408226406400",
      r_long: 22.779701,
      r_short: 32.095799
    },
    {
      pool_address: "3XPm13mYXQtceBiVv7afTz9LscEypRSp5QMXjyV166sE",
      sqrt_price_long_x96: "83844865285344239164264298840064",
      sqrt_price_short_x96: "72376846082971193336552577040384",
      r_long: 39.076958,
      r_short: 21.697797
    }
  ];

  // Calculate price from sqrt_price_x96
  const calculatePriceFromSqrt = (sqrtPriceX96String: string): number => {
    try {
      const sqrtPriceX96 = BigInt(sqrtPriceX96String);
      const Q96 = BigInt(2) ** BigInt(96);

      // price = (sqrtPrice / Q96)^2
      const priceQ192 = sqrtPriceX96 * sqrtPriceX96;
      const Q192 = Q96 * Q96;

      // Convert to number with 6 decimal places
      const price = Number(priceQ192 * BigInt(1000000) / Q192) / 1000000;
      return price;
    } catch (e) {
      return 0;
    }
  };

  const results = testPools.map(pool => {
    const priceLong = calculatePriceFromSqrt(pool.sqrt_price_long_x96);
    const priceShort = calculatePriceFromSqrt(pool.sqrt_price_short_x96);

    // Calculate implied relevance: r_long / (r_long + r_short)
    const impliedRelevance = pool.r_long / (pool.r_long + pool.r_short);

    // Market prediction from prices
    const marketPrediction = priceLong / (priceLong + priceShort);

    return {
      pool: pool.pool_address.slice(0, 8) + "...",
      prices: {
        long: priceLong.toFixed(6),
        short: priceShort.toFixed(6),
        sum: (priceLong + priceShort).toFixed(6)
      },
      reserves: {
        r_long: pool.r_long.toFixed(2),
        r_short: pool.r_short.toFixed(2)
      },
      relevance: {
        implied: (impliedRelevance * 100).toFixed(1) + "%",
        market: (marketPrediction * 100).toFixed(1) + "%"
      },
      testValue: {
        "3_LONG_tokens": (3 * priceLong).toFixed(2),
        "10_LONG_tokens": (10 * priceLong).toFixed(2)
      }
    };
  });

  return NextResponse.json({
    calculated_prices: results,
    note: "Prices should sum close to 1.0 for a properly initialized pool"
  });
}