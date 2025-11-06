import { NextResponse } from 'next/server';

export async function GET() {
  // Extremely simple test - no params, no complex logic
  const result: any = {
    test: 'holdings-api',
    timestamp: new Date().toISOString(),
    steps: []
  };

  try {
    result.steps.push('1. Check env vars');
    result.hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    result.hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!result.hasUrl || !result.hasKey) {
      result.error = 'Missing environment variables';
      return NextResponse.json(result);
    }

    result.steps.push('2. Create Supabase client');
    const { createClient } = await import('@supabase/supabase-js');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    result.steps.push('3. Test query to users table');
    const { data, error } = await supabase
      .from('users')
      .select('id, username')
      .limit(1);

    if (error) {
      result.error = error.message;
      result.errorCode = error.code;
      return NextResponse.json(result);
    }

    result.steps.push('4. Success');
    result.userCount = data?.length || 0;
    result.success = true;

    return NextResponse.json(result);

  } catch (error) {
    result.catchError = error instanceof Error ? error.message : String(error);
    result.errorType = error?.constructor?.name;
    return NextResponse.json(result);
  }
}