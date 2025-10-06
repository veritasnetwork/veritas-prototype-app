import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VeritasCuration } from "../target/types/veritas_curation";
import * as fs from "fs";
import * as path from "path";

/**
 * Step 1: Deploy the Veritas Curation program
 *
 * This script just verifies the program is deployed.
 * Actual deployment happens via `anchor deploy`
 */

async function main() {
  // Configure the client to use the network
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VeritasCuration as Program<VeritasCuration>;

  console.log("=== Veritas Curation Program Deployment ===\n");
  console.log("Network:", provider.connection.rpcEndpoint);
  console.log("Deployer:", provider.wallet.publicKey.toBase58());
  console.log("Program ID:", program.programId.toBase58());

  // Verify program is deployed
  try {
    const accountInfo = await provider.connection.getAccountInfo(program.programId);
    if (accountInfo) {
      console.log("\n✅ Program is deployed!");
      console.log("Program data length:", accountInfo.data.length, "bytes");

      // Save deployment info
      const deploymentDir = path.join(__dirname, "../deployments");
      if (!fs.existsSync(deploymentDir)) {
        fs.mkdirSync(deploymentDir, { recursive: true });
      }

      const network = process.env.ANCHOR_PROVIDER_URL?.includes("devnet")
        ? "devnet"
        : process.env.ANCHOR_PROVIDER_URL?.includes("mainnet")
        ? "mainnet"
        : "localnet";

      const deploymentInfo = {
        network,
        programId: program.programId.toBase58(),
        deployer: provider.wallet.publicKey.toBase58(),
        deployedAt: new Date().toISOString(),
        rpcEndpoint: provider.connection.rpcEndpoint
      };

      fs.writeFileSync(
        path.join(deploymentDir, `program-${network}.json`),
        JSON.stringify(deploymentInfo, null, 2)
      );

      console.log(`\nDeployment info saved to deployments/program-${network}.json`);
    } else {
      console.log("\n❌ Program not found. Run `anchor deploy` first.");
      process.exit(1);
    }
  } catch (err) {
    console.error("Error checking program:", err);
    process.exit(1);
  }
}

main().then(() => {
  console.log("\n✅ Program deployment verified!");
}).catch((err) => {
  console.error("Deployment verification failed:", err);
  process.exit(1);
});
