/**
 * Update PoolFactory Pool Authority
 *
 * Updates the pool_authority in the PoolFactory to use the dedicated authority keypair.
 * This authority is used to sign trade transactions for stake skimming validation.
 *
 * Usage: npx ts-node scripts/update-pool-authority.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { VeritasCuration } from "../target/types/veritas_curation";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🔧 Updating PoolFactory pool_authority...\n");

  // Setup provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VeritasCuration as Program<VeritasCuration>;
  const wallet = provider.wallet;

  console.log("📋 Program ID:", program.programId.toString());
  console.log("👤 Current Wallet:", wallet.publicKey.toString());
  console.log("");

  // Load the dedicated authority keypair
  const authorityKeyPath = path.join(__dirname, "../keys/authority.json");
  if (!fs.existsSync(authorityKeyPath)) {
    console.error("❌ Authority key not found at:", authorityKeyPath);
    console.log("   Generate one with: solana-keygen new -o", authorityKeyPath);
    process.exit(1);
  }

  const authorityKeyData = JSON.parse(fs.readFileSync(authorityKeyPath, "utf-8"));
  const authorityKeypair = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(authorityKeyData)
  );
  const newPoolAuthority = authorityKeypair.publicKey;

  console.log("🔑 New Pool Authority:", newPoolAuthority.toString());
  console.log("");

  // Get factory PDA
  const [factoryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("factory")],
    program.programId
  );
  console.log("🏭 Factory PDA:", factoryPda.toString());

  // Fetch current factory state
  try {
    const factoryAccount = await program.account.poolFactory.fetch(factoryPda);
    console.log("");
    console.log("📊 Current Factory State:");
    console.log("   Factory Authority:", factoryAccount.factoryAuthority.toString());
    console.log("   Pool Authority:", factoryAccount.poolAuthority.toString());
    console.log("");

    // Check if already set
    if (factoryAccount.poolAuthority.equals(newPoolAuthority)) {
      console.log("✅ Pool authority is already set to the dedicated authority key!");
      console.log("   No update needed.");
      return;
    }

    // Check if current wallet is the factory authority
    if (!factoryAccount.factoryAuthority.equals(wallet.publicKey)) {
      console.error("❌ Current wallet is not the factory authority!");
      console.log("   Factory Authority:", factoryAccount.factoryAuthority.toString());
      console.log("   Your Wallet:", wallet.publicKey.toString());
      console.log("");
      console.log("   You must use the factory authority wallet to update the pool authority.");
      process.exit(1);
    }

    // Update pool authority
    console.log("⚙️  Updating pool authority...");
    const tx = await program.methods
      .updatePoolAuthority(newPoolAuthority)
      .accounts({
        factory: factoryPda,
        authority: wallet.publicKey,
      })
      .rpc();

    console.log("✅ Pool authority updated!");
    console.log("   Signature:", tx);
    console.log("");

    // Verify update
    const updatedFactory = await program.account.poolFactory.fetch(factoryPda);
    console.log("📊 Updated Factory State:");
    console.log("   Factory Authority:", updatedFactory.factoryAuthority.toString());
    console.log("   Pool Authority:", updatedFactory.poolAuthority.toString());
    console.log("");

    // Update .local-deployment.json
    const deploymentPath = path.join(__dirname, "../.local-deployment.json");
    if (fs.existsSync(deploymentPath)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
      deployment.factory.poolAuthority = newPoolAuthority.toString();
      fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
      console.log("✅ Updated .local-deployment.json");
    }

    console.log("");
    console.log("🎉 Pool authority successfully updated!");
    console.log("");
    console.log("ℹ️  Next steps:");
    console.log("   1. Ensure PROTOCOL_AUTHORITY_KEY_PATH points to:", authorityKeyPath);
    console.log("   2. Test trades to verify the dual-signing flow works");

  } catch (err) {
    console.error("❌ Factory not found! Initialize the factory first.");
    console.error("   Run: npx ts-node scripts/initialize-factory.ts");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
