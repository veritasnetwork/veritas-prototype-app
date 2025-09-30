#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const INITIAL_STAKE = 10000; // $10k per agent

class MetaTestRunner {
  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    this.testLog = [];
    this.testConfig = {};
  }

  log(event, data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      data
    };
    this.testLog.push(logEntry);
    console.log(`[${event}] ${JSON.stringify(data)}`);
  }

  // Generate random test configuration
  generateConfig(scale = 'small') {
    let config;

    switch (scale) {
      case 'small':
        config = {
          agentCount: Math.floor(Math.random() * 9) + 1, // 1-10
          beliefCount: Math.floor(Math.random() * 4) + 1, // 1-5
        };
        break;
      case 'medium':
        config = {
          agentCount: Math.floor(Math.random() * 90) + 10, // 10-100
          beliefCount: Math.floor(Math.random() * 45) + 5, // 5-50
        };
        break;
      case 'large':
        config = {
          agentCount: Math.floor(Math.random() * 900) + 100, // 100-1000
          beliefCount: Math.floor(Math.random() * 950) + 50, // 50-1000
        };
        break;
      default:
        throw new Error(`Unknown scale: ${scale}`);
    }

    // Generate belief durations (5-20 epochs each)
    config.beliefDurations = Array.from({ length: config.beliefCount }, () =>
      Math.floor(Math.random() * 16) + 5 // 5-20 epochs
    );

    return config;
  }

  // Create test agents with initial stakes
  async createAgents(count) {
    const agents = [];

    for (let i = 0; i < count; i++) {
      const agentData = {
        id: randomUUID(),
        total_stake: INITIAL_STAKE,
        created_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('agents')
        .insert(agentData);

      if (error) {
        throw new Error(`Failed to create agent ${i}: ${error.message}`);
      }

      agents.push(agentData);
      this.log('agent_created', { agentId: agentData.id, stake: INITIAL_STAKE });
    }

    return agents;
  }

  // Create test beliefs with random durations using protocol function
  async createBeliefs(agents, count, durations) {
    const beliefs = [];

    // Get current epoch to ensure beliefs expire in the future
    const { data: epochData } = await this.supabase
      .from('system_config')
      .select('value')
      .eq('key', 'current_epoch')
      .single();

    const currentEpoch = parseInt(epochData?.value || '0');

    for (let i = 0; i < count; i++) {
      // Pick a random agent as creator
      const creatorAgent = agents[Math.floor(Math.random() * agents.length)];

      // Generate random initial belief (0.1 to 0.9 to avoid extreme values)
      const initialBelief = Math.random() * 0.8 + 0.1;

      // Use protocol belief creation function
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-belief-creation`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            agent_id: creatorAgent.id,
            initial_belief: initialBelief,
            duration_epochs: durations[i]
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Protocol belief creation failed: ${response.status} ${response.statusText}. ${errorText}`);
        }

        const result = await response.json();

        beliefs.push({
          id: result.belief_id,
          creator_agent_id: creatorAgent.id,
          expiration_epoch: result.expiration_epoch,
          initial_belief: initialBelief
        });

        this.log('belief_created', {
          beliefId: result.belief_id,
          creatorAgentId: creatorAgent.id,
          initialBelief: initialBelief,
          currentEpoch: currentEpoch,
          duration: durations[i],
          expirationEpoch: result.expiration_epoch
        });

      } catch (error) {
        throw new Error(`Failed to create belief ${i}: ${error.message}`);
      }
    }

    return beliefs;
  }

  // Random agent participation in beliefs using protocol function
  async simulateParticipation(agents, beliefs) {
    const submissions = [];

    for (const agent of agents) {
      for (const belief of beliefs) {
        // 50% chance to participate
        if (Math.random() < 0.5) {
          // Generate belief values with some relationship to initial belief to be more realistic
          const initialBelief = belief.initial_belief || 0.5;
          // Add some noise around the initial belief (±0.3)
          const beliefValue = Math.max(0.01, Math.min(0.99, initialBelief + (Math.random() - 0.5) * 0.6));
          const metaPrediction = Math.random(); // Random meta-prediction

          try {
            // Use protocol belief submission function
            const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-beliefs-submit`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                agent_id: agent.id,
                belief_id: belief.id,
                belief_value: beliefValue,
                meta_prediction: metaPrediction
              })
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Protocol belief submission failed: ${response.status} ${response.statusText}. ${errorText}`);
            }

            const result = await response.json();

            submissions.push({
              agent_id: agent.id,
              belief_id: belief.id,
              belief: beliefValue,
              meta_prediction: metaPrediction
            });

            this.log('belief_submitted', {
              agentId: agent.id,
              beliefId: belief.id,
              beliefValue: beliefValue,
              metaPrediction: metaPrediction
            });

          } catch (error) {
            console.error(`Failed to submit belief for agent ${agent.id}: ${error.message}`);
            // Continue with other submissions even if one fails
          }
        }
      }
    }

    return submissions;
  }

  // Submit new random beliefs for agents each epoch
  async simulateEpochParticipation(agents, activeBeliefs) {
    const submissions = [];

    for (const agent of agents) {
      for (const belief of activeBeliefs) {
        // 60% chance to participate each epoch (higher than initial to ensure activity)
        if (Math.random() < 0.6) {
          // Generate new random belief values for this epoch
          const previousAggregate = belief.previous_aggregate || 0.5;
          // Add some noise around the previous aggregate (±0.4) for learning potential
          const beliefValue = Math.max(0.01, Math.min(0.99, previousAggregate + (Math.random() - 0.5) * 0.8));
          const metaPrediction = Math.random(); // Random meta-prediction

          try {
            // Use protocol belief submission function
            const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-beliefs-submit`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                agent_id: agent.id,
                belief_id: belief.id,
                belief_value: beliefValue,
                meta_prediction: metaPrediction
              })
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`Failed to submit belief for agent ${agent.id}: ${response.status} ${response.statusText}. ${errorText}`);
              continue;
            }

            submissions.push({
              agent_id: agent.id,
              belief_id: belief.id,
              belief_value: beliefValue,
              meta_prediction: metaPrediction
            });

            this.log('epoch_belief_submitted', {
              agentId: agent.id,
              beliefId: belief.id,
              beliefValue: beliefValue,
              metaPrediction: metaPrediction
            });

          } catch (error) {
            console.error(`Failed to submit belief for agent ${agent.id}: ${error.message}`);
          }
        }
      }
    }

    return submissions;
  }

  // Monitor epoch processing and stake changes
  async runEpochProcessing(agents, beliefs) {
    // Get the actual starting epoch from database
    const { data: initialEpochData } = await this.supabase
      .from('system_config')
      .select('value')
      .eq('key', 'current_epoch')
      .single();

    let startingEpoch = parseInt(initialEpochData?.value || '0');
    let epochCount = 0;
    const maxEpochs = 50; // Safety limit

    this.log('epoch_processing_start', {
      startingEpoch: startingEpoch,
      maxEpochs: maxEpochs
    });

    while (epochCount < maxEpochs) {
      // Check for active beliefs
      const { data: activeBeliefs } = await this.supabase
        .from('beliefs')
        .select('*')
        .eq('status', 'active');

      // Get current database epoch for accurate logging
      const { data: currentEpochData } = await this.supabase
        .from('system_config')
        .select('value')
        .eq('key', 'current_epoch')
        .single();

      const currentDatabaseEpoch = parseInt(currentEpochData?.value || '0');

      // Log current system state
      this.log('epoch_state_check', {
        epochCount: epochCount,
        databaseEpoch: currentDatabaseEpoch,
        activeBeliefs: activeBeliefs?.length || 0,
        beliefDetails: activeBeliefs?.map(b => ({
          id: b.id,
          created_epoch: b.created_epoch,
          expiration_epoch: b.expiration_epoch,
          status: b.status,
          epochs_remaining: b.expiration_epoch - currentDatabaseEpoch
        })) || []
      });

      if (!activeBeliefs || activeBeliefs.length === 0) {
        this.log('simulation_complete', { totalEpochs: epochCount });
        break;
      }

      // Submit new random beliefs for this epoch before processing
      if (epochCount > 0) { // Skip first epoch since we already submitted initially
        await this.simulateEpochParticipation(agents, activeBeliefs);
      }

      // Get agent states before processing
      const { data: agentsBefore } = await this.supabase
        .from('agents')
        .select('id, total_stake');

      // Trigger epoch processing
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-epochs-process`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        this.log('epoch_response', {
          epochCount: epochCount,
          databaseEpochBefore: currentDatabaseEpoch,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers)
        });

        if (!response.ok) {
          // Try to get the error body for more details
          let errorBody;
          try {
            errorBody = await response.text();
          } catch (e) {
            errorBody = 'Could not read error body';
          }
          throw new Error(`Epoch processing failed: ${response.status} ${response.statusText}. Body: ${errorBody}`);
        }

        const result = await response.json();

        // Get database epoch after processing to verify increment
        const { data: afterEpochData } = await this.supabase
          .from('system_config')
          .select('value')
          .eq('key', 'current_epoch')
          .single();

        const databaseEpochAfter = parseInt(afterEpochData?.value || '0');

        this.log('epoch_processed', {
          epochCount: epochCount,
          databaseEpochBefore: currentDatabaseEpoch,
          databaseEpochAfter: databaseEpochAfter,
          epochIncrement: databaseEpochAfter - currentDatabaseEpoch,
          result
        });

      } catch (error) {
        this.log('epoch_error', {
          epochCount: epochCount,
          databaseEpoch: currentDatabaseEpoch,
          error: error.message,
          stack: error.stack
        });
        break;
      }

      // Get agent states after processing
      const { data: agentsAfter } = await this.supabase
        .from('agents')
        .select('id, total_stake');

      // Log stake changes
      if (agentsBefore && agentsAfter) {
        const stakeChanges = [];
        for (const after of agentsAfter) {
          const before = agentsBefore.find(a => a.id === after.id);
          if (before && before.total_stake !== after.total_stake) {
            const change = after.total_stake - before.total_stake;
            stakeChanges.push({
              agentId: after.id,
              stakeBefore: before.total_stake,
              stakeAfter: after.total_stake,
              change
            });
          }
        }

        if (stakeChanges.length > 0) {
          this.log('stake_redistribution', { epoch: epochCount, changes: stakeChanges });
        }
      }

      epochCount++;
    }
  }

  // Clean up test data
  async cleanup(agents, beliefs) {
    // Delete belief submissions
    await this.supabase
      .from('belief_submissions')
      .delete()
      .in('agent_id', agents.map(a => a.id));

    // Delete beliefs
    await this.supabase
      .from('beliefs')
      .delete()
      .in('id', beliefs.map(b => b.id));

    // Delete agents
    await this.supabase
      .from('agents')
      .delete()
      .in('id', agents.map(a => a.id));

    this.log('cleanup_complete', {
      agentsDeleted: agents.length,
      beliefsDeleted: beliefs.length
    });
  }

  // Reset database epoch to 0 for clean testing
  async resetEpoch() {
    const { error } = await this.supabase
      .from('system_config')
      .update({ value: '0' })
      .eq('key', 'current_epoch');

    if (error) {
      throw new Error(`Failed to reset epoch: ${error.message}`);
    }

    this.log('epoch_reset', { resetTo: 0 });
  }

  // Run complete test
  async runTest(scale = 'small', resetEpoch = false) {
    this.testConfig = this.generateConfig(scale);
    this.log('test_started', this.testConfig);

    try {
      // Optionally reset epoch for clean testing
      if (resetEpoch) {
        await this.resetEpoch();
      }

      // Create agents and beliefs
      const agents = await this.createAgents(this.testConfig.agentCount);
      const beliefs = await this.createBeliefs(agents, this.testConfig.beliefCount, this.testConfig.beliefDurations);

      // Simulate participation
      await this.simulateParticipation(agents, beliefs);

      // Run epoch processing
      await this.runEpochProcessing(agents, beliefs);

      // Save test results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `meta-test-${scale}-${timestamp}.json`;
      const filepath = path.join(process.cwd(), filename);

      const testReport = {
        testConfig: this.testConfig,
        testLog: this.testLog,
        timestamp: new Date().toISOString(),
        scale
      };

      fs.writeFileSync(filepath, JSON.stringify(testReport, null, 2));
      this.log('test_completed', { reportFile: filename });

      // Cleanup
      await this.cleanup(agents, beliefs);

      return filepath;

    } catch (error) {
      this.log('test_failed', { error: error.message });
      throw error;
    }
  }
}

// Main execution
async function main() {
  const scale = process.argv[2] || 'small';
  const resetEpoch = process.argv[3] === '--reset-epoch';

  if (!['small', 'medium', 'large'].includes(scale)) {
    console.error('Usage: node meta-test-random.js [small|medium|large] [--reset-epoch]');
    console.error('Options:');
    console.error('  --reset-epoch: Reset database epoch to 0 before testing (use for clean isolated tests)');
    process.exit(1);
  }

  const runner = new MetaTestRunner();

  try {
    const reportFile = await runner.runTest(scale, resetEpoch);
    console.log(`\n✅ Test completed successfully!`);
    console.log(`📄 Report saved to: ${reportFile}`);
    console.log(`\nTo analyze this report with Claude, share the contents of ${reportFile}`);

  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}