#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

async function resetBeliefs() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('🧹 Resetting beliefs and belief submissions...');

  try {
    // Get counts before deletion
    const { count: submissionCount } = await supabase
      .from('belief_submissions')
      .select('id', { count: 'exact' });

    const { count: beliefCount } = await supabase
      .from('beliefs')
      .select('id', { count: 'exact' });

    console.log(`📊 Found ${submissionCount} belief submissions and ${beliefCount} beliefs to delete`);

    if (submissionCount === 0 && beliefCount === 0) {
      console.log('✅ No beliefs or submissions to delete');
      return;
    }

    // Delete belief submissions first (due to foreign key constraints)
    if (submissionCount > 0) {
      const { error: submissionError } = await supabase
        .from('belief_submissions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (submissionError) {
        throw new Error(`Failed to delete belief submissions: ${submissionError.message}`);
      }

      console.log(`✅ Successfully deleted ${submissionCount} belief submissions`);
    }

    // Delete beliefs
    if (beliefCount > 0) {
      const { error: beliefError } = await supabase
        .from('beliefs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (beliefError) {
        throw new Error(`Failed to delete beliefs: ${beliefError.message}`);
      }

      console.log(`✅ Successfully deleted ${beliefCount} beliefs`);
    }

  } catch (error) {
    console.error('❌ Error resetting beliefs:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  resetBeliefs();
}