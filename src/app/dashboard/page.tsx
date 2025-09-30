'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  username: string;
  display_name: string;
  agent_id: string;
  total_stake: number;
  beliefs_created: number;
  beliefs_participated: number;
  created_at: string;
}

interface OpinionPost {
  id: string;
  title: string;
  content: string;
  belief_id: string | null;
  user_id: string;
  created_at: string;
  user: {
    username: string;
    display_name: string;
  };
  belief?: {
    belief_id: string;
    previous_aggregate: number;
    expiration_epoch: number;
    status: string;
    creator_agent_id: string;
  };
  submissions?: Array<{
    submission_id: string;
    user: {
      id: string;
      username: string;
      display_name: string;
    };
    agent_id: string;
    belief: number;
    meta_prediction: number;
    epoch: number;
    is_active: boolean;
    stake_allocated: number;
    created_at: string;
    updated_at: string;
  }>;
}

interface DashboardUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  agent_id: string;
  total_stake: number;
  active_belief_count: number;
  belief_participations: Array<{
    submission_id: string;
    belief_id: string;
    belief_value: number;
    meta_prediction: number;
    stake_allocated: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    belief_info: {
      creator_agent_id: string;
      created_epoch: number;
      expiration_epoch: number;
      current_aggregate: number;
      status: string;
    };
    post_context?: {
      post_id: string;
      title: string;
      content_preview: string;
      created_at: string;
      post_type: 'opinion';
    } | null;
  }>;
}

interface EpochStatus {
  current_epoch: number;
  epoch_start_time: string;
  time_remaining_seconds: number;
  next_deadline: string;
  cron_status: string;
  processing_enabled: boolean;
}

