#!/usr/bin/env ts-node
/**
 * Close a pool (must have zero tokens in circulation)
 * Requires both creator signature AND protocol authority signature
 * Usage: npx ts-node scripts/close-pool.ts <post-id>
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VeritasCuration } from "../target/types/veritas_curation";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import fs from "fs";

async function main() {
  const postId = process.argv[2];
  if (!postId) {
    console.error("Usage: npx ts-node scripts/close-pool.ts <post-id>");
    console.error("Example: npx ts-node scripts/close-pool.ts 123e4567-e89b-12d3-a456-426614174000");
    process.exit(1);
  }

  console.log("Closing pool for post:", postId);

  // Configure the client
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");

  // Load authority keypair (pool authority = protocol authority)
  const authorityKeyPath = "/Users/josh/.config/solana/id.json";
  if (!fs.existsSync(authorityKeyPath)) {
    throw new Error(`Authority keypair not found at ${authorityKeyPath}`);
  }
  const authority = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(authorityKeyPath, "utf-8")))
  );

  const wallet = new anchor.Wallet(authority);
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  // Load the program
  const programId = new PublicKey("EXJvhoCsYc4tntxffGJhCyTzv6e2EDp9gqiFK17qhC4v");
  const program = anchor.workspace.VeritasCuration as Program<VeritasCuration>;

  // Derive factory PDA
  const [factoryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("factory")],
    programId
  );

  // Derive pool PDA from post ID
  const postIdHex = postId.replace(/-/g, '');
  const postIdBytes = Buffer.from(postIdHex, 'hex');
  const contentIdBuffer = Buffer.alloc(32);
  postIdBytes.copy(contentIdBuffer, 0);

  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('content_pool'), contentIdBuffer],
    programId
  );

  console.log("Pool PDA:", poolPda.toBase58());

  try {
    // Fetch pool state
    const pool = await program.account.contentPool.fetch(poolPda);
    console.log("\nPool state:");
    console.log("  Creator:", pool.creator.toBase58());
    console.log("  LONG tokens (s_long):", pool.sLong?.toString() || "0");
    console.log("  SHORT tokens (s_short):", pool.sShort?.toString() || "0");
    console.log("  Vault:", pool.vault?.toBase58() || "not set");

    // Check if pool can be closed
    const sLong = pool.sLong?.toNumber() || 0;
    const sShort = pool.sShort?.toNumber() || 0;

    if (sLong !== 0 || sShort !== 0) {
      console.log("\n❌ Cannot close pool: tokens still in circulation");
      console.log("   s_long must be 0, currently:", sLong);
      console.log("   s_short must be 0, currently:", sShort);
      process.exit(1);
    }

    console.log("\n✅ Pool has zero tokens in circulation. Can be closed.");

    // Get creator's USDC token account (for receiving any remaining USDC)
    const usdcMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // Local USDC mint
    const creatorUsdcAccount = await getAssociatedTokenAddress(
      usdcMint,
      pool.creator
    );

    console.log("\nClosing pool...");
    console.log("  Pool creator:", pool.creator.toBase58());
    console.log("  Protocol authority:", authority.publicKey.toBase58());
    console.log("  Signer:", authority.publicKey.toBase58());

    // Get authority's USDC account for receiving any remaining funds
    const authorityUsdcAccount = await getAssociatedTokenAddress(
      usdcMint,
      authority.publicKey
    );

    // Close the pool (authority can close as protocol authority)
    // Use accountsStrict to bypass account resolution
    const tx = await program.methods
      .closePool()
      .accountsStrict({
        pool: poolPda,
        factory: factoryPda,
        vault: pool.vault,
        receiverUsdc: authorityUsdcAccount,
        receiver: authority.publicKey,
        signer: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("\n✅ Pool closed successfully!");
    console.log("Transaction signature:", tx);

  } catch (error: any) {
    console.error("\n❌ Error closing pool:");
    if (error.message) {
      console.error("Message:", error.message);
    }
    if (error.logs) {
      console.error("Logs:", error.logs);
    }
    console.error(error);
    process.exit(1);
  }
}

main().then(
  () => {
    console.log("\nPool closure complete");
    process.exit(0);
  },
  (err) => {
    console.error("\nError:", err);
    process.exit(1);
  }
);
