/**
 * Debug test for lambda calculation in deploy_market
 *
 * This test reproduces the bug where lambda is 26x too small
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VeritasCuration } from "../target/types/veritas_curation";

describe("debug-lambda-calc", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VeritasCuration as Program<VeritasCuration>;

  it("calculates lambda correctly", async () => {
    const D = 50_000_000; // 50 USDC in micro-USDC
    const s_l = 116;
    const s_s = 24;
    const n2 = s_l * s_l + s_s * s_s; // 14,032

    console.log("Input values:");
    console.log("  D (initial_deposit):", D);
    console.log("  s_l:", s_l);
    console.log("  s_s:", s_s);
    console.log("  n^2:", n2);
    console.log("");

    // Calculate what lambda SHOULD be
    const Q96 = BigInt(2) ** BigInt(96);
    const norm = Math.floor(Math.sqrt(n2));

    const lambda_q96_expected = (BigInt(D) * Q96 * BigInt(norm)) / BigInt(n2);
    const sqrt_lambda_expected = isqrt(lambda_q96_expected) * (BigInt(2) ** BigInt(48));

    console.log("Expected values:");
    console.log("  norm:", norm);
    console.log("  lambda_q96:", lambda_q96_expected.toString());
    console.log("  sqrt_lambda_x96:", sqrt_lambda_expected.toString());
    console.log("");

    // Now deploy a pool and check what it actually stores
    // (You'd need to add the full deployment setup here)

    console.log("To fix: Check that deploy_market.rs lines 297-309 are calculating lambda correctly");
    console.log("The formula should be: lambda_q96 = (D * Q96 * norm) / n^2");
    console.log("But verify what's actually being computed!");
  });
});

function isqrt(n: bigint): bigint {
  if (n === 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}
