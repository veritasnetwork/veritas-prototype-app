#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// No default posts - start with clean slate
const posts = [];

// Random belief generation
function randomBelief() {
  return Math.random(); // 0 to 1
}

function randomMetaPrediction() {
  return Math.random(); // 0 to 1
}

async function resetPosts() {
  console.log('🧹 Resetting posts database...');

  try {
    // Step 1: Delete all existing posts and their associated beliefs
    console.log('Deleting all existing posts...');
    const { error: deletePostsError } = await supabase
      .from('posts')
      .delete()
      .gte('created_at', '1970-01-01'); // Delete all records

    if (deletePostsError) {
      console.error('❌ Failed to delete posts:', deletePostsError.message);
      process.exit(1);
    }

    console.log('Deleting all existing beliefs...');
    const { error: deleteBeliefsError } = await supabase
      .from('beliefs')
      .delete()
      .gte('created_at', '1970-01-01'); // Delete all records

    if (deleteBeliefsError) {
      console.error('❌ Failed to delete beliefs:', deleteBeliefsError.message);
      process.exit(1);
    }

    console.log('✅ All existing posts and beliefs deleted (agent counts updated automatically)');

    // Step 2: Get all users to create posts with
    console.log('Fetching users...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username, display_name, agent_id')
      .order('username');

    if (usersError) {
      console.error('❌ Failed to fetch users:', usersError.message);
      console.log('💡 Run "npm run reset:users" first to create users');
      process.exit(1);
    }

    if (users.length === 0) {
      console.error('❌ No users found in database');
      console.log('💡 Run "npm run reset:users" first to create users');
      process.exit(1);
    }

    console.log(`✅ Found ${users.length} users:`, users.map(u => u.username).join(', '));

    // Step 3: Create new posts via edge function
    console.log('Creating fresh posts...');
    const createdPosts = [];

    for (const post of posts) {
      // Use first user (Alice) as creator for all posts
      const creator = users[0];
      console.log(`Creating post: "${post.title}" by ${creator.username}`);

      const response = await fetch(`${SUPABASE_URL}/functions/v1/app-post-creation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: creator.id,
          title: post.title,
          content: post.content,
          initial_belief: randomBelief(),
          duration_epochs: 10 // 10 epochs duration (48h)
        })
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`✅ "${post.title}" created successfully (Post ID: ${data.post_id.slice(0, 8)}...)`);
        console.log(`   Belief ID: ${data.belief_id.slice(0, 8)}... | Initial belief: ${(data.belief.initial_aggregate * 100).toFixed(1)}%`);
        createdPosts.push({
          postId: data.post_id,
          beliefId: data.belief_id,
          title: post.title
        });
      } else {
        console.error(`❌ Failed to create "${post.title}":`, data.error || 'Unknown error');
      }
    }

    // Step 4: Create random belief submissions from all users for all posts
    if (createdPosts.length > 0) {
      console.log('Creating random belief submissions...');

      for (const post of createdPosts) {
        console.log(`\n📝 Adding submissions for "${post.title}":`);

        for (const user of users) {
          // Skip the creator for their own post (they already have a submission)
          const isCreator = user.id === users[0].id;
          if (isCreator) {
            console.log(`   ⏭️  Skipping ${user.username} (post creator)`);
            continue;
          }

          const beliefValue = randomBelief();
          const metaPrediction = randomMetaPrediction();

          console.log(`   🎲 ${user.username}: ${(beliefValue * 100).toFixed(1)}% belief, ${(metaPrediction * 100).toFixed(1)}% meta`);

          const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-beliefs-submit`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${ANON_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              agent_id: user.agent_id,
              belief_id: post.beliefId,
              belief_value: beliefValue,
              meta_prediction: metaPrediction
            })
          });

          const submissionData = await response.json();

          if (response.ok) {
            console.log(`      ✅ Submitted successfully`);
          } else {
            console.log(`      ❌ Failed: ${submissionData.error || 'Unknown error'}`);
          }
        }
      }
    }

    // Step 5: Verify final state
    console.log('\n🔍 Verifying database state...');
    const { data: finalPosts, error: countError } = await supabase
      .from('posts')
      .select('id, content, created_at')
      .order('created_at');

    if (countError) {
      console.error('❌ Failed to verify posts:', countError.message);
    } else {
      console.log('📊 Final post count:', finalPosts.length);
      if (finalPosts.length > 0) {
        finalPosts.forEach(post => {
          const preview = post.content?.slice(0, 50) || '(no content)';
          console.log(`   - ${preview} (${post.id.slice(0, 8)}...)`);
        });
      }
    }

    // Check total beliefs and belief submissions
    const { data: beliefs, error: beliefsError } = await supabase
      .from('beliefs')
      .select('id')

    if (!beliefsError && beliefs) {
      console.log(`📊 Total beliefs: ${beliefs.length}`);
    }

    const { data: submissions, error: submissionsError } = await supabase
      .from('belief_submissions')
      .select('id')

    if (!submissionsError && submissions) {
      console.log(`📊 Total belief submissions: ${submissions.length}`);
    }

    console.log('🎉 Posts database reset complete!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  resetPosts();
}

module.exports = { resetPosts };