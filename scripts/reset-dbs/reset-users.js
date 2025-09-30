#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const users = [
  { username: 'alice', display_name: 'Alice Johnson' },
  { username: 'bob', display_name: 'Bob Wilson' },
  { username: 'charlie', display_name: 'Charlie Davis' }
];

async function resetUsers() {
  console.log('🧹 Resetting user database...');

  try {
    // Step 1: Delete all existing users (CASCADE will delete agents)
    console.log('Deleting all existing users...');
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .gte('created_at', '1970-01-01'); // Delete all records

    if (deleteError) {
      console.error('❌ Failed to delete users:', deleteError.message);
      process.exit(1);
    }

    console.log('✅ All existing users deleted');

    // Step 2: Create new users via edge function
    console.log('Creating fresh users...');
    
    for (const user of users) {
      console.log(`Creating user: ${user.username} (${user.display_name})`);
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/app-user-creation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(user)
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`✅ ${user.username} created successfully (ID: ${data.user_id.slice(0, 8)}...)`);
      } else {
        console.error(`❌ Failed to create ${user.username}:`, data.error || 'Unknown error');
      }
    }

    // Step 3: Verify final state
    console.log('Verifying database state...');
    const { data: finalUsers, error: countError } = await supabase
      .from('users')
      .select('username, display_name, total_stake')
      .order('username');

    if (countError) {
      console.error('❌ Failed to verify users:', countError.message);
    } else {
      console.log('📊 Final user count:', finalUsers.length);
      finalUsers.forEach(user => {
        console.log(`   - ${user.display_name} (@${user.username}) - $${user.total_stake} stake`);
      });
    }

    console.log('🎉 User database reset complete!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  resetUsers();
}

module.exports = { resetUsers };