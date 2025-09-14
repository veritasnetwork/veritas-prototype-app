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
  media_urls: string[];
  opinion_belief_id: string | null;
  user_id: string;
  created_at: string;
  user: {
    username: string;
    display_name: string;
  };
  belief?: {
    belief_id: string;
    initial_aggregate: number;
    expiration_epoch: number;
    status: string;
    participant_count: number;
  };
}

export default function DashboardPage() {
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [epochInterval, setEpochInterval] = useState(30);
  const [isEpochRunning, setIsEpochRunning] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [opinionPosts, setOpinionPosts] = useState<OpinionPost[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    loadData();

    // Load previously selected user from localStorage
    const savedUserId = localStorage.getItem('selectedUserId');
    if (savedUserId) {
      setSelectedUserId(savedUserId);
    }
  }, []);

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

      // Load posts
      await loadPosts();

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

      const response = await fetch('http://127.0.0.1:54321/functions/v1/app-post-get-feed', {
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

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  };

  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  const createUser = async () => {
    if (!newUsername.trim()) return;

    try {
      addLog(`Creating user: ${newUsername}`);

      const response = await fetch('http://127.0.0.1:54321/functions/v1/app-user-creation', {
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

    const belief = prompt('Your belief (0-1):');
    const meta = prompt('Meta-prediction (0-1):');

    if (!belief || !meta) return;

    addLog(`Submitting belief to post ${postId.slice(0, 8)}...`);
    // TODO: Call /api/app/posts/submit-opinion
  };

  const processEpoch = async () => {
    addLog(`Processing epoch ${currentEpoch}...`);
    // TODO: Call /api/protocol/epochs/process-all
  };

  const toggleEpochProcessing = () => {
    setIsEpochRunning(!isEpochRunning);
    addLog(isEpochRunning ? 'Stopped epoch processing' : `Started epoch processing (${epochInterval}s intervals)`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Protocol Dashboard</h1>
        <div className="flex items-center gap-4">
          <Badge variant="outline">Epoch {currentEpoch}</Badge>
          <Badge variant="outline">{epochInterval}s intervals</Badge>
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
            <div className="flex gap-2">
              <Button
                onClick={toggleEpochProcessing}
                variant={isEpochRunning ? "destructive" : "outline"}
                className="flex-1"
              >
                {isEpochRunning ? 'Stop Cron' : 'Start Cron'}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm">Interval (seconds):</label>
              <input
                type="number"
                value={epochInterval}
                onChange={(e) => setEpochInterval(parseInt(e.target.value))}
                className="w-20 p-1 border rounded text-center bg-neutral-100 dark:bg-neutral-700 text-black dark:text-white"
                min="5"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Opinion Posts */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Opinion Posts ({opinionPosts.length})</CardTitle>
            <Button onClick={loadPosts} variant="outline" size="sm">
              🔄 Reload
            </Button>
          </div>
        </CardHeader>
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
                    {post.opinion_belief_id && (
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

                  {post.opinion_belief_id ? (
                    <div className="mt-3 p-2 bg-muted rounded">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-mono text-muted-foreground">
                          Market: {post.opinion_belief_id.slice(0, 12)}...
                        </p>
                        {post.belief && (
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>Aggregate: {(post.belief.initial_aggregate * 100).toFixed(1)}%</span>
                            <span>Participants: {post.belief.participant_count}</span>
                            <span>Expires: Epoch {post.belief.expiration_epoch}</span>
                          </div>
                        )}
                      </div>
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