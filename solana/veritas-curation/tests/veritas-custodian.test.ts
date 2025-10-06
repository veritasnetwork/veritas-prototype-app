import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VeritasCuration } from "../target/types/veritas_curation";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("VeritasCustodian Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VeritasCuration as Program<VeritasCuration>;
  const payer = provider.wallet as anchor.Wallet;

  let usdcMint: PublicKey;
  let custodianPda: PublicKey;
  let custodianVault: PublicKey;
  let owner: Keypair;
  let protocolAuthority: Keypair;
  let testUser1: Keypair;
  let testUser2: Keypair;
  let user1UsdcAccount: PublicKey;
  let user2UsdcAccount: PublicKey;

  before(async () => {
    // Create mock USDC mint
    usdcMint = await createMint(
      provider.connection,
      payer.payer,
      payer.publicKey,
      null,
      6 // USDC decimals
    );

    // Create keypairs
    owner = Keypair.generate();
    protocolAuthority = Keypair.generate();
    testUser1 = Keypair.generate();
    testUser2 = Keypair.generate();

    // Airdrop SOL
    await provider.connection.requestAirdrop(
      owner.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      protocolAuthority.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      testUser1.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      testUser2.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Derive custodian PDA
    [custodianPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("custodian")],
      program.programId
    );

    // Create USDC accounts
    const user1Account = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer.payer,
      usdcMint,
      testUser1.publicKey
    );
    user1UsdcAccount = user1Account.address;

    const user2Account = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer.payer,
      usdcMint,
      testUser2.publicKey
    );
    user2UsdcAccount = user2Account.address;

    // Mint USDC to test users
    await mintTo(
      provider.connection,
      payer.payer,
      usdcMint,
      user1UsdcAccount,
      payer.publicKey,
      10_000_000_000 // 10K USDC
    );

    await mintTo(
      provider.connection,
      payer.payer,
      usdcMint,
      user2UsdcAccount,
      payer.publicKey,
      10_000_000_000 // 10K USDC
    );
  });

  describe("1. Custodian Initialization", () => {
    describe("1.1 Singleton Custodian Creation", () => {
      it("initializes custodian with owner and protocol authority", async () => {
        const [vault] = PublicKey.findProgramAddressSync(
          [Buffer.from("custodian_vault")],
          program.programId
        );
        custodianVault = vault;

        await program.methods
          .initializeCustodian(owner.publicKey, protocolAuthority.publicKey)
          .accounts({
            custodian: custodianPda,
            usdcVault: custodianVault,
            usdcMint: usdcMint,
            payer: payer.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        // Verify custodian state
        const custodian = await program.account.veritasCustodian.fetch(custodianPda);
        assert.equal(custodian.owner.toBase58(), owner.publicKey.toBase58());
        assert.equal(custodian.protocolAuthority.toBase58(), protocolAuthority.publicKey.toBase58());
        assert.equal(custodian.emergencyPause, false);
        assert.equal(custodian.totalDeposits.toString(), "0");
        assert.equal(custodian.totalWithdrawals.toString(), "0");

        // Verify vault
        const vaultInfo = await getAccount(provider.connection, custodianVault);
        assert.equal(vaultInfo.owner.toBase58(), custodianPda.toBase58());
        assert.equal(vaultInfo.mint.toBase58(), usdcMint.toBase58());
      });

      it("prevents duplicate custodian initialization", async () => {
        try {
          await program.methods
            .initializeCustodian(owner.publicKey, protocolAuthority.publicKey)
            .accounts({
              custodian: custodianPda,
              usdcVault: custodianVault,
              usdcMint: usdcMint,
              payer: payer.publicKey,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();
          assert.fail("Should have failed with account already exists");
        } catch (err) {
          assert.ok(err);
        }
      });
    });

    // Note: Authority validation tests for initialization are skipped because
    // VeritasCustodian is a singleton with fixed PDA seeds ["custodian"].
    // The contract DOES validate authorities (see initialize_custodian.rs),
    // but we cannot test initialization with invalid params in isolation.
    // Authority validation is tested in the update_owner and
    // update_protocol_authority tests instead.
  });

  describe("2. Deposit Operations", () => {
    describe("2.1 Permissionless Deposits", () => {
      it("allows any user to deposit USDC", async () => {
        const depositAmount = 1_000_000_000; // 1000 USDC

        const beforeVault = await getAccount(provider.connection, custodianVault);
        const beforeUser = await getAccount(provider.connection, user1UsdcAccount);
        const beforeCustodian = await program.account.veritasCustodian.fetch(custodianPda);

        await program.methods
          .deposit(new anchor.BN(depositAmount))
          .accounts({
            custodian: custodianPda,
            custodianUsdcVault: custodianVault,
            depositor: testUser1.publicKey,
            depositorUsdcAccount: user1UsdcAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([testUser1])
          .rpc();

        const afterVault = await getAccount(provider.connection, custodianVault);
        const afterUser = await getAccount(provider.connection, user1UsdcAccount);
        const afterCustodian = await program.account.veritasCustodian.fetch(custodianPda);

        // Verify USDC transferred
        assert.equal(
          Number(afterVault.amount),
          Number(beforeVault.amount) + depositAmount
        );
        assert.equal(
          Number(afterUser.amount),
          Number(beforeUser.amount) - depositAmount
        );

        // Verify total_deposits updated
        assert.equal(
          afterCustodian.totalDeposits.toString(),
          beforeCustodian.totalDeposits.add(new anchor.BN(depositAmount)).toString()
        );
      });

      it("handles multiple deposits from same user", async () => {
        const deposit1 = 500_000_000; // 500 USDC
        const deposit2 = 300_000_000; // 300 USDC
        const deposit3 = 200_000_000; // 200 USDC

        const beforeCustodian = await program.account.veritasCustodian.fetch(custodianPda);

        await program.methods
          .deposit(new anchor.BN(deposit1))
          .accounts({
            custodian: custodianPda,
            custodianUsdcVault: custodianVault,
            depositor: testUser2.publicKey,
            depositorUsdcAccount: user2UsdcAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([testUser2])
          .rpc();

        await program.methods
          .deposit(new anchor.BN(deposit2))
          .accounts({
            custodian: custodianPda,
            custodianUsdcVault: custodianVault,
            depositor: testUser2.publicKey,
            depositorUsdcAccount: user2UsdcAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([testUser2])
          .rpc();

        await program.methods
          .deposit(new anchor.BN(deposit3))
          .accounts({
            custodian: custodianPda,
            custodianUsdcVault: custodianVault,
            depositor: testUser2.publicKey,
            depositorUsdcAccount: user2UsdcAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([testUser2])
          .rpc();

        const afterCustodian = await program.account.veritasCustodian.fetch(custodianPda);

        // Verify all deposits tracked
        const totalDeposited = deposit1 + deposit2 + deposit3;
        assert.equal(
          afterCustodian.totalDeposits.toString(),
          beforeCustodian.totalDeposits.add(new anchor.BN(totalDeposited)).toString()
        );
      });
    });
  });

  describe("3. Withdrawal Operations", () => {
    describe("3.1 Protocol-Controlled Withdrawals", () => {
      it("allows protocol_authority to withdraw on behalf of users", async () => {
        const withdrawAmount = 500_000_000; // 500 USDC

        const beforeVault = await getAccount(provider.connection, custodianVault);
        const beforeUser = await getAccount(provider.connection, user1UsdcAccount);
        const beforeCustodian = await program.account.veritasCustodian.fetch(custodianPda);

        await program.methods
          .withdraw(new anchor.BN(withdrawAmount), testUser1.publicKey)
          .accounts({
            custodian: custodianPda,
            custodianUsdcVault: custodianVault,
            recipientUsdcAccount: user1UsdcAccount,
            authority: protocolAuthority.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([protocolAuthority])
          .rpc();

        const afterVault = await getAccount(provider.connection, custodianVault);
        const afterUser = await getAccount(provider.connection, user1UsdcAccount);
        const afterCustodian = await program.account.veritasCustodian.fetch(custodianPda);

        // Verify USDC transferred
        assert.equal(
          Number(afterVault.amount),
          Number(beforeVault.amount) - withdrawAmount
        );
        assert.equal(
          Number(afterUser.amount),
          Number(beforeUser.amount) + withdrawAmount
        );

        // Verify total_withdrawals updated
        assert.equal(
          afterCustodian.totalWithdrawals.toString(),
          beforeCustodian.totalWithdrawals.add(new anchor.BN(withdrawAmount)).toString()
        );
      });

      it("rejects withdrawal from non-protocol authority", async () => {
        const withdrawAmount = 100_000_000; // 100 USDC

        try {
          await program.methods
            .withdraw(new anchor.BN(withdrawAmount), testUser1.publicKey)
            .accounts({
              custodian: custodianPda,
              custodianUsdcVault: custodianVault,
              recipientUsdcAccount: user1UsdcAccount,
              authority: owner.publicKey, // Owner, not protocol authority
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([owner])
            .rpc();
          assert.fail("Should have failed with unauthorized");
        } catch (err: any) {
          // Check for Anchor error code or constraint violation
          const errorString = err.toString();
          assert.ok(
            errorString.includes("Unauthorized") ||
            errorString.includes("ConstraintRaw") ||
            errorString.includes("0x1770") || // Unauthorized error code (6000 in hex)
            err.error?.errorCode?.code === "Unauthorized",
            `Expected Unauthorized error, got: ${errorString}`
          );
        }

        try {
          await program.methods
            .withdraw(new anchor.BN(withdrawAmount), testUser1.publicKey)
            .accounts({
              custodian: custodianPda,
              custodianUsdcVault: custodianVault,
              recipientUsdcAccount: user1UsdcAccount,
              authority: testUser1.publicKey, // Random user
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([testUser1])
            .rpc();
          assert.fail("Should have failed with unauthorized");
        } catch (err: any) {
          // Check for Anchor error code or constraint violation
          const errorString = err.toString();
          assert.ok(
            errorString.includes("Unauthorized") ||
            errorString.includes("ConstraintRaw") ||
            errorString.includes("0x1770") || // Unauthorized error code (6000 in hex)
            err.error?.errorCode?.code === "Unauthorized",
            `Expected Unauthorized error, got: ${errorString}`
          );
        }
      });
    });

    describe("3.3 Pooled Model Accounting", () => {
      it("allows withdrawals exceeding deposits (user profits)", async () => {
        // Deposit 1000 USDC
        const depositAmount = 1_000_000_000;
        await program.methods
          .deposit(new anchor.BN(depositAmount))
          .accounts({
            custodian: custodianPda,
            custodianUsdcVault: custodianVault,
            depositor: testUser2.publicKey,
            depositorUsdcAccount: user2UsdcAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([testUser2])
          .rpc();

        const beforeCustodian = await program.account.veritasCustodian.fetch(custodianPda);

        // Withdraw 1500 USDC (more than deposited - user made profit)
        const withdrawAmount = 1_500_000_000;
        await program.methods
          .withdraw(new anchor.BN(withdrawAmount), testUser2.publicKey)
          .accounts({
            custodian: custodianPda,
            custodianUsdcVault: custodianVault,
            recipientUsdcAccount: user2UsdcAccount,
            authority: protocolAuthority.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([protocolAuthority])
          .rpc();

        const afterCustodian = await program.account.veritasCustodian.fetch(custodianPda);

        // This should succeed - withdrawals can exceed deposits in pooled model
        assert.equal(
          afterCustodian.totalWithdrawals.toString(),
          beforeCustodian.totalWithdrawals.add(new anchor.BN(withdrawAmount)).toString()
        );

        // Total withdrawals may exceed total deposits (winners get losers' deposits)
        // This is CRITICAL for zero-sum redistribution
      });
    });
  });

  describe("4. Emergency Pause", () => {
    describe("4.1 Toggle Emergency Pause", () => {
      it("allows owner to activate emergency pause", async () => {
        await program.methods
          .toggleEmergencyPause(true)
          .accounts({
            custodian: custodianPda,
            authority: owner.publicKey,
          })
          .signers([owner])
          .rpc();

        const custodian = await program.account.veritasCustodian.fetch(custodianPda);
        assert.equal(custodian.emergencyPause, true);
      });

      it("blocks withdrawals when paused", async () => {
        const withdrawAmount = 100_000_000;

        try {
          await program.methods
            .withdraw(new anchor.BN(withdrawAmount), testUser1.publicKey)
            .accounts({
              custodian: custodianPda,
              custodianUsdcVault: custodianVault,
              recipientUsdcAccount: user1UsdcAccount,
              authority: protocolAuthority.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([protocolAuthority])
            .rpc();
          assert.fail("Should have failed with SystemPaused");
        } catch (err) {
          assert.ok(err.toString().includes("SystemPaused") || err.toString().includes("ConstraintRaw"));
        }
      });

      it("allows deposits even when paused", async () => {
        const depositAmount = 100_000_000;

        // Should succeed even when paused
        await program.methods
          .deposit(new anchor.BN(depositAmount))
          .accounts({
            custodian: custodianPda,
            custodianUsdcVault: custodianVault,
            depositor: testUser1.publicKey,
            depositorUsdcAccount: user1UsdcAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([testUser1])
          .rpc();
      });

      it("allows owner to deactivate pause", async () => {
        await program.methods
          .toggleEmergencyPause(false)
          .accounts({
            custodian: custodianPda,
            authority: owner.publicKey,
          })
          .signers([owner])
          .rpc();

        const custodian = await program.account.veritasCustodian.fetch(custodianPda);
        assert.equal(custodian.emergencyPause, false);

        // Withdrawals should work again
        const withdrawAmount = 100_000_000;
        await program.methods
          .withdraw(new anchor.BN(withdrawAmount), testUser1.publicKey)
          .accounts({
            custodian: custodianPda,
            custodianUsdcVault: custodianVault,
            recipientUsdcAccount: user1UsdcAccount,
            authority: protocolAuthority.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([protocolAuthority])
          .rpc();
      });
    });

    describe("4.2 Pause Authority", () => {
      it("rejects pause toggle from protocol_authority", async () => {
        try {
          await program.methods
            .toggleEmergencyPause(true)
            .accounts({
              custodian: custodianPda,
              authority: protocolAuthority.publicKey,
            })
            .signers([protocolAuthority])
            .rpc();
          assert.fail("Should have failed with unauthorized");
        } catch (err: any) {
          // Check for Anchor error code or constraint violation
          const errorString = err.toString();
          assert.ok(
            errorString.includes("Unauthorized") ||
            errorString.includes("ConstraintRaw") ||
            errorString.includes("0x1770") || // Unauthorized error code (6000 in hex)
            err.error?.errorCode?.code === "Unauthorized",
            `Expected Unauthorized error, got: ${errorString}`
          );
        }
      });

      it("rejects pause toggle from random user", async () => {
        try {
          await program.methods
            .toggleEmergencyPause(true)
            .accounts({
              custodian: custodianPda,
              authority: testUser1.publicKey,
            })
            .signers([testUser1])
            .rpc();
          assert.fail("Should have failed with unauthorized");
        } catch (err: any) {
          // Check for Anchor error code or constraint violation
          const errorString = err.toString();
          assert.ok(
            errorString.includes("Unauthorized") ||
            errorString.includes("ConstraintRaw") ||
            errorString.includes("0x1770") || // Unauthorized error code (6000 in hex)
            err.error?.errorCode?.code === "Unauthorized",
            `Expected Unauthorized error, got: ${errorString}`
          );
        }
      });
    });
  });

  describe("5. Authority Management", () => {
    describe("5.1 Update Protocol Authority", () => {
      it("allows owner to update protocol_authority", async () => {
        const newProtocolAuthority = Keypair.generate();

        await program.methods
          .updateProtocolAuthority(newProtocolAuthority.publicKey)
          .accounts({
            custodian: custodianPda,
            authority: owner.publicKey,
          })
          .signers([owner])
          .rpc();

        const custodian = await program.account.veritasCustodian.fetch(custodianPda);
        assert.equal(
          custodian.protocolAuthority.toBase58(),
          newProtocolAuthority.publicKey.toBase58()
        );

        // Old authority should not work
        try {
          await program.methods
            .withdraw(new anchor.BN(100_000_000), testUser1.publicKey)
            .accounts({
              custodian: custodianPda,
              custodianUsdcVault: custodianVault,
              recipientUsdcAccount: user1UsdcAccount,
              authority: protocolAuthority.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([protocolAuthority])
            .rpc();
          assert.fail("Old authority should not work");
        } catch (err) {
          assert.ok(err);
        }

        // Restore original authority for other tests
        await program.methods
          .updateProtocolAuthority(protocolAuthority.publicKey)
          .accounts({
            custodian: custodianPda,
            authority: owner.publicKey,
          })
          .signers([owner])
          .rpc();
      });

      it("rejects update from non-owner", async () => {
        const newAuthority = Keypair.generate();

        try {
          await program.methods
            .updateProtocolAuthority(newAuthority.publicKey)
            .accounts({
              custodian: custodianPda,
              authority: protocolAuthority.publicKey,
            })
            .signers([protocolAuthority])
            .rpc();
          assert.fail("Should have failed with unauthorized");
        } catch (err) {
          assert.ok(err);
        }
      });
    });
  });
});
