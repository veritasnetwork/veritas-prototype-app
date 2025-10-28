/**
 * Health Check Endpoint
 *
 * Used for:
 * - Uptime monitoring (UptimeRobot, Pingdom, etc.)
 * - Load balancer health checks
 * - Deployment verification
 * - Service status dashboards
 *
 * Returns:
 * - 200 OK if service is healthy
 * - 503 Service Unavailable if critical dependencies are down
 */

import { NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

export async function GET() {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    checks: {
      database: 'checking',
      rateLimit: 'checking',
    },
  };

  try {
    // Check 1: Database connectivity
    const supabase = getSupabaseServiceRole();
    const { error: dbError } = await supabase
      .from('users')
      .select('id')
      .limit(1)
      .single();

    // Database is healthy if we can query it (even if no results)
    checks.checks.database = dbError?.code === 'PGRST116' || !dbError ? 'healthy' : 'unhealthy';

    // Check 2: Rate limiting (Redis)
    const hasRedis = !!(
      process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN
    );
    checks.checks.rateLimit = hasRedis ? 'enabled' : 'disabled';

    // Determine overall health
    const isHealthy = checks.checks.database === 'healthy';

    if (isHealthy) {
      return NextResponse.json(checks, { status: 200 });
    } else {
      return NextResponse.json(
        {
          ...checks,
          status: 'degraded',
        },
        { status: 503 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        ...checks,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

/**
 * HEAD request for simple uptime checks
 * Returns 200 if service is running (doesn't check dependencies)
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
