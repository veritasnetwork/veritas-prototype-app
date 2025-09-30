#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

async function resetAgents() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('🧹 Resetting agents...');

  try {
    // Get count before deletion
    const { count: agentCount } = await supabase
      .from('agents')
      .select('id', { count: 'exact' });

    console.log(`📊 Found ${agentCount} agents to delete`);

    if (agentCount === 0) {
      console.log('✅ No agents to delete');
      return;
    }

    // Delete all agents
    const { error } = await supabase
      .from('agents')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using impossible condition)

    if (error) {
      throw new Error(`Failed to delete agents: ${error.message}`);
    }

    console.log(`✅ Successfully deleted ${agentCount} agents`);

  } catch (error) {
    console.error('❌ Error resetting agents:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  resetAgents();
}