/**
 * Create Test Pool
 *
 * This script:
 * 1. Creates a test ContentPool via PoolFactory
 * 2. Deploys market with initial liquidity
 * 3. Verifies pool state
 *
 * Usage: npx ts-node scripts/create-test-pool.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { VeritasCuration } from "../target/types/veritas_curation";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Creating test pool...\n");

  // Setup provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VeritasCuration as Program<VeritasCuration>;
  const wallet = provider.wallet;

  console.log("📋 Program ID:", program.programId.toString());
  console.log("👤 Wallet:", wallet.publicKey.toString());
  console.log("");

  // Generate a test content ID
  const contentId = Keypair.generate().publicKey;
  console.log("📄 Test Content ID:", contentId.toString());

  // Get factory PDA
  const [factoryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("factory")],
    program.programId
  );

  // Get custodian PDA
  const [custodianPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("custodian")],
    program.programId
  );

  // Derive pool PDA
  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("content_pool"), contentId.toBuffer()],
    program.programId
  );
  console.log("🏊 Pool PDA:", poolPda.toString());

  // Derive registry PDA
  const [registryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("registry"), contentId.toBuffer()],
    program.programId
  );
  console.log("📋 Registry PDA:", registryPda.toString());
  console.log("");

  // Get USDC mint
  const usdcMintStr = process.env.USDC_MINT_LOCALNET || process.env.USDC_MINT_ADDRESS;
  if (!usdcMintStr) {
    throw new Error("USDC_MINT_LOCALNET not found in environment");
  }
  const usdcMint = new PublicKey(usdcMintStr);

  // Check if pool already exists
  try {
    await program.account.contentPool.fetch(poolPda);
    console.log("⚠️  Pool already exists for this content ID!");
    console.log("   Use a different content ID or check existing pool state.");
    return;
  } catch (err) {
    // Pool doesn't exist, continue
    console.log("✅ Pool doesn't exist yet, creating...");
  }

  // Get factory to verify it's initialized
  try {
    const factoryAccount = await program.account.poolFactory.fetch(factoryPda);
    console.log("✅ Factory verified");
    console.log("   Pool Authority:", factoryAccount.poolAuthority.toString());

    // Create pool via factory
    console.log("");
    console.log("⚙️  Creating pool via factory...");

    const tx = await program.methods
      .createPool(contentId)
      .accounts({
        factory: factoryPda,
        pool: poolPda,
        registry: registryPda,
        contentIdAccount: contentId,
        custodian: custodianPda,
        creator: wallet.publicKey,
        payer: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Pool created!");
    console.log("   Signature:", tx);
    console.log("");

    // Fetch and display pool details
    const poolAccount = await program.account.contentPool.fetch(poolPda);
    console.log("📊 Pool Details:");
    console.log("   Address:", poolPda.toString());
    console.log("   Content ID:", poolAccount.contentId.toString());
    console.log("   Creator:", poolAccount.creator.toString());
    console.log("   Factory:", poolAccount.factory.toString());
    console.log("   F:", poolAccount.f);
    console.log("   β:", `${poolAccount.betaNum}/${poolAccount.betaDen}`);
    console.log("   Market Deployer:", poolAccount.marketDeployer.toString());
    console.log("");

    // Now deploy market with initial liquidity
    console.log("💰 Deploying market with initial liquidity...");

    const initialDeposit = new BN(100_000_000); // 100 USDC
    const longAllocation = new BN(50_000_000);  // 50 USDC to LONG side

    // Derive mints
    const [longMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("long_mint"), contentId.toBuffer()],
      program.programId
    );

    const [shortMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("short_mint"), contentId.toBuffer()],
      program.programId
    );

    // Derive vault
    const [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), contentId.toBuffer()],
      program.programId
    );

    // Get deployer's USDC account
    const deployerUsdc = await getAssociatedTokenAddress(
      usdcMint,
      wallet.publicKey
    );

    // Get deployer's token accounts (will be created)
    const deployerLong = await getAssociatedTokenAddress(
      longMint,
      wallet.publicKey
    );

    const deployerShort = await getAssociatedTokenAddress(
      shortMint,
      wallet.publicKey
    );

    const deployTx = await program.methods
      .deployMarket(initialDeposit, longAllocation)
      .accounts({
        pool: poolPda,
        longMint: longMint,
        shortMint: shortMint,
        vault: vault,
        deployerUsdc: deployerUsdc,
        deployerLong: deployerLong,
        deployerShort: deployerShort,
        usdcMint: usdcMint,
        deployer: wallet.publicKey,
        payer: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Market deployed!");
    console.log("   Signature:", deployTx);
    console.log("");

    // Fetch updated pool details
    const updatedPool = await program.account.contentPool.fetch(poolPda);
    console.log("📊 Updated Pool Details:");
    console.log("   Market Deployer:", updatedPool.marketDeployer.toString());
    console.log("   LONG Mint:", updatedPool.longMint.toString());
    console.log("   SHORT Mint:", updatedPool.shortMint.toString());
    console.log("   Vault:", updatedPool.vault.toString());
    console.log("   Initial q:", updatedPool.initialQ.toString());
    console.log("");

    // Save test pool info
    const outputPath = path.join(__dirname, "../.local-deployment.json");
    let deploymentData: any = {};

    if (fs.existsSync(outputPath)) {
      deploymentData = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    }

    if (!deploymentData.testPools) {
      deploymentData.testPools = [];
    }

    deploymentData.testPools.push({
      contentId: contentId.toString(),
      poolAddress: poolPda.toString(),
      registryAddress: registryPda.toString(),
      longMint: longMint.toString(),
      shortMint: shortMint.toString(),
      vault: vault.toString(),
      marketDeployer: wallet.publicKey.toString(),
      createdAt: new Date().toISOString(),
    });

    fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
    console.log("💾 Saved test pool info to:", outputPath);
    console.log("");

    console.log("🎉 Test pool created and market deployed!");
    console.log("");
    console.log("📝 You can now:");
    console.log("   - Execute test trades");
    console.log("   - Test settlement");
    console.log("   - Test the full flow");

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
