#!/usr/bin/env ts-node
/**
 * Update min_settle_interval in PoolFactory to 1 hour (3600 seconds)
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VeritasCuration } from "../target/types/veritas_curation";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import fs from "fs";
import path from "path";

async function main() {
  // Configure the client
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");

  // Load authority keypair (factory authority - uses default Solana wallet)
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
  const programId = new PublicKey("6njQqMDxSdMqXFpR25s6uZ4mQLEk6PDcBucsst5rAWNz");
  const program = anchor.workspace.VeritasCuration as Program<VeritasCuration>;

  // Derive factory PDA
  const [factoryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("factory")],
    programId
  );

  try {
    // Fetch current factory settings
    const factoryBefore = await program.account.poolFactory.fetch(factoryPda);
    console.log("Current min_settle_interval:", factoryBefore.minSettleInterval.toNumber(), "seconds");

    // Update to 1 hour (3600 seconds)
    const newInterval = new anchor.BN(3600);

    console.log("\nUpdating min_settle_interval to 3600 seconds (1 hour)...");

    const tx = await program.methods
      .updateDefaults(
        null, // default_f (keep existing)
        null, // default_beta_num (keep existing)
        null, // default_beta_den (keep existing)
        null, // min_initial_deposit (keep existing)
        newInterval // min_settle_interval (update to 1 hour)
      )
      .accounts({
        // The accounts are auto-resolved by Anchor, just pass authority
        authority: authority.publicKey,
      })
      .rpc();

    console.log("Transaction signature:", tx);

    // Verify the update
    const factoryAfter = await program.account.poolFactory.fetch(factoryPda);
    console.log("\nUpdated min_settle_interval:", factoryAfter.minSettleInterval.toNumber(), "seconds");

    if (factoryAfter.minSettleInterval.toNumber() === 3600) {
      console.log("✅ Successfully updated min_settle_interval to 1 hour!");
    } else {
      console.log("❌ Update may have failed, please verify manually");
    }

  } catch (error) {
    console.error("Error updating factory defaults:", error);
    process.exit(1);
  }
}

main().then(
  () => {
    console.log("\nFactory update complete");
    process.exit(0);
  },
  (err) => {
    console.error("\nError:", err);
    process.exit(1);
  }
);