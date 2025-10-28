/**
 * Production Mainnet Deployment Script
 *
 * This script deploys and initializes Veritas smart contracts to Solana mainnet.
 *
 * SECURITY NOTES:
 * - Uses separate keypairs for protocol authority and upgrade authority
 * - Reads configuration from deployment-config.json (gitignored)
 * - Never commits keypairs or config to git
 *
 * USAGE:
 *   1. Copy deployment-config.example.json to deployment-config.json
 *   2. Generate production keypairs and update paths in config
 *   3. Fund deployer wallet with SOL
 *   4. Run: npx tsx scripts/deploy-mainnet.ts
 *
 * STEPS:
 *   1. Load and validate configuration
 *   2. Build and deploy program (with upgrade authority)
 *   3. Initialize PoolFactory (with protocol authority)
 *   4. Initialize VeritasCustodian (with protocol authority)
 *   5. Save deployment addresses
 *   6. Display verification checklist
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { VeritasCuration } from "../src/lib/solana/target/types/veritas_curation";
import fs from "fs";
import path from "path";
import * as readline from "readline";

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

interface DeploymentConfig {
  network: string;
  rpcEndpoint: string;
  cluster: string;
  keypairs: {
    protocolAuthority: { path: string; description: string };
    upgradeAuthority: { publicKey: string; description: string };
    deployer: { path: string; description: string };
  };
  usdcMint: string;
  programDefaults: {
    factory: {
      minDeposit: number;
      defaultF: number;
      defaultBetaNum: number;
      defaultBetaDen: number;
      defaultP0: number;
    };
    custodian: {
      description: string;
    };
  };
  security: {
    confirmBeforeExecute: boolean;
    requireMultisig: boolean;
    backupKeypairs: boolean;
  };
  deployment?: {
    programId?: string;
    factoryPda?: string;
    custodianPda?: string;
    usdcVaultPda?: string;
  };
}

interface LoadedKeypairs {
  protocolAuthority: Keypair;
  upgradeAuthority: Keypair;
  deployer: Keypair;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function loadKeypair(filePath: string): Keypair {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Keypair file not found: ${fullPath}`);
  }
  const keyData = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(keyData));
}

function loadConfig(): DeploymentConfig {
  const configPath = path.join(__dirname, 'deployment-config.json');

  if (!fs.existsSync(configPath)) {
    log('\n❌ ERROR: deployment-config.json not found!', 'red');
    log('\nCreate it by copying the example:', 'yellow');
    log('  cp scripts/deployment-config.example.json scripts/deployment-config.json', 'cyan');
    log('\nThen edit deployment-config.json with your production values.\n', 'yellow');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as DeploymentConfig;

  // Validate required fields
  if (!config.network || !config.rpcEndpoint || !config.usdcMint) {
    throw new Error('Invalid config: missing required fields');
  }

  return config;
}

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${question} (y/n): ${colors.reset}`, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

// ============================================================================
// MAIN DEPLOYMENT FLOW
// ============================================================================

async function main() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('  🚀 VERITAS MAINNET DEPLOYMENT', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');

  // ============================================================================
  // STEP 1: LOAD AND VALIDATE CONFIGURATION
  // ============================================================================

  log('📋 Step 1: Loading deployment configuration...', 'cyan');
  const config = loadConfig();

  log(`\n  Network: ${config.network}`, 'green');
  log(`  RPC: ${config.rpcEndpoint}`, 'green');
  log(`  USDC Mint: ${config.usdcMint}`, 'green');

  // Load keypairs
  log('\n🔑 Loading keypairs...', 'cyan');
  let keypairs: LoadedKeypairs;

  try {
    keypairs = {
      protocolAuthority: loadKeypair(config.keypairs.protocolAuthority.path),
      upgradeAuthority: loadKeypair(config.keypairs.upgradeAuthority.path),
      deployer: loadKeypair(config.keypairs.deployer.path),
    };

    log(`  ✅ Protocol Authority: ${keypairs.protocolAuthority.publicKey.toBase58()}`, 'green');
    log(`  ✅ Upgrade Authority: ${keypairs.upgradeAuthority.publicKey.toBase58()}`, 'green');
    log(`  ✅ Deployer: ${keypairs.deployer.publicKey.toBase58()}`, 'green');
  } catch (error) {
    log(`\n❌ ERROR: Failed to load keypairs`, 'red');
    log(`${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
    log('\nEnsure all keypair paths in deployment-config.json are correct.\n', 'yellow');
    process.exit(1);
  }

  // Check deployer balance
  const connection = new Connection(config.rpcEndpoint, 'confirmed');
  const deployerBalance = await connection.getBalance(keypairs.deployer.publicKey);
  const deployerSol = deployerBalance / 1e9;

  log(`\n💰 Deployer Balance: ${deployerSol.toFixed(4)} SOL`, deployerSol > 10 ? 'green' : 'yellow');

  if (deployerSol < 10) {
    log('⚠️  WARNING: Low balance! Recommend at least 10 SOL for deployment.', 'yellow');
  }

  // Security confirmation
  if (config.security.confirmBeforeExecute) {
    log('\n⚠️  WARNING: You are about to deploy to MAINNET!', 'yellow');
    log('   This will spend real SOL and deploy real smart contracts.', 'yellow');
    log('   Make sure you have:', 'yellow');
    log('     - Backed up all keypairs securely', 'yellow');
    log('     - Verified the network and RPC endpoint', 'yellow');
    log('     - Tested on devnet first', 'yellow');

    const proceed = await confirm('\n   Do you want to proceed?');

    if (!proceed) {
      log('\n❌ Deployment cancelled by user.\n', 'red');
      process.exit(0);
    }
  }

  // ============================================================================
  // STEP 2: BUILD AND DEPLOY PROGRAM
  // ============================================================================

  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('📦 Step 2: Building and deploying smart contract...', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');

  log('⚠️  NOTE: You must run these Anchor commands manually:', 'yellow');
  log('\n  cd solana/veritas-curation', 'cyan');
  log(`  anchor build`, 'cyan');
  log(`  anchor deploy --provider.cluster ${config.cluster} \\`, 'cyan');
  log(`    --provider.wallet ${config.keypairs.deployer.path}`, 'cyan');

  log('\n  After deployment, update deployment-config.json with the program ID.', 'yellow');

  const deployed = await confirm('\nHave you already deployed the program?');

  if (!deployed) {
    log('\n⏸️  Please deploy the program first, then run this script again.\n', 'yellow');
    process.exit(0);
  }

  // Get program ID
  const programIdStr = config.deployment?.programId;

  if (!programIdStr || programIdStr === 'will-be-filled-after-deploy') {
    log('\n❌ ERROR: Program ID not set in deployment-config.json', 'red');
    log('   After deploying with Anchor, update the "deployment.programId" field.\n', 'yellow');
    process.exit(1);
  }

  const programId = new PublicKey(programIdStr);
  log(`\n✅ Using Program ID: ${programId.toBase58()}`, 'green');

  // Set upgrade authority
  log('\n🔧 Setting upgrade authority...', 'cyan');
  log(`   Upgrade Authority: ${keypairs.upgradeAuthority.publicKey.toBase58()}`, 'green');
  log('\n   Run this command:', 'yellow');
  log(`   solana program set-upgrade-authority ${programId.toBase58()} \\`, 'cyan');
  log(`     --upgrade-authority ${config.keypairs.deployer.path} \\`, 'cyan');
  log(`     --new-upgrade-authority ${keypairs.upgradeAuthority.publicKey.toBase58()} \\`, 'cyan');
  log(`     --url ${config.rpcEndpoint}`, 'cyan');

  const authoritySet = await confirm('\n   Have you set the upgrade authority?');

  if (!authoritySet) {
    log('\n⏸️  Please set the upgrade authority first.\n', 'yellow');
    process.exit(0);
  }

  // ============================================================================
  // STEP 3: INITIALIZE POOL FACTORY
  // ============================================================================

  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('🏭 Step 3: Initializing PoolFactory...', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(keypairs.deployer),
    { commitment: 'confirmed' }
  );

  anchor.setProvider(provider);

  const idlPath = path.join(__dirname, '../src/lib/solana/target/idl/veritas_curation.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  const program = new Program(idl as anchor.Idl, provider) as Program<VeritasCuration>;

  // Derive factory PDA
  const [factoryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('factory')],
    programId
  );

  log(`Factory PDA: ${factoryPda.toBase58()}`, 'green');
  log(`Pool Authority: ${keypairs.protocolAuthority.publicKey.toBase58()}`, 'green');

  // Check if already initialized
  try {
    const factory = await program.account.poolFactory.fetch(factoryPda);
    log('\n⚠️  Factory already initialized!', 'yellow');
    log(`   Current pool authority: ${factory.poolAuthority.toBase58()}`, 'green');

    if (!factory.poolAuthority.equals(keypairs.protocolAuthority.publicKey)) {
      log('   ❌ WARNING: Pool authority mismatch!', 'red');
    }
  } catch {
    log('\n📝 Initializing factory...', 'cyan');

    const tx = await program.methods
      .initializeFactory(
        keypairs.protocolAuthority.publicKey,
        new anchor.BN(config.programDefaults.factory.minDeposit),
        config.programDefaults.factory.defaultF,
        config.programDefaults.factory.defaultBetaNum,
        config.programDefaults.factory.defaultBetaDen,
        new anchor.BN(config.programDefaults.factory.defaultP0)
      )
      .accounts({
        factoryAuthority: keypairs.deployer.publicKey,
      })
      .rpc();

    log(`\n✅ Factory initialized!`, 'green');
    log(`   Transaction: ${tx}`, 'green');
  }

  // ============================================================================
  // STEP 4: INITIALIZE VERITAS CUSTODIAN
  // ============================================================================

  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('🏛️  Step 4: Initializing VeritasCustodian...', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');

  const [custodianPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('custodian')],
    programId
  );

  const [usdcVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('custodian_vault')],
    programId
  );

  const usdcMint = new PublicKey(config.usdcMint);

  log(`Custodian PDA: ${custodianPda.toBase58()}`, 'green');
  log(`USDC Vault PDA: ${usdcVaultPda.toBase58()}`, 'green');
  log(`Owner: ${keypairs.deployer.publicKey.toBase58()}`, 'green');
  log(`Protocol Authority: ${keypairs.protocolAuthority.publicKey.toBase58()}`, 'green');

  // Check if already initialized
  try {
    const custodian = await program.account.veritasCustodian.fetch(custodianPda);
    log('\n⚠️  Custodian already initialized!', 'yellow');
    log(`   Current protocol authority: ${custodian.protocolAuthority.toBase58()}`, 'green');

    if (!custodian.protocolAuthority.equals(keypairs.protocolAuthority.publicKey)) {
      log('   ❌ WARNING: Protocol authority mismatch!', 'red');
    }
  } catch {
    log('\n📝 Initializing custodian...', 'cyan');

    const tx = await program.methods
      .initializeCustodian(
        keypairs.deployer.publicKey,  // owner
        keypairs.protocolAuthority.publicKey  // protocol authority
      )
      .accounts({
        usdcMint: usdcMint,
        payer: keypairs.deployer.publicKey,
      })
      .rpc();

    log(`\n✅ Custodian initialized!`, 'green');
    log(`   Transaction: ${tx}`, 'green');
  }

  // ============================================================================
  // STEP 5: SAVE DEPLOYMENT ADDRESSES
  // ============================================================================

  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('💾 Step 5: Saving deployment addresses...', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');

  // Update config with deployed addresses
  config.deployment = {
    programId: programId.toBase58(),
    factoryPda: factoryPda.toBase58(),
    custodianPda: custodianPda.toBase58(),
    usdcVaultPda: usdcVaultPda.toBase58(),
  };

  const configPath = path.join(__dirname, 'deployment-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  log('✅ Updated deployment-config.json with addresses', 'green');

  // ============================================================================
  // STEP 6: DISPLAY VERIFICATION CHECKLIST
  // ============================================================================

  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('✅ DEPLOYMENT COMPLETE!', 'green');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');

  log('📝 Next Steps:\n', 'cyan');

  log('1. Set PROTOCOL_AUTHORITY_KEYPAIR in Vercel:', 'yellow');
  log(`   cat ${config.keypairs.protocolAuthority.path} | base64 | tr -d '\\n'`, 'cyan');
  log('   → Paste into Vercel dashboard as PROTOCOL_AUTHORITY_KEYPAIR\n', 'cyan');

  log('2. Set other Vercel environment variables:', 'yellow');
  log(`   NEXT_PUBLIC_VERITAS_PROGRAM_ID=${programId.toBase58()}`, 'cyan');
  log(`   NEXT_PUBLIC_USDC_MINT_MAINNET-BETA=${config.usdcMint}`, 'cyan');
  log(`   NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta\n`, 'cyan');

  log('3. Secure your keypairs:', 'yellow');
  log('   - Back up protocol authority to encrypted storage (1Password)', 'cyan');
  log('   - Back up upgrade authority to COLD STORAGE (hardware wallet)', 'cyan');
  log('   - DELETE local copies after backing up', 'cyan');
  log('   - NEVER commit deployment-config.json to git\n', 'cyan');

  log('4. Verify deployment:', 'yellow');
  log(`   solana program show ${programId.toBase58()}`, 'cyan');
  log(`   solana account ${factoryPda.toBase58()}`, 'cyan');
  log(`   solana account ${custodianPda.toBase58()}\n`, 'cyan');

  log('5. Fund protocol authority for transactions:', 'yellow');
  log(`   solana transfer ${keypairs.protocolAuthority.publicKey.toBase58()} 1 --url ${config.rpcEndpoint}\n`, 'cyan');

  log('📋 Deployment Summary:\n', 'cyan');
  log(`   Program ID:       ${programId.toBase58()}`, 'green');
  log(`   Factory PDA:      ${factoryPda.toBase58()}`, 'green');
  log(`   Custodian PDA:    ${custodianPda.toBase58()}`, 'green');
  log(`   USDC Vault:       ${usdcVaultPda.toBase58()}`, 'green');
  log(`   Protocol Auth:    ${keypairs.protocolAuthority.publicKey.toBase58()}`, 'green');
  log(`   Upgrade Auth:     ${keypairs.upgradeAuthority.publicKey.toBase58()}`, 'green');

  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ DEPLOYMENT FAILED:', error);
    process.exit(1);
  });