#!/usr/bin/env node

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

async function resetInviteCodes() {
  console.log('🧹 Resetting invite codes and user access...');

  try {
    // Delete user_access first (has FK to invite_codes)
    const deleteAccessResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_access?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      }
    });

    if (!deleteAccessResponse.ok) {
      const error = await deleteAccessResponse.text();
      throw new Error(`Failed to delete user access: ${error}`);
    }

    console.log('✅ User access records deleted');

    // Delete all invite codes
    const deleteResponse = await fetch(`${SUPABASE_URL}/rest/v1/invite_codes?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      }
    });

    if (!deleteResponse.ok) {
      const error = await deleteResponse.text();
      throw new Error(`Failed to delete invite codes: ${error}`);
    }

    console.log('✅ All invite codes deleted successfully');

  } catch (error) {
    console.error('❌ Error resetting invite codes:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  resetInviteCodes();
}