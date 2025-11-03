/**
 * Apply migration to production database
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load production env
const envPath = path.join(process.cwd(), '.env.production');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const [key, ...valueParts] = trimmed.split('=');
  if (key && valueParts.length > 0) {
    env[key] = valueParts.join('=');
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing credentials in .env.production');
  process.exit(1);
}

console.log(`📡 Connecting to: ${supabaseUrl}\n`);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const migration = `
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS media_width INTEGER,
ADD COLUMN IF NOT EXISTS media_height INTEGER,
ADD COLUMN IF NOT EXISTS aspect_ratio NUMERIC(10,4);
  `.trim();

  console.log('🔧 Applying migration...\n');
  console.log(migration);
  console.log();

  const { error } = await supabase.rpc('exec', { sql: migration });

  if (error) {
    // Try direct approach if RPC doesn't work
    console.log('📝 RPC not available, trying direct query...\n');

    const { error: queryError } = await (supabase as any)
      .from('_migrations')
      .select('*')
      .limit(1);

    if (queryError) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration would need to be applied manually via SQL Editor');
    console.log('\nRun this in Supabase Dashboard → SQL Editor:');
    console.log(migration);
    process.exit(0);
  }

  console.log('✅ Migration applied successfully!');
}

main().catch(console.error);
