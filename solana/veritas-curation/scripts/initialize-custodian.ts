/**
 * Initialize VeritasCustodian
 *
 * Usage: npx ts-node scripts/initialize-custodian.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { VeritasCuration } from "../target/types/veritas_curation";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Initializing VeritasCustodian...\n");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VeritasCuration as Program<VeritasCuration>;
  const wallet = provider.wallet;

  console.log("📋 Program ID:", program.programId.toString());
  console.log("👤 Wallet:", wallet.publicKey.toString());

  // Get USDC mint from environment
  const usdcMintStr = process.env.USDC_MINT_LOCALNET || process.env.USDC_MINT_ADDRESS;
  if (!usdcMintStr) {
    throw new Error("USDC_MINT_LOCALNET or USDC_MINT_ADDRESS not set");
  }
  const usdcMint = new PublicKey(usdcMintStr);
  console.log("💵 USDC Mint:", usdcMint.toString());

  // Derive PDAs
  const [custodianPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("custodian")],
    program.programId
  );
  console.log("🏛️  Custodian PDA:", custodianPda.toString());

  const [usdcVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("custodian_vault")],
    program.programId
  );
  console.log("🔐 Vault PDA:", usdcVaultPda.toString());
  console.log("");

  // Check if already initialized
  try {
    const custodianAccount = await program.account.veritasCustodian.fetch(custodianPda);
    console.log("⚠️  Already initialized!");
    console.log("   Owner:", custodianAccount.owner.toString());
    console.log("   Protocol Authority:", custodianAccount.protocolAuthority.toString());
    console.log("✅ Custodian is ready!");
    return;
  } catch (err) {
    console.log("📝 Not yet initialized, proceeding...");
  }

  console.log("⚙️  Initializing...");
  try {
    const tx = await program.methods
      .initializeCustodian(
        wallet.publicKey,  // owner
        wallet.publicKey   // protocol_authority  
      )
      .accounts({
        usdcMint: usdcMint,
        payer: wallet.publicKey,
      })
      .rpc();

    console.log("✅ Transaction successful!");
    console.log("   Signature:", tx);

    const custodianAccount = await program.account.veritasCustodian.fetch(custodianPda);
    console.log("\n📊 Custodian Details:");
    console.log("   Address:", custodianPda.toString());
    console.log("   Owner:", custodianAccount.owner.toString());
    console.log("   Protocol Authority:", custodianAccount.protocolAuthority.toString());
    console.log("   USDC Vault:", custodianAccount.usdcVault.toString());

    // Save to file
    const outputPath = path.join(__dirname, "../.local-deployment.json");
    let deploymentData: any = {};
    if (fs.existsSync(outputPath)) {
      deploymentData = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    }
    deploymentData.custodian = {
      address: custodianPda.toString(),
      usdcVault: usdcVaultPda.toString(),
      owner: custodianAccount.owner.toString(),
      protocolAuthority: custodianAccount.protocolAuthority.toString(),
    };
    fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
    console.log("\n💾 Saved to:", outputPath);
    console.log("🎉 Setup complete!");
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
