/**
 * Diagnostic script to check environment variables
 * Run with: npx tsx scripts/check-env-vars.ts
 */

console.log('🔍 Checking Environment Variables\n');

const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SOLANA_NETWORK',
  'NEXT_PUBLIC_SOLANA_RPC_ENDPOINT',
  'NEXT_PUBLIC_VERITAS_PROGRAM_ID',
  'NEXT_PUBLIC_PRIVY_APP_ID',
];

const optionalVars = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'PROTOCOL_AUTHORITY_KEYPAIR',
  'HELIUS_API_KEY',
];

console.log('✅ Required Variables:');
for (const varName of requiredVars) {
  const value = process.env[varName];
  if (value) {
    // Show first 20 chars for security
    const preview = value.length > 20 ? `${value.substring(0, 20)}...` : value;
    console.log(`   ${varName}: ${preview}`);
  } else {
    console.log(`   ❌ ${varName}: NOT SET`);
  }
}

console.log('\n🔧 Optional Variables:');
for (const varName of optionalVars) {
  const value = process.env[varName];
  if (value) {
    const preview = value.length > 20 ? `${value.substring(0, 20)}...` : value;
    console.log(`   ${varName}: ${preview}`);
  } else {
    console.log(`   ${varName}: NOT SET`);
  }
}

console.log('\n📊 Environment Info:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`   Platform: ${process.platform}`);
console.log(`   Node Version: ${process.version}`);
