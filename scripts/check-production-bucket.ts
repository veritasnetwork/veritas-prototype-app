/**
 * Check and update the veritas-media bucket in production Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load production env
dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

console.log('🔍 Checking production Supabase bucket...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkAndFixBucket() {
  try {
    // Query the bucket
    const { data: buckets, error: queryError } = await supabase
      .from('buckets')
      .select('id, name, public')
      .eq('name', 'veritas-media')
      .single();

    if (queryError) {
      console.error('❌ Error querying bucket:', queryError);

      // Try to list buckets to see what exists
      const { data: allBuckets, error: listError } = await supabase
        .storage
        .listBuckets();

      if (listError) {
        console.error('❌ Error listing buckets:', listError);
      } else {
        console.log('\n📦 Available buckets:');
        allBuckets.forEach(bucket => {
          console.log(`  - ${bucket.name} (public: ${bucket.public}, id: ${bucket.id})`);
        });
      }

      return;
    }

    console.log('\n✅ Found veritas-media bucket:');
    console.log('  ID:', buckets.id);
    console.log('  Name:', buckets.name);
    console.log('  Public:', buckets.public);

    if (!buckets.public) {
      console.log('\n⚠️  Bucket is PRIVATE - updating to PUBLIC...');

      // Update bucket to be public
      const { error: updateError } = await supabase
        .from('buckets')
        .update({ public: true })
        .eq('name', 'veritas-media');

      if (updateError) {
        console.error('❌ Error updating bucket:', updateError);
      } else {
        console.log('✅ Bucket is now PUBLIC!');
      }
    } else {
      console.log('\n✅ Bucket is already PUBLIC - no changes needed');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkAndFixBucket();
