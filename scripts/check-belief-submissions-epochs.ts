import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEpochs() {
  console.log('Checking belief submission epochs...\n');

  // Get pool data
  const { data: pools } = await supabase
    .from('pool_deployments')
    .select('pool_address, belief_id, current_epoch, post_id')
    .order('created_at', { ascending: false })
    .limit(5);

  if (!pools || pools.length === 0) {
    console.log('No pools found');
    return;
  }

  for (const pool of pools) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Pool: ${pool.pool_address.substring(0, 8)}...`);
    console.log(`Post ID: ${pool.post_id}`);
    console.log(`Belief ID: ${pool.belief_id}`);
    console.log(`Current Epoch: ${pool.current_epoch}`);
    console.log(`Expected submission epoch: ${pool.current_epoch + 1}`);

    // Get submissions for this belief
    const { data: submissions } = await supabase
      .from('belief_submissions')
      .select('agent_id, epoch, belief, created_at')
      .eq('belief_id', pool.belief_id)
      .order('created_at', { ascending: false });

    if (!submissions || submissions.length === 0) {
      console.log('\n⚠️  No submissions found for this pool!');
      continue;
    }

    console.log(`\nSubmissions (${submissions.length} total):`);
    const epochCounts = new Map<number, number>();

    for (const sub of submissions) {
      const count = epochCounts.get(sub.epoch) || 0;
      epochCounts.set(sub.epoch, count + 1);
      console.log(`  - Agent: ${sub.agent_id.substring(0, 8)}... | Epoch: ${sub.epoch} | Belief: ${sub.belief}`);
    }

    console.log('\nEpoch distribution:');
    for (const [epoch, count] of epochCounts.entries()) {
      console.log(`  Epoch ${epoch}: ${count} submission(s)`);
    }

    // Check what rebase would look for
    const nextEpoch = pool.current_epoch + 1;
    const { data: nextEpochSubs } = await supabase
      .from('belief_submissions')
      .select('agent_id')
      .eq('belief_id', pool.belief_id)
      .eq('epoch', nextEpoch);

    const uniqueAgents = new Set(nextEpochSubs?.map(s => s.agent_id) || []).size;
    console.log(`\n✅ Rebase check (epoch ${nextEpoch}): ${uniqueAgents} unique submitter(s)`);
  }
}

checkEpochs().catch(console.error);
