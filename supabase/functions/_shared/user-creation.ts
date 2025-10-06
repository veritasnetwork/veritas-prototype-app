import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface CreateUserParams {
  supabaseClient: SupabaseClient;
  auth_provider: string;
  auth_id: string;
  username?: string;
  display_name?: string;
  initial_stake?: number;
  invite_code?: string;
}

interface CreateUserResult {
  user_id: string;
  agent_id: string;
  user: any;
}

export async function createUser(params: CreateUserParams): Promise<CreateUserResult> {
  const {
    supabaseClient,
    auth_provider,
    auth_id,
    username,
    display_name,
    initial_stake,
    invite_code
  } = params;

  // Validate required parameters
  if (!auth_provider || typeof auth_provider !== 'string' || auth_provider.trim() === '') {
    throw new Error('auth_provider is required');
  }

  if (!auth_id || typeof auth_id !== 'string' || auth_id.trim() === '') {
    throw new Error('auth_id is required');
  }

  // Check auth uniqueness
  const { data: existingUser } = await supabaseClient
    .from('users')
    .select('id')
    .eq('auth_provider', auth_provider.trim())
    .eq('auth_id', auth_id.trim())
    .single();

  if (existingUser) {
    throw new Error('User with these auth credentials already exists');
  }

  // Validate username if provided
  let finalUsername = username?.trim();
  if (finalUsername) {
    if (typeof finalUsername !== 'string' || finalUsername.length < 2 || finalUsername.length > 50) {
      throw new Error('username must be between 2 and 50 characters');
    }

    // Check username uniqueness
    const { data: existingUsername } = await supabaseClient
      .from('users')
      .select('id')
      .eq('username', finalUsername)
      .single();

    if (existingUsername) {
      throw new Error('Username already exists');
    }
  } else {
    // Generate username
    if (invite_code && invite_code.trim()) {
      const cleanPattern = `user:${invite_code.trim()}`;
      const { data: collision } = await supabaseClient
        .from('users')
        .select('id')
        .eq('username', cleanPattern)
        .single();

      if (!collision) {
        finalUsername = cleanPattern;
      } else {
        const uniqueId = crypto.randomUUID().slice(-8);
        finalUsername = `user:${invite_code.trim()}-${uniqueId}`;
      }
    } else {
      const timestamp = Date.now().toString().slice(-6);
      const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      finalUsername = `${auth_provider.toLowerCase()}${timestamp}${randomSuffix}`;
    }
  }

  // Create protocol agent
  const agentResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/protocol-agents-create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(initial_stake !== undefined ? { initial_stake } : {}),
  });

  if (!agentResponse.ok) {
    const agentError = await agentResponse.text();
    throw new Error(`Failed to create agent: ${agentError}`);
  }

  const { agent_id, total_stake } = await agentResponse.json();

  // Create user record
  const finalDisplayName = display_name || finalUsername;
  const { data: user, error: userError } = await supabaseClient
    .from('users')
    .insert({
      agent_id,
      auth_provider: auth_provider.trim(),
      auth_id: auth_id.trim(),
      username: finalUsername,
      display_name: finalDisplayName,
      total_stake,
      beliefs_created: 0,
      beliefs_participated: 0
    })
    .select('*')
    .single();

  if (userError) {
    throw new Error(`Failed to create user: ${userError.message}`);
  }

  return {
    user_id: user.id,
    agent_id: agent_id,
    user: user
  };
}
