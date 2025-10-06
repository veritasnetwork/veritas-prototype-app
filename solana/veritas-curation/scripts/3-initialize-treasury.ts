import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VeritasCuration } from "../target/types/veritas_curation";
import * as fs from "fs";
import * as path from "path";

/**
 * Step 3: Initialize Protocol Treasury
 *
 * Creates the protocol treasury account for collecting fees
 */

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VeritasCuration as Program<VeritasCuration>;

  console.log("=== Initialize Protocol Treasury ===\n");
  console.log("Network:", provider.connection.rpcEndpoint);
  console.log("Payer:", provider.wallet.publicKey.toBase58());

  // Load authority keypair
  const authorityPath = path.join(__dirname, "../keys/authority.json");
  if (!fs.existsSync(authorityPath)) {
    console.error("\n❌ Authority keypair not found at keys/authority.json");
    process.exit(1);
  }

  const authorityKeypair = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(authorityPath, "utf-8")))
  );

  console.log("Treasury Authority:", authorityKeypair.publicKey.toBase58());

  // Derive treasury PDA
  const [treasuryPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("treasury")],
    program.programId
  );

  console.log("Treasury PDA:", treasuryPda.toBase58());

  // Check if already initialized
  try {
    const existingTreasury = await program.account.protocolTreasury.fetch(treasuryPda);
    console.log("\n⚠️  Treasury already initialized!");
    console.log("Current authority:", existingTreasury.authority.toBase58());
    console.log("USDC Vault:", existingTreasury.usdcVault.toBase58());
    return;
  } catch (err) {
    // Not initialized yet, continue
  }

  // Get USDC mint address (you'll need to provide this based on network)
  // Devnet USDC: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
  // Mainnet USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
  const network = process.env.ANCHOR_PROVIDER_URL?.includes("devnet")
    ? "devnet"
    : process.env.ANCHOR_PROVIDER_URL?.includes("mainnet")
    ? "mainnet"
    : "localnet";

  let usdcMint: anchor.web3.PublicKey;

  if (network === "localnet") {
    // For localnet, create a mock USDC mint
    console.log("\n⚠️  Localnet detected. Creating mock USDC mint...");
    const { createMint } = require("@solana/spl-token");
    usdcMint = await createMint(
      provider.connection,
      authorityKeypair,
      authorityKeypair.publicKey,
      null,
      6 // USDC decimals
    );
    console.log("Mock USDC mint created:", usdcMint.toBase58());
  } else if (network === "devnet") {
    usdcMint = new anchor.web3.PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
  } else {
    usdcMint = new anchor.web3.PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  }

  console.log("\nUSDC Mint:", usdcMint.toBase58());

  // Derive treasury USDC vault PDA
  const [treasuryVault] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("treasury-vault")],
    program.programId
  );

  console.log("Treasury Vault:", treasuryVault.toBase58());

  try {
    const tx = await program.methods
      .initializeTreasury()
      .accounts({
        usdcMint: usdcMint,
        authority: authorityKeypair.publicKey,
        payer: provider.wallet.publicKey,
      })
      .signers([authorityKeypair])
      .rpc();

    console.log("\n✅ Treasury initialized!");
    console.log("Transaction:", tx);

    // Verify
    const treasuryAccount = await program.account.protocolTreasury.fetch(treasuryPda);
    console.log("\nVerified treasury:");
    console.log("  Authority:", treasuryAccount.authority.toBase58());
    console.log("  Vault:", treasuryAccount.usdcVault.toBase58());

    // Save deployment info
    const deploymentInfo = {
      network,
      treasuryPda: treasuryPda.toBase58(),
      treasuryVault: treasuryVault.toBase58(),
      usdcMint: usdcMint.toBase58(),
      authority: authorityKeypair.publicKey.toBase58(),
      initializedAt: new Date().toISOString(),
      transaction: tx,
    };

    fs.writeFileSync(
      path.join(__dirname, `../deployments/treasury-${network}.json`),
      JSON.stringify(deploymentInfo, null, 2)
    );

  } catch (err) {
    console.error("\n❌ Failed to initialize treasury:", err);
    throw err;
  }
}

main().then(() => {
  console.log("\n✅ Treasury initialization complete!");
  process.exit(0);
}).catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
