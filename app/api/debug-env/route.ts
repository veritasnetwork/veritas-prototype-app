import { NextResponse } from 'next/server';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';

export async function GET() {
  let keypairTest: any = { error: 'not tested' };
  try {
    const kp = loadProtocolAuthority();
    keypairTest = {
      success: true,
      hasPublicKey: !!kp.publicKey,
      publicKeyType: typeof kp.publicKey,
      publicKey: kp.publicKey?.toBase58?.() || 'NO TOBASE58',
      keypairType: typeof kp,
      keypairKeys: Object.keys(kp),
    };
  } catch (e) {
    keypairTest = {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return NextResponse.json({
    hasProtocolAuthority: !!process.env.PROTOCOL_AUTHORITY_KEYPAIR,
    protocolAuthorityLength: process.env.PROTOCOL_AUTHORITY_KEYPAIR?.length || 0,
    protocolAuthorityPrefix: process.env.PROTOCOL_AUTHORITY_KEYPAIR?.substring(0, 20) || 'NOT SET',
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('PROTOCOL') || k.includes('NEXT_PUBLIC')),
    keypairTest,
  });
}