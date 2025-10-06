import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VeritasCuration } from "../target/types/veritas_curation";
import * as fs from "fs";
import * as path from "path";

/**
 * Step 4: Initialize Pool Factory
 *
 * Creates the factory for permissionless pool creation
 */

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VeritasCuration as Program<VeritasCuration>;

  console.log("=== Initialize Pool Factory ===\n");
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

  console.log("Factory Authority:", authorityKeypair.publicKey.toBase58());
  console.log("Pool Authority:", authorityKeypair.publicKey.toBase58(), "(same for now)");

  // Derive factory PDA
  const [factoryPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("factory")],
    program.programId
  );

  console.log("Factory PDA:", factoryPda.toBase58());

  // Check if already initialized
  try {
    const existingFactory = await program.account.poolFactory.fetch(factoryPda);
    console.log("\n⚠️  Factory already initialized!");
    console.log("Factory authority:", existingFactory.factoryAuthority.toBase58());
    console.log("Pool authority:", existingFactory.poolAuthority.toBase58());
    console.log("Total pools created:", existingFactory.totalPools.toString());
    return;
  } catch (err) {
    // Not initialized yet, continue
  }

  try {
    const tx = await program.methods
      .initializeFactory(
        authorityKeypair.publicKey,  // factory_authority
        authorityKeypair.publicKey   // pool_authority (same for now)
      )
      .accounts({
        payer: provider.wallet.publicKey,
      })
      .rpc();

    console.log("\n✅ Factory initialized!");
    console.log("Transaction:", tx);

    // Verify
    const factoryAccount = await program.account.poolFactory.fetch(factoryPda);
    console.log("\nVerified factory:");
    console.log("  Factory authority:", factoryAccount.factoryAuthority.toBase58());
    console.log("  Pool authority:", factoryAccount.poolAuthority.toBase58());
    console.log("  Total pools:", factoryAccount.totalPools.toString());

    // Save deployment info
    const network = process.env.ANCHOR_PROVIDER_URL?.includes("devnet")
      ? "devnet"
      : process.env.ANCHOR_PROVIDER_URL?.includes("mainnet")
      ? "mainnet"
      : "localnet";

    const deploymentInfo = {
      network,
      factoryPda: factoryPda.toBase58(),
      factoryAuthority: authorityKeypair.publicKey.toBase58(),
      poolAuthority: authorityKeypair.publicKey.toBase58(),
      initializedAt: new Date().toISOString(),
      transaction: tx,
    };

    fs.writeFileSync(
      path.join(__dirname, `../deployments/factory-${network}.json`),
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("\n📝 Note: Anyone can now create pools through this factory!");

  } catch (err) {
    console.error("\n❌ Failed to initialize factory:", err);
    throw err;
  }
}

main().then(() => {
  console.log("\n✅ Factory initialization complete!");
  process.exit(0);
}).catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
