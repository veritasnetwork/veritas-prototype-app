import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    'https://gkozygjbhvpakuwzexot.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrb3p5Z2piaHZwYWt1d3pleG90Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4MTAyMiwiZXhwIjoyMDcyODU3MDIyfQ.f1Njp3uV94IPL7k2M-gw9kRWQYaBovH1y9W5lI6G9wc'
  );

  const { data } = await supabase.from('users').select('username').limit(20);
  console.log('Production usernames:', data?.map(u => u.username).join(', '));
}

main();
