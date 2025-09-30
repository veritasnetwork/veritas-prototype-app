const { createClient } = require('@supabase/supabase-js');

// Use local Supabase for testing
const supabase = createClient(
  'http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

async function generateInviteCodes() {
  console.log('Generating invite codes...');

  try {
    // Call the admin function to generate codes
    const response = await fetch('http://127.0.0.1:54321/functions/v1/admin-invite-codes-generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
      },
      body: JSON.stringify({
        count: 5,
        prefix: 'VERITAS',
        description: 'Test batch for development'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      console.log(`\nGenerated ${data.count} invite codes:\n`);
      data.codes.forEach(code => {
        console.log(`  - ${code.code}`);
      });
      console.log('\nThese codes grant:');
      console.log('  - Premium access status');
      console.log('  - $5,000 bonus stake');
    } else {
      console.error('Failed to generate codes:', data.error);
    }

  } catch (error) {
    console.error('Error generating invite codes:', error);
  }
}

generateInviteCodes();