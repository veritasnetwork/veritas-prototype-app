/**
 * Initialize PoolFactory
 *
 * This script:
 * 1. Initializes the PoolFactory singleton
 * 2. Sets factory authority (administrative control)
 * 3. Sets pool authority (operational control - signs trades, settlements)
 * 4. Sets custodian reference
 * 5. Sets default ICBS parameters (F=3, β=0.5)
 *
 * Usage: npx ts-node scripts/initialize-factory.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { VeritasCuration } from "../target/types/veritas_curation";
import fs from "fs";
import path from "path";
import { loadProtocolAuthority } from "./load-authority";

async function main() {
  console.log("🚀 Initializing PoolFactory...\n");

  // Setup provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VeritasCuration as Program<VeritasCuration>;
  const wallet = provider.wallet;

  console.log("📋 Program ID:", program.programId.toString());
  console.log("👤 Wallet:", wallet.publicKey.toString());
  console.log("");

  // Derive factory PDA
  const [factoryPda, factoryBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("factory")],
    program.programId
  );
  console.log("🏭 Factory PDA:", factoryPda.toString());

  // Derive custodian PDA (must exist)
  const [custodianPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("custodian")],
    program.programId
  );
  console.log("🏛️  Custodian PDA:", custodianPda.toString());
  console.log("");

  // Verify custodian exists
  try {
    await program.account.veritasCustodian.fetch(custodianPda);
    console.log("✅ Custodian verified");
  } catch (err) {
    console.error("❌ Custodian not found! Run initialize-custodian.ts first.");
    process.exit(1);
  }

  // Check if already initialized
  try {
    const factoryAccount = await program.account.poolFactory.fetch(factoryPda);
    console.log("⚠️  Factory already initialized!");
    console.log("   Protocol Authority:", factoryAccount.protocolAuthority.toString());
    console.log("   Protocol Treasury:", factoryAccount.protocolTreasury.toString());
    console.log("   Custodian:", factoryAccount.custodian.toString());
    console.log("   Total Pools:", factoryAccount.totalPools.toString());
    console.log("   Total Fee:", `${factoryAccount.totalFeeBps} bps`);
    console.log("   Creator Split:", `${factoryAccount.creatorSplitBps} bps`);
    console.log("   Default F:", factoryAccount.defaultF);
    console.log("   Default β:", `${factoryAccount.defaultBetaNum}/${factoryAccount.defaultBetaDen}`);
    console.log("");
    console.log("✅ Factory is ready!");
    return;
  } catch (err) {
    // Not initialized yet, continue
    console.log("📝 Factory not yet initialized, proceeding...");
  }

  // Initialize factory
  console.log("⚙️  Sending initialize transaction...");

  // Load protocol authority from environment variable
  const protocolAuthorityKeypair = loadProtocolAuthority();
  const protocolAuthority = protocolAuthorityKeypair.publicKey;

  // Use upgrade authority as protocol treasury for mainnet
  const protocolTreasury = wallet.publicKey;

  // Fee configuration from deployment.config.json:
  // 0.5% total fee (50 bps), 100% to creator (10000 bps of 10000)
  const totalFeeBps = 50;
  const creatorSplitBps = 10000;

  // Get program data PDA
  const [programDataAddress] = PublicKey.findProgramAddressSync(
    [program.programId.toBuffer()],
    new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
  );

  try {
    const tx = await program.methods
      .initializeFactory(
        protocolAuthority,
        custodianPda,
        totalFeeBps,
        creatorSplitBps,
        protocolTreasury
      )
      .accounts({
        upgradeAuthority: wallet.publicKey,
        programData: programDataAddress,
        payer: wallet.publicKey,
      })
      .rpc();

    console.log("✅ Transaction successful!");
    console.log("   Signature:", tx);
    console.log("");

    // Verify initialization
    const factoryAccount = await program.account.poolFactory.fetch(factoryPda);
    console.log("✅ Factory initialized successfully!");
    console.log("");
    console.log("📊 Factory Details:");
    console.log("   Address:", factoryPda.toString());
    console.log("   Protocol Authority:", factoryAccount.protocolAuthority.toString());
    console.log("   Protocol Treasury:", factoryAccount.protocolTreasury.toString());
    console.log("   Custodian:", factoryAccount.custodian.toString());
    console.log("   Total Pools:", factoryAccount.totalPools.toString());
    console.log("   Total Fee:", `${factoryAccount.totalFeeBps} bps`);
    console.log("   Creator Split:", `${factoryAccount.creatorSplitBps} bps`);
    console.log("");
    console.log("📐 Default ICBS Parameters:");
    console.log("   F (growth exponent):", factoryAccount.defaultF);
    console.log("   β (coupling coefficient):", `${factoryAccount.defaultBetaNum}/${factoryAccount.defaultBetaDen} = ${factoryAccount.defaultBetaNum / factoryAccount.defaultBetaDen}`);
    console.log("   Min Initial Deposit:", factoryAccount.minInitialDeposit.toString(), "lamports");
    console.log("   Min Settle Interval:", factoryAccount.minSettleInterval.toString(), "seconds");
    console.log("");

    // Save addresses to file for later use
    const outputPath = path.join(__dirname, "../.local-deployment.json");
    let deploymentData: any = {};

    if (fs.existsSync(outputPath)) {
      deploymentData = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    }

    deploymentData.factory = {
      address: factoryPda.toString(),
      protocolAuthority: factoryAccount.protocolAuthority.toString(),
      protocolTreasury: factoryAccount.protocolTreasury.toString(),
      custodian: factoryAccount.custodian.toString(),
      totalFeeBps: factoryAccount.totalFeeBps,
      creatorSplitBps: factoryAccount.creatorSplitBps,
      defaultF: factoryAccount.defaultF,
      defaultBetaNum: factoryAccount.defaultBetaNum,
      defaultBetaDen: factoryAccount.defaultBetaDen,
    };

    fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
    console.log("💾 Saved factory addresses to:", outputPath);
    console.log("");

    console.log("🎉 Setup complete!");
    console.log("");
    console.log("📝 Next steps:");
    console.log("   1. Use create-test-pool.ts to create a test pool");
    console.log("   2. Deploy market on the pool");
    console.log("   3. Execute test trades");

  } catch (error) {
    console.error("❌ Error initializing factory:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
