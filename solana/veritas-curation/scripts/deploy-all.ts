import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * Unified deployment script
 *
 * Runs all deployment steps in order:
 * 1. Verify program deployment
 * 2. Initialize protocol config
 * 3. Initialize treasury
 * 4. Initialize factory
 */

const SCRIPTS = [
  "1-deploy-program.ts",
  "2-initialize-config.ts",
  "3-initialize-treasury.ts",
  "4-initialize-factory.ts",
];

async function main() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║     Veritas Curation Protocol - Full Deployment       ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  const network = process.env.ANCHOR_PROVIDER_URL?.includes("devnet")
    ? "devnet"
    : process.env.ANCHOR_PROVIDER_URL?.includes("mainnet")
    ? "mainnet"
    : "localnet";

  console.log(`Network: ${network}`);
  console.log(`RPC: ${process.env.ANCHOR_PROVIDER_URL || "default"}\n`);

  // Check for authority keypair
  const authorityPath = path.join(__dirname, "../keys/authority.json");
  if (!fs.existsSync(authorityPath)) {
    console.error("❌ Authority keypair not found!");
    console.log("\n📝 Generate one with:");
    console.log("   solana-keygen new --outfile solana/veritas-curation/keys/authority.json\n");
    console.log("⚠️  IMPORTANT: Back up this keypair securely!");
    console.log("   This keypair controls all protocol authorities.\n");
    process.exit(1);
  }

  console.log("✅ Authority keypair found\n");
  console.log("═".repeat(56));

  for (let i = 0; i < SCRIPTS.length; i++) {
    const script = SCRIPTS[i];
    const step = i + 1;

    console.log(`\n[${ step}/${SCRIPTS.length}] Running ${script}...\n`);

    try {
      execSync(`npx ts-node ${path.join(__dirname, script)}`, {
        stdio: "inherit",
        env: process.env,
      });
    } catch (err) {
      console.error(`\n❌ Step ${step} failed: ${script}`);
      console.error(err);
      process.exit(1);
    }

    console.log(`\n✅ Step ${step} complete`);
    console.log("═".repeat(56));
  }

  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║           🎉 Deployment Complete! 🎉                  ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log("\n📁 Deployment artifacts saved to deployments/\n");

  // Summary
  console.log("📋 Deployment Summary:");
  console.log("   ✅ Program deployed");
  console.log("   ✅ Protocol config initialized");
  console.log("   ✅ Treasury initialized");
  console.log("   ✅ Factory initialized");
  console.log("\n🚀 Next steps:");
  console.log("   • Users can now create custodian accounts");
  console.log("   • Anyone can create content pools via factory");
  console.log("   • Integrate into Next.js app for seamless UX\n");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
