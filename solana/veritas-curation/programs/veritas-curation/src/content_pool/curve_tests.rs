#[cfg(test)]
mod tests {
    use super::super::curve::*;

    #[test]
    fn test_buy_10_usdc_yields_310_tokens() {
        // Test: $10 USDC (10,000,000 micro-USDC) should yield ~310 tokens
        // Formula: s(10) = cbrt(3 * 10 / 1) * 100 = cbrt(30) * 100 ≈ 3.107 * 100 = 310.7 tokens
        let s0 = 0;
        let reserve0 = 0;
        let usdc_amount = 10_000_000; // $10 in micro-USDC
        let k = 1;

        let new_supply = calculate_buy_supply(s0, reserve0, usdc_amount, k).unwrap();

        // Expected: ~310 tokens = 310,000,000 atomic units
        // Allow for small rounding differences
        assert!(new_supply >= 310_000_000 && new_supply <= 311_000_000,
                "Expected ~310 tokens, got {} atomic units ({} tokens)",
                new_supply, new_supply / 1_000_000);
    }

    #[test]
    fn test_buy_1_usdc_yields_144_tokens() {
        // Test: $1 USDC should yield ~144 tokens at start
        // Formula: s(1) = cbrt(3 * 1 / 1) * 100 = cbrt(3) * 100 ≈ 1.442 * 100 = 144.2 tokens
        let s0 = 0;
        let reserve0 = 0;
        let usdc_amount = 1_000_000; // $1 in micro-USDC
        let k = 1;

        let new_supply = calculate_buy_supply(s0, reserve0, usdc_amount, k).unwrap();

        // Expected: ~144 tokens = 144,000,000 atomic units
        assert!(new_supply >= 143_000_000 && new_supply <= 145_000_000,
                "Expected ~144 tokens, got {} atomic units ({} tokens)",
                new_supply, new_supply / 1_000_000);
    }

    #[test]
    fn test_sell_all_tokens_recovers_most_usdc() {
        // Buy 310 tokens with $10, then sell all back
        let usdc_in = 10_000_000;
        let k = 1;

        // Buy phase
        let tokens = calculate_buy_supply(0, 0, usdc_in, k).unwrap();

        // Sell phase - sell all tokens back
        let usdc_out = calculate_sell_payout(tokens, 0, usdc_in, k).unwrap();

        // Should recover most of the USDC (some loss due to integer rounding in cbrt/cube operations)
        // We expect to recover at least $9 USDC
        assert!(usdc_out >= 9_000_000 && usdc_out <= usdc_in,
                "Expected to recover at least $9, got ${}.{:06}",
                usdc_out / 1_000_000, usdc_out % 1_000_000);
    }

    #[test]
    fn test_price_increases_with_supply() {
        // Price should follow P = k * s^2 / 1,000,000
        // Where s is shares (not atomic units) and P is in USDC per share
        let k = 1;

        // At 100 tokens
        let price_100 = calculate_price_with_floor(100_000_000, k).unwrap();

        // At 300 tokens
        let price_300 = calculate_price_with_floor(300_000_000, k).unwrap();

        // At 1000 tokens
        let price_1000 = calculate_price_with_floor(1_000_000_000, k).unwrap();

        // Prices should increase quadratically
        assert!(price_300 > price_100, "Price should increase with supply");
        assert!(price_1000 > price_300, "Price should continue increasing");

        // Verify quadratic relationship: p(3s) should be 9 * p(s)
        // Within rounding tolerance
        assert!(price_300 >= price_100 * 8 && price_300 <= price_100 * 10,
                "Price should increase quadratically");
    }

    #[test]
    fn test_dynamic_k_changes_price() {
        // Test that changing k affects the bonding curve
        let supply = 100_000_000; // 100 tokens

        let price_k1 = calculate_price_with_floor(supply, 1).unwrap();
        let price_k2 = calculate_price_with_floor(supply, 2).unwrap();
        let price_k5 = calculate_price_with_floor(supply, 5).unwrap();

        // Higher k means higher price for same supply
        assert!(price_k2 > price_k1, "Price should increase with k");
        assert!(price_k5 > price_k2, "Price should continue increasing with k");
        assert_eq!(price_k2, price_k1 * 2, "Price should scale linearly with k");
    }

    #[test]
    fn test_price_floor_enforcement() {
        // At very low supply, price floor should apply
        let k = 1;

        // 1 token - should be at floor
        let price_1 = calculate_price_with_floor(1_000_000, k).unwrap();
        assert_eq!(price_1, 100, "Price should be at floor (0.0001 USDC)");

        // 0.1 tokens - should still be at floor
        let price_0_1 = calculate_price_with_floor(100_000, k).unwrap();
        assert_eq!(price_0_1, 100, "Price should remain at floor");
    }

    #[test]
    fn test_incremental_buys() {
        // Multiple small buys should equal one large buy
        let k = 1;

        // One $10 buy
        let single_buy = calculate_buy_supply(0, 0, 10_000_000, k).unwrap();

        // Ten $1 buys
        let mut total_tokens = 0u128;
        let mut reserve = 0u128;

        for _ in 0..10 {
            let new_supply = calculate_buy_supply(total_tokens, reserve, 1_000_000, k).unwrap();
            total_tokens = new_supply;
            reserve += 1_000_000;
        }

        // Should be approximately equal (small rounding differences ok)
        let diff = if single_buy > total_tokens {
            single_buy - total_tokens
        } else {
            total_tokens - single_buy
        };

        assert!(diff < 1_000_000, // Less than 1 token difference
                "Single buy: {}, incremental buys: {}, diff: {}",
                single_buy, total_tokens, diff);
    }
}