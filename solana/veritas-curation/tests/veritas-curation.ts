import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VeritasCuration } from "../target/types/veritas_curation";

describe("veritas-curation", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.veritasCuration as Program<VeritasCuration>;

  it("Program loads successfully!", async () => {
    // Test that the program is loaded and accessible
    console.log("Program ID:", program.programId.toString());
    // Note: Actual method calls would require proper accounts and parameters
    // Example: await program.methods.initializePool(postId, initialK, supplyCap).rpc();
  });
});