export default function DashboardPage() {
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [epochInterval, setEpochInterval] = useState(1);
  const [isEpochRunning, setIsEpochRunning] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [opinionPosts, setOpinionPosts] = useState<OpinionPost[]>([]);
  const [dashboardUsers, setDashboardUsers] = useState<DashboardUser[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'users'>('posts');
  const [logs, setLogs] = useState<string[]>([]);
  const [epochStatus, setEpochStatus] = useState<EpochStatus | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [processingEnabled, setProcessingEnabled] = useState(false);

  // Initial load effect
  useEffect(() => {
    loadData();
    loadEpochStatus();

    // Load previously selected user from localStorage
    const savedUserId = localStorage.getItem('selectedUserId');
    if (savedUserId) {
      setSelectedUserId(savedUserId);
    }
  }, []); // Only run once on mount

  // Countdown timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (epochStatus && epochStatus.cron_status === 'active') {
        const deadline = new Date(epochStatus.next_deadline);
        const now = new Date();
        const remaining = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));
        setTimeRemaining(remaining);
      } else {
        // Stop countdown when cron is stopped
        setTimeRemaining(0);
      }
    }, 1000);

    // Also set initial value based on current status
    if (epochStatus) {
      if (epochStatus.cron_status === 'active') {
        setTimeRemaining(epochStatus.time_remaining_seconds);
      } else {
        setTimeRemaining(0);
      }
    }

    return () => clearInterval(interval);
  }, [epochStatus]); // Only re-setup timer when epochStatus changes

  const loadData = async () => {
    try {
      addLog('Loading dashboard data...');

      // Load users from database
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) {
        addLog(`Error loading users: ${usersError.message}`);
      } else {
        setUsers(usersData || []);
        addLog(`Loaded ${usersData?.length || 0} users`);
      }

      // Load system config (current epoch)
      const { data: configData, error: configError } = await supabase
        .from('system_config')
        .select('*')
        .eq('key', 'current_epoch')
        .single();

      if (configError && configError.code !== 'PGRST116') {
        addLog(`Error loading epoch: ${configError.message}`);
      } else if (configData) {
        setCurrentEpoch(parseInt(configData.value));
      }

      // Load posts and users
      await loadPosts();
      await loadDashboardUsers();

    } catch (error) {
      addLog(`Error loading data: ${error}`);
    }
  };

  const loadPosts = async () => {
    try {
      addLog('Loading posts...');

      // MODULAR USER SELECTION: Use selected user for feed
      // When auth is implemented, replace selectedUserId with authenticated user ID
      // Currently all users see the same posts regardless of selectedUserId
      const userIdForFeed = selectedUserId || 'default-user'; // Fallback for API requirement

      const response = await fetch('/api/supabase/functions/v1/dashboard-posts-get-feed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userIdForFeed,
          limit: 20,
          offset: 0
        })
      });

      const data = await response.json();

      if (response.ok) {
        setOpinionPosts(data.posts || []);
        addLog(`✅ Loaded ${data.posts?.length || 0} posts (${data.total_count} total)`);
      } else {
        addLog(`❌ Failed to load posts: ${data.error || 'Unknown error'}`);
        setOpinionPosts([]);
      }
    } catch (error) {
      addLog(`❌ Error loading posts: ${error}`);
      setOpinionPosts([]);
    }
  };

  const loadDashboardUsers = async () => {
    try {
      addLog('Loading dashboard users...');

      const response = await fetch('/api/supabase/functions/v1/app-dashboard-users-get-activity', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          limit: 20,
          offset: 0
        })
      });

      const data = await response.json();

      if (response.ok) {
        setDashboardUsers(data.users || []);
        addLog(`✅ Loaded ${data.users?.length || 0} users (${data.total_count} total)`);
      } else {
        addLog(`❌ Failed to load users: ${data.error || 'Unknown error'}`);
        setDashboardUsers([]);
      }
    } catch (error) {
      addLog(`❌ Error loading users: ${error}`);
      setDashboardUsers([]);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  };

  const loadEpochStatus = async () => {
    try {
      // Get epoch status using PostgreSQL function
      const { data: statusData, error: statusError } = await supabase
        .rpc('get_epoch_status');

      if (statusError) {
        addLog(`Error loading epoch status: ${statusError.message}`);
        return;
      }

      if (statusData && statusData.length > 0) {
        const status = statusData[0];
        setEpochStatus({
          current_epoch: status.current_epoch,
          epoch_start_time: status.epoch_start_time,
          time_remaining_seconds: status.time_remaining_seconds,
          next_deadline: status.next_deadline,
          cron_status: status.cron_status,
          processing_enabled: status.processing_enabled
        });
        setCurrentEpoch(status.current_epoch);
        setIsEpochRunning(status.cron_status === 'active');
        setProcessingEnabled(status.processing_enabled);
        setTimeRemaining(status.time_remaining_seconds);
      }
    } catch (error) {
      addLog(`Error loading epoch status: ${error}`);
    }
  };

  const startCronScheduling = async () => {
    try {
      addLog(`Starting cron scheduling with ${epochInterval}m intervals...`);

      const response = await fetch('/api/supabase/functions/v1/admin-cron-epoch-start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          epoch_duration_seconds: epochInterval * 60,
          immediate_start: false
        })
      });

      const data = await response.json();

      if (response.ok) {
        addLog(`✅ Cron scheduling started: job_id=${data.cron_job_id.slice(0, 12)}...`);
        addLog(`Next epoch deadline: ${new Date(data.next_epoch_deadline).toLocaleTimeString()}`);
        await loadEpochStatus(); // Reload status
      } else {
        addLog(`❌ Failed to start cron: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      addLog(`❌ Error starting cron: ${error}`);
    }
  };

  const stopCronScheduling = async () => {
    try {
      addLog('Stopping cron scheduling...');

      const response = await fetch('/api/supabase/functions/v1/admin-cron-epoch-stop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          complete_current_epoch: true
        })
      });

      const data = await response.json();

      if (response.ok) {
        addLog(`✅ Cron scheduling stopped at epoch ${data.final_epoch}`);
        await loadEpochStatus(); // Reload status
      } else {
        addLog(`❌ Failed to stop cron: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      addLog(`❌ Error stopping cron: ${error}`);
    }
  };

  const manualTriggerEpoch = async () => {
    try {
      addLog('Manually triggering epoch processing...');
      addLog(`📊 Current epoch: ${currentEpoch}`);

      // Capture initial state for comparison
      const initialStakes: Record<string, number> = {};
      const initialAggregates: Record<string, number> = {};

      // Get initial stakes for all users
      try {
        for (const user of users) {
          if (user.agent_id) {
            const { data: agentData } = await supabase
              .from('agents')
              .select('total_stake')
              .eq('id', user.agent_id)
              .single();
            if (agentData) {
              initialStakes[user.agent_id] = agentData.total_stake;
            }
          }
        }

        // Get initial aggregates for all beliefs
        for (const post of opinionPosts) {
          if (post.belief?.belief_id) {
            const { data: beliefData } = await supabase
              .from('beliefs')
              .select('previous_aggregate')
              .eq('id', post.belief.belief_id)
              .single();
            if (beliefData) {
              initialAggregates[post.belief.belief_id] = beliefData.previous_aggregate;
            }
          }
        }

        addLog(`💰 Initial stakes: ${Object.keys(initialStakes).length} agents tracked`);
        addLog(`📈 Initial aggregates: ${Object.keys(initialAggregates).length} beliefs tracked`);
      } catch (error) {
        addLog(`⚠️  Could not capture initial state: ${error}`);
      }

      const response = await fetch('/api/supabase/functions/v1/protocol-epochs-process', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_epoch: currentEpoch
        })
      });

      const data = await response.json();

      if (response.ok) {
        addLog(`✅ Epoch processing completed successfully!`);
        addLog(`📊 Summary: ${data.processed_beliefs.length} processed, ${data.expired_beliefs.length} expired`);
        addLog(`🔄 Epoch ${currentEpoch} → ${data.next_epoch}`);

        // Process detailed results for each belief
        if (data.processed_beliefs.length > 0) {
          addLog(`\n📋 DETAILED PROCESSING RESULTS:`);

          for (const belief of data.processed_beliefs) {
            const beliefId = belief.belief_id.slice(0, 8);
            addLog(`\n🎯 Belief ${beliefId}... (${belief.participant_count} participants):`);

            // Aggregation results
            const preAggregate = (belief.pre_mirror_descent_aggregate * 100).toFixed(1);
            const postAggregate = (belief.post_mirror_descent_aggregate * 100).toFixed(1);
            const certainty = (belief.certainty * 100).toFixed(1);

            addLog(`   📊 Aggregation: ${preAggregate}% → ${postAggregate}% (certainty: ${certainty}%)`);

            // Entropy and learning
            const preEntropy = belief.jensen_shannon_disagreement_entropy.toFixed(4);
            const postEntropy = belief.post_mirror_descent_disagreement_entropy.toFixed(4);
            const entropyReduction = (belief.jensen_shannon_disagreement_entropy - belief.post_mirror_descent_disagreement_entropy).toFixed(4);

            addLog(`   🧠 Entropy: ${preEntropy} → ${postEntropy} (reduction: ${entropyReduction})`);

            // Learning assessment
            if (belief.learning_occurred) {
              const learningRate = (belief.economic_learning_rate * 100).toFixed(1);
              addLog(`   🎓 Learning occurred! Economic rate: ${learningRate}%`);
              addLog(`   💸 Stake redistribution triggered`);
            } else {
              addLog(`   😴 No learning occurred (entropy reduction insufficient)`);
              addLog(`   💤 Agents turned passive, no stake redistribution`);
            }

            // Weight distribution
            const weights = Object.entries(belief.weights);
            addLog(`   ⚖️  Weights: ${weights.map(([id, weight]) => `${id.slice(0, 6)}=${((weight as number) * 100).toFixed(1)}%`).join(', ')}`);
          }
        }

        // Expired beliefs
        if (data.expired_beliefs.length > 0) {
          addLog(`\n⏰ EXPIRED BELIEFS:`);
          for (const expiredId of data.expired_beliefs) {
            addLog(`   🗑️  Deleted: ${expiredId.slice(0, 8)}...`);
          }
        }

        // Show errors if any
        if (data.errors && data.errors.length > 0) {
          addLog(`\n❌ ERRORS ENCOUNTERED:`);
          for (const error of data.errors) {
            addLog(`   ⚠️  ${error}`);
          }
        }

        // Compare final stakes and aggregates
        try {
          addLog(`\n💰 STAKE CHANGES:`);
          let totalStakeChanges = 0;

          for (const user of users) {
            if (user.agent_id && initialStakes[user.agent_id] !== undefined) {
              const { data: agentData } = await supabase
                .from('agents')
                .select('total_stake')
                .eq('id', user.agent_id)
                .single();

              if (agentData) {
                const initialStake = initialStakes[user.agent_id];
                const finalStake = agentData.total_stake;
                const change = finalStake - initialStake;

                if (Math.abs(change) > 0.001) {
                  const changeStr = change > 0 ? `+$${change.toFixed(2)}` : `-$${Math.abs(change).toFixed(2)}`;
                  addLog(`   💸 @${user.username}: $${initialStake.toFixed(2)} → $${finalStake.toFixed(2)} (${changeStr})`);
                  totalStakeChanges += Math.abs(change);
                } else {
                  addLog(`   💤 @${user.username}: $${initialStake.toFixed(2)} (no change)`);
                }
              }
            }
          }

          if (totalStakeChanges > 0.001) {
            addLog(`   🔄 Total stake movement: $${totalStakeChanges.toFixed(2)}`);
          } else {
            addLog(`   💤 No stake redistribution occurred`);
          }

          // Compare aggregates
          addLog(`\n📈 AGGREGATE CHANGES:`);
          let aggregateChanges = 0;

          for (const post of opinionPosts) {
            if (post.belief?.belief_id && initialAggregates[post.belief.belief_id] !== undefined) {
              const { data: beliefData } = await supabase
                .from('beliefs')
                .select('previous_aggregate')
                .eq('id', post.belief.belief_id)
                .single();

              if (beliefData) {
                const initialAggregate = initialAggregates[post.belief.belief_id];
                const finalAggregate = beliefData.previous_aggregate;
                const change = Math.abs(finalAggregate - initialAggregate);

                if (change > 0.001) {
                  addLog(`   📊 "${post.title}": ${(initialAggregate * 100).toFixed(1)}% → ${(finalAggregate * 100).toFixed(1)}%`);
                  aggregateChanges++;
                } else {
                  addLog(`   💤 "${post.title}": ${(initialAggregate * 100).toFixed(1)}% (no change)`);
                }
              }
            }
          }

          if (aggregateChanges === 0) {
            addLog(`   💤 No significant aggregate changes (< 0.1%)`);
          }

        } catch (error) {
          addLog(`⚠️  Could not compare final state: ${error}`);
        }

        await loadEpochStatus(); // Reload status
        await loadPosts(); // Reload posts to show updated state
        await loadDashboardUsers(); // Reload users to show stake changes

        addLog(`\n🎉 Epoch processing complete! Dashboard refreshed.`);
      } else {
        addLog(`❌ Failed to process epoch: ${data.error || 'Unknown error'}`);
        if (data.details) {
          addLog(`   Details: ${data.details}`);
        }
      }
    } catch (error) {
      addLog(`❌ Error processing epoch: ${error}`);
    }
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  const createUser = async () => {
    if (!newUsername.trim()) return;

    try {
      addLog(`Creating user: ${newUsername}`);

      const response = await fetch('/api/supabase/functions/v1/app-user-creation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          display_name: newUsername.trim()
        })
      });

      const data = await response.json();

      if (response.ok) {
        addLog(`✅ User created: ${data.user.username} (ID: ${data.user_id.slice(0, 8)}...)`);
        setNewUsername('');
        setShowCreateUserForm(false);
        loadData(); // Reload users
      } else {
        addLog(`❌ Failed to create user: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      addLog(`❌ Error creating user: ${error}`);
    }
  };

  const submitBelief = async (postId: string) => {
    if (!selectedUserId) {
      alert('Select a user first');
      return;
    }

    const beliefStr = prompt('Your belief (0-1):');
    const metaStr = prompt('Meta-prediction (0-1):');

    if (!beliefStr || !metaStr) return;

    const beliefValue = parseFloat(beliefStr);
    const metaPrediction = parseFloat(metaStr);

    if (isNaN(beliefValue) || beliefValue < 0 || beliefValue > 1) {
      alert('Belief must be a number between 0 and 1');
      return;
    }

    if (isNaN(metaPrediction) || metaPrediction < 0 || metaPrediction > 1) {
      alert('Meta-prediction must be a number between 0 and 1');
      return;
    }

    // Find the post and get its belief_id
    const post = opinionPosts.find(p => p.id === postId);
    if (!post || !post.belief_id) {
      alert('Post not found or not an opinion post');
      return;
    }

    // Find the selected user's agent_id
    const selectedUser = users.find(u => u.id === selectedUserId);
    if (!selectedUser) {
      alert('Selected user not found');
      return;
    }

    try {
      addLog(`Submitting belief to post ${postId.slice(0, 8)}...`);

      const response = await fetch('/api/supabase/functions/v1/protocol-beliefs-submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agent_id: selectedUser.agent_id,
          belief_id: post.belief_id,
          belief_value: beliefValue,
          meta_prediction: metaPrediction
        })
      });

      const data = await response.json();

      if (response.ok) {
        addLog(`✅ Belief submitted successfully! (${data.is_first_submission ? 'New' : 'Updated'} submission)`);
        // Reload posts to show the new submission
        await loadPosts();
      } else {
        addLog(`❌ Failed to submit belief: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      addLog(`❌ Error submitting belief: ${error}`);
    }
  };

  const toggleEpochProcessing = async () => {
    if (isEpochRunning) {
      await stopCronScheduling();
    } else {
      await startCronScheduling();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Protocol Dashboard</h1>
        <div className="flex items-center gap-4">
          <Badge variant="outline">Epoch {currentEpoch}</Badge>
          {epochStatus && (
            <>
              <Badge variant={isEpochRunning ? "default" : "secondary"}>
                {isEpochRunning ? 'Auto' : 'Manual'} {formatTimeRemaining(timeRemaining)}
              </Badge>
              <Badge variant={processingEnabled ? "default" : "destructive"}>
                Processing {processingEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Badge variant="outline">{epochInterval}m intervals</Badge>
            </>
          )}
        </div>
      </div>

      {/* User Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Active User</label>
              <select
                value={selectedUserId}
                onChange={(e) => {
                  const newUserId = e.target.value;
                  setSelectedUserId(newUserId);
                  // Save to localStorage so sidebar can access the selected user
                  if (newUserId) {
                    localStorage.setItem('selectedUserId', newUserId);
                  } else {
                    localStorage.removeItem('selectedUserId');
                  }
                }}
                className="w-full p-2 border rounded-md bg-neutral-100 dark:bg-neutral-700 text-black dark:text-white"
              >
                <option value="">Select user...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.display_name} (@{user.username}) - ${user.total_stake} stake
                  </option>
                ))}
              </select>
            </div>

            {!showCreateUserForm ? (
              <div className="flex gap-2">
                <Button onClick={() => setShowCreateUserForm(true)} variant="outline" className="flex-1">
                  Create New User
                </Button>
                <Button onClick={loadData} variant="outline" size="sm">
                  🔄
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">New Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full p-2 border rounded-md bg-neutral-100 dark:bg-neutral-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && createUser()}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setShowCreateUserForm(false);
                      setNewUsername('');
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={createUser}
                    disabled={!newUsername.trim()}
                    className="flex-1"
                  >
                    Create
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Epoch Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Indicator */}
            {epochStatus && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="text-sm font-medium">Epoch {epochStatus.current_epoch}</p>
                    <p className="text-xs text-muted-foreground">
                      {isEpochRunning ? 'Automated processing' : 'Manual processing only'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-mono font-bold">
                      {formatTimeRemaining(timeRemaining)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {timeRemaining > 0
                        ? 'until next epoch'
                        : epochStatus.cron_status === 'active'
                          ? 'processing overdue'
                          : 'epoch ended (cron stopped)'
                      }
                    </p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${timeRemaining > 0 ? 'bg-blue-500' : 'bg-red-500'}`}
                    style={{
                      width: (() => {
                        if (timeRemaining > 0 && epochStatus) {
                          const startTime = new Date(epochStatus.epoch_start_time);
                          const deadline = new Date(epochStatus.next_deadline);
                          const totalDuration = Math.floor((deadline.getTime() - startTime.getTime()) / 1000);
                          return `${Math.max(0, 100 - (timeRemaining / totalDuration) * 100)}%`;
                        }
                        return '100%';
                      })()
                    }}
                  ></div>
                </div>
              </div>
            )}

            {/* Start/Stop Controls */}
            <div className="flex gap-2">
              <Button
                onClick={toggleEpochProcessing}
                variant={isEpochRunning ? "destructive" : "default"}
                className="flex-1"
                disabled={!processingEnabled}
              >
{isEpochRunning ? 'Stop Cron' : 'Start Cron'}
              </Button>
              <Button
                onClick={manualTriggerEpoch}
                variant="outline"
                disabled={isEpochRunning}
                title="Force process current epoch now"
              >
                Trigger Now
              </Button>
            </div>

            {/* Timing Configuration */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Interval (minutes):</label>
                <input
                  type="number"
                  value={epochInterval}
                  onChange={(e) => setEpochInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 p-1 border rounded text-center bg-neutral-100 dark:bg-neutral-700 text-black dark:text-white"
                  min="1"
                  max="1440"
                />
                <span className="text-xs text-muted-foreground">
                  ({epochInterval * 60}s total)
                </span>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Changes apply when starting cron
              </p>
            </div>

            {/* Status Refresh */}
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                Status: {epochStatus ? epochStatus.cron_status : 'Loading...'}
              </span>
              <Button onClick={loadEpochStatus} variant="ghost" size="sm">
                🔄 Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Tabs */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('posts')}
                  className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
                    activeTab === 'posts'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  Opinion Posts ({opinionPosts.length})
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-4 py-2 text-sm font-medium rounded-r-lg border-t border-r border-b ${
                    activeTab === 'users'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  Users ({dashboardUsers.length})
                </button>
              </div>
            </div>
            <Button onClick={activeTab === 'posts' ? loadPosts : loadDashboardUsers} variant="outline" size="sm">
              🔄 Reload
            </Button>
          </div>
        </CardHeader>

        {activeTab === 'posts' && (
          <CardContent>
          {opinionPosts.length === 0 ? (
            <p className="text-muted-foreground">No opinion posts yet. Create one to start testing.</p>
          ) : (
            <div className="space-y-3">
              {opinionPosts.map(post => (
                <div key={post.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{post.title || 'Untitled'}</h3>
                      <p className="text-sm text-muted-foreground">by @{post.user.username}</p>
                    </div>
                    {post.belief_id && (
                      <Button
                        onClick={() => submitBelief(post.id)}
                        disabled={!selectedUserId}
                        variant="outline"
                        size="sm"
                      >
                        Submit Belief
                      </Button>
                    )}
                  </div>
                  {post.content && <p className="text-sm mb-2">{post.content}</p>}

                  {post.belief_id ? (
                    <div className="mt-3 space-y-3">
                      <div className="p-2 bg-muted rounded">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-mono text-muted-foreground">
                            Market: {post.belief_id.slice(0, 12)}...
                          </p>
                          {post.belief && (
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              <span>Aggregate: {(post.belief.previous_aggregate * 100).toFixed(1)}%</span>
                              <span>Status: {post.belief.status}</span>
                              <span>Expires: Epoch {post.belief.expiration_epoch}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {post.submissions && post.submissions.length > 0 && (
                        <div className="p-2 bg-muted/50 rounded">
                          <h4 className="text-xs font-semibold mb-2 text-muted-foreground">
                            Submissions ({post.submissions.length})
                          </h4>
                          <div className="space-y-2">
                            {post.submissions.map(submission => (
                              <div key={submission.submission_id} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">@{submission.user.username}</span>
                                  <span className="text-muted-foreground">
                                    believes {(submission.belief * 100).toFixed(1)}%
                                  </span>
                                  <span className="text-muted-foreground">
                                    (meta: {(submission.meta_prediction * 100).toFixed(1)}%)
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">
                                    ${submission.stake_allocated.toFixed(1)} stake
                                  </span>
                                  {submission.is_active ? (
                                    <span className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded text-xs">Active</span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">Inactive</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Regular post (no belief market)</p>
                  )}

                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(post.created_at).toLocaleDateString()} at {new Date(post.created_at).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          )}
          </CardContent>
        )}

        {activeTab === 'users' && (
          <CardContent>
            {dashboardUsers.length === 0 ? (
              <p className="text-muted-foreground">No users found. Create some users to start testing.</p>
            ) : (
              <div className="space-y-4">
                {dashboardUsers.map(user => (
                  <div key={user.user_id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{user.display_name}</h3>
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                        <p className="text-xs text-muted-foreground font-mono">Agent: {user.agent_id.slice(0, 12)}...</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">${user.total_stake} total stake</p>
                        <p className="text-xs text-muted-foreground">{user.active_belief_count} active beliefs</p>
                        <p className="text-xs text-muted-foreground">
                          ~${user.belief_participations.length > 0
                            ? (user.belief_participations.reduce((sum, p) => sum + p.stake_allocated, 0) / user.belief_participations.length).toFixed(1)
                            : '0'} avg per belief
                        </p>
                      </div>
                    </div>

                    {user.belief_participations.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground">
                          Belief Participations ({user.belief_participations.length})
                        </h4>
                        <div className="space-y-2">
                          {user.belief_participations.map(participation => (
                            <div key={participation.submission_id} className="p-3 bg-muted/50 rounded border-l-4 border-blue-200">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  {participation.post_context ? (
                                    <div>
                                      <p className="font-medium text-sm">{participation.post_context.title}</p>
                                      <p className="text-xs text-muted-foreground">Opinion Post</p>
                                      {participation.post_context.content_preview && (
                                        <p className="text-xs text-muted-foreground mt-1 italic">
                                          "{participation.post_context.content_preview}..."
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <div>
                                      <p className="font-medium text-sm">Protocol Belief</p>
                                      <p className="text-xs text-muted-foreground">Standalone belief market</p>
                                      <p className="text-xs text-muted-foreground font-mono">
                                        {participation.belief_id.slice(0, 20)}...
                                      </p>
                                    </div>
                                  )}
                                </div>
                                <div className="text-right ml-4">
                                  <p className="text-sm font-medium">
                                    {(participation.belief_value * 100).toFixed(1)}% belief
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    ${participation.stake_allocated.toFixed(1)} stake
                                  </p>
                                </div>
                              </div>
                              <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <div className="flex gap-3">
                                  <span>Meta: {(participation.meta_prediction * 100).toFixed(1)}%</span>
                                  <span>Market: {(participation.belief_info.current_aggregate * 100).toFixed(1)}%</span>
                                  <span>Status: {participation.belief_info.status}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {participation.is_active ? (
                                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full">Active</span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">Inactive</span>
                                  )}
                                  <span>Exp: E{participation.belief_info.expiration_epoch}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No belief participations yet</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-muted-foreground">No activity yet</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-muted-foreground">
                  {log}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
