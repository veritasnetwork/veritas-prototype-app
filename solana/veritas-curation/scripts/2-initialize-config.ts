import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VeritasCuration } from "../target/types/veritas_curation";
import * as fs from "fs";
import * as path from "path";

/**
 * Step 2: Initialize ProtocolConfig
 *
 * Sets global parameters for all content pools
 */

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VeritasCuration as Program<VeritasCuration>;

  // Load config
  const configPath = path.join(__dirname, "../config/default.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const poolConfig = config.contentPool;

  console.log("=== Initialize Protocol Config ===\n");
  console.log("Network:", provider.connection.rpcEndpoint);
  console.log("Authority:", provider.wallet.publicKey.toBase58());

  // Load authority keypair from keys directory
  const authorityPath = path.join(__dirname, "../keys/authority.json");
  if (!fs.existsSync(authorityPath)) {
    console.error("\n❌ Authority keypair not found at keys/authority.json");
    console.log("\nGenerate one with:");
    console.log("  solana-keygen new --outfile solana/veritas-curation/keys/authority.json");
    process.exit(1);
  }

  const authorityKeypair = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(authorityPath, "utf-8")))
  );

  console.log("\nConfig Authority:", authorityKeypair.publicKey.toBase58());

  // Derive config PDA
  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  console.log("Config PDA:", configPda.toBase58());

  // Check if already initialized
  try {
    const existingConfig = await program.account.protocolConfig.fetch(configPda);
    console.log("\n⚠️  Config already initialized!");
    console.log("Current authority:", existingConfig.authority.toBase58());
    console.log("Default k_quadratic:", existingConfig.defaultKQuadratic.toString());
    console.log("Min trade amount:", existingConfig.minTradeAmount.toString());
    return;
  } catch (err) {
    // Not initialized yet, continue
  }

  console.log("\n📝 Initializing with parameters:");
  console.log("  Default k_quadratic:", poolConfig.defaultKQuadratic);
  console.log("  Min k_quadratic:", poolConfig.minKQuadratic);
  console.log("  Max k_quadratic:", poolConfig.maxKQuadratic);
  console.log("  Min trade amount:", poolConfig.minTradeAmount, "(1 USDC)");

  try {
    const tx = await program.methods
      .initializeConfig()
      .accounts({
        authority: authorityKeypair.publicKey,
        payer: provider.wallet.publicKey,
      })
      .signers([authorityKeypair])
      .rpc();

    console.log("\n✅ Config initialized!");
    console.log("Transaction:", tx);

    // Verify
    const configAccount = await program.account.protocolConfig.fetch(configPda);
    console.log("\nVerified config:");
    console.log("  Authority:", configAccount.authority.toBase58());
    console.log("  Default k_quadratic:", configAccount.defaultKQuadratic.toString());
    console.log("  Min k_quadratic:", configAccount.minKQuadratic.toString());
    console.log("  Max k_quadratic:", configAccount.maxKQuadratic.toString());
    console.log("  Min trade amount:", configAccount.minTradeAmount.toString());

    // Save deployment info
    const network = process.env.ANCHOR_PROVIDER_URL?.includes("devnet")
      ? "devnet"
      : process.env.ANCHOR_PROVIDER_URL?.includes("mainnet")
      ? "mainnet"
      : "localnet";

    const deploymentInfo = {
      network,
      configPda: configPda.toBase58(),
      authority: authorityKeypair.publicKey.toBase58(),
      parameters: {
        defaultKQuadratic: poolConfig.defaultKQuadratic,
        minKQuadratic: poolConfig.minKQuadratic,
        maxKQuadratic: poolConfig.maxKQuadratic,
        minTradeAmount: poolConfig.minTradeAmount,
      },
      initializedAt: new Date().toISOString(),
      transaction: tx,
    };

    fs.writeFileSync(
      path.join(__dirname, `../deployments/config-${network}.json`),
      JSON.stringify(deploymentInfo, null, 2)
    );

  } catch (err) {
    console.error("\n❌ Failed to initialize config:", err);
    throw err;
  }
}

main().then(() => {
  console.log("\n✅ Config initialization complete!");
  process.exit(0);
}).catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
