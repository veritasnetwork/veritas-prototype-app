#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running: ${scriptPath}`);

    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: dirname(__dirname) // Run from project root
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script ${scriptPath} exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function resetAll() {
  console.log('🧹 RESET ALL - Comprehensive database reset');
  console.log('📋 Execution order:');
  console.log('  1. Delete invite codes and user access');
  console.log('  2. Delete users (cascades to agents, posts, beliefs)');
  console.log('  3. Create fresh users with stakes');
  console.log('  4. Create sample posts with beliefs');
  console.log('');

  try {
    // Delete invite codes first (has FK to users)
    await runScript(join(__dirname, 'reset-invite-codes.js'));

    // Delete users (cascades to agents, posts, beliefs)
    await runScript(join(__dirname, 'reset-users.js'));

    // Create sample posts (now users exist with stakes)
    await runScript(join(__dirname, 'reset-posts.js'));

    console.log('\n🎉 RESET ALL COMPLETED SUCCESSFULLY!');
    console.log('📊 All protocol and app data has been cleared and seeded');

  } catch (error) {
    console.error('\n❌ RESET ALL FAILED:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  resetAll();
}