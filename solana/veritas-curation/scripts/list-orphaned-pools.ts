#!/usr/bin/env ts-node
/**
 * List all pools that exist on-chain but not in the database
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";

async function main() {
  // Connect to Supabase
  const supabaseUrl = "http://127.0.0.1:54321";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get all posts
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('id');

  if (postsError) {
    console.error("Error fetching posts:", postsError);
    process.exit(1);
  }

  // Get all pool deployments
  const { data: deployments, error: deploymentsError } = await supabase
    .from('pool_deployments')
    .select('post_id');

  if (deploymentsError) {
    console.error("Error fetching pool deployments:", deploymentsError);
    process.exit(1);
  }

  const deployedPostIds = new Set(deployments.map(d => d.post_id));

  console.log(`Found ${posts.length} posts in database`);
  console.log(`Found ${deployments.length} pool deployments in database\n`);

  // Check each post for orphaned pools
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const programId = new PublicKey("EXJvhoCsYc4tntxffGJhCyTzv6e2EDp9gqiFK17qhC4v");

  const orphanedPools = [];

  for (const post of posts) {
    // Skip if pool already recorded in DB
    if (deployedPostIds.has(post.id)) {
      continue;
    }

    // Derive pool PDA from post ID
    const postIdHex = post.id.replace(/-/g, '');
    const postIdBytes = Buffer.from(postIdHex, 'hex');
    const contentIdBuffer = Buffer.alloc(32);
    postIdBytes.copy(contentIdBuffer, 0);

    const [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('content_pool'), contentIdBuffer],
      programId
    );

    // Check if pool exists on-chain
    const poolAccount = await connection.getAccountInfo(poolPda);
    if (poolAccount) {
      orphanedPools.push({
        postId: post.id,
        poolAddress: poolPda.toBase58(),
      });
    }
  }

  if (orphanedPools.length === 0) {
    console.log("✅ No orphaned pools found!");
  } else {
    console.log(`❌ Found ${orphanedPools.length} orphaned pool(s):\n`);
    orphanedPools.forEach((pool, i) => {
      console.log(`${i + 1}. Post ID: ${pool.postId}`);
      console.log(`   Pool Address: ${pool.poolAddress}`);
      console.log(`   To close: npx ts-node scripts/close-pool.ts ${pool.postId}\n`);
    });
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("Error:", err);
    process.exit(1);
  }
);
