import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { VeritasCuration } from "../target/types/veritas_curation";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  createMint,
} from "@solana/spl-token";
import * as fs from "fs";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VeritasCuration as Program<VeritasCuration>;
  const payer = provider.wallet as anchor.Wallet;

  console.log("Reading deployment config...");
  const deploymentConfig = JSON.parse(
    fs.readFileSync(".local-deployment.json", "utf-8")
  );

  const factoryPda = new PublicKey(deploymentConfig.factory.address);
  const custodianPda = new PublicKey(deploymentConfig.custodian.address);
  const usdcVaultPda = new PublicKey(deploymentConfig.custodian.usdcVault);

  // Get USDC mint from environment
  const usdcMintStr = process.env.USDC_MINT_LOCALNET;
  if (!usdcMintStr) {
    throw new Error("USDC_MINT_LOCALNET not set");
  }
  const usdcMint = new PublicKey(usdcMintStr);

  console.log("Creating test pool...");
  const contentId = Keypair.generate().publicKey;
  console.log("Content ID:", contentId.toBase58());

  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("content_pool"), contentId.toBuffer()],
    program.programId
  );

  const [registryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("registry"), contentId.toBuffer()],
    program.programId
  );

  // Create pool
  console.log("Creating pool...");
  await program.methods
    .createPool(contentId)
    .accounts({
      factory: factoryPda,
      pool: poolPda,
      registry: registryPda,
      custodian: custodianPda,
      creator: payer.publicKey,
      postCreator: payer.publicKey,
      payer: payer.publicKey,
    })
    .rpc();

  console.log("Pool created:", poolPda.toBase58());

  // Create token mints for LONG and SHORT
  console.log("Creating LONG mint...");
  const longMint = await createMint(
    provider.connection,
    payer.payer,
    poolPda,
    null,
    6
  );

  console.log("Creating SHORT mint...");
  const shortMint = await createMint(
    provider.connection,
    payer.payer,
    poolPda,
    null,
    6
  );

  // Get or create user's USDC account
  const userUsdcAccount = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer.payer,
    usdcMint,
    payer.publicKey
  );

  console.log("User USDC account:", userUsdcAccount.address.toBase58());
  console.log("User USDC balance:", userUsdcAccount.amount.toString());

  // Deploy market with test parameters
  const initialDeposit = new BN(50_000_000); // 50 USDC
  const allocationBps = 9600; // 96% LONG allocation
  const sigmaInitial = new BN(1_000_000); // 1.0 (in 6 decimals)

  console.log("\n=== Deploying market with parameters ===");
  console.log("Initial deposit:", initialDeposit.toString(), "micro-USDC");
  console.log("Allocation:", allocationBps, "bps (96% LONG)");
  console.log("Sigma initial:", sigmaInitial.toString());

  const tx = await program.methods
    .deployMarket(initialDeposit, allocationBps, sigmaInitial)
    .accounts({
      pool: poolPda,
      longMint: longMint,
      shortMint: shortMint,
      custodian: custodianPda,
      usdcVault: usdcVaultPda,
      usdcMint: usdcMint,
      userUsdcAccount: userUsdcAccount.address,
      user: payer.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  console.log("\n=== Market deployed! ===");
  console.log("Transaction:", tx);

  // Fetch and display pool state
  const poolData = await program.account.contentPool.fetch(poolPda);
  console.log("\n=== Pool State ===");
  console.log("s_long:", poolData.sLong.toString());
  console.log("s_short:", poolData.sShort.toString());
  console.log("sqrt_lambda_long_x96:", poolData.sqrtLambdaLongX96.toString());
  console.log("sqrt_lambda_short_x96:", poolData.sqrtLambdaShortX96.toString());
  console.log("vault_balance:", poolData.vaultBalance.toString());

  // Calculate expected values
  const sLong = Number(poolData.sLong.toString());
  const sShort = Number(poolData.sShort.toString());
  const n2 = sLong * sLong + sShort * sShort;
  const norm = Math.sqrt(n2);

  console.log("\n=== Expected Values ===");
  console.log("n² =", n2);
  console.log("norm =", norm);

  // Expected lambda: (D * Q96 * norm) / n²
  const D = 50_000_000;
  const Q96 = BigInt(2) ** BigInt(96);
  const expectedLambdaQ96 = (BigInt(D) * Q96 * BigInt(Math.floor(norm))) / BigInt(n2);
  const expectedSqrtLambdaX96 = sqrt128(expectedLambdaQ96) << BigInt(48);

  console.log("Expected lambda_q96:", expectedLambdaQ96.toString());
  console.log("Expected sqrt_lambda_x96:", expectedSqrtLambdaX96.toString());

  const actualSqrtLambda = BigInt(poolData.sqrtLambdaLongX96.toString());
  const ratio = Number(expectedSqrtLambdaX96) / Number(actualSqrtLambda);

  console.log("\n=== Comparison ===");
  console.log("Ratio (expected/actual):", ratio.toFixed(2) + "x");

  if (Math.abs(ratio - 1.0) > 0.1) {
    console.log("\n⚠️  WARNING: Lambda mismatch detected!");
  } else {
    console.log("\n✅ Lambda values match!");
  }
}

// Integer square root for bigint
function sqrt128(value: bigint): bigint {
  if (value < 0n) {
    throw new Error("Square root of negative number");
  }
  if (value < 2n) {
    return value;
  }

  let x = value;
  let y = (x + 1n) / 2n;

  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }

  return x;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
