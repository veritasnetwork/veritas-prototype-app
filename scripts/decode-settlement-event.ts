/**
 * Decode settlement event from base64 program data
 */

import { BorshCoder, EventParser } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import idl from '../src/lib/solana/target/idl/veritas_curation.json';

const programData = "MITabzatPYFI4XevTSwdE1IRt36rHd/r/8uV4IxSj7Wum0KSKWVvDYVycK7AcKnbBcZz6s4XEuDgGNNHPDFZgKP8RgBBGIQEAQAAAAAAAAD7fwQAsNkJAAAAAAAAAAAAAAAAAH34BgAAAAAAAAAAAAAAAACWWh4AAAAAAAAAAAAAAAAATCLMXQAAAAAAAAAAAAAAAHIkgDMAAAAAAAAAAAAAAADNcdkqAAAAAAAAAAAAAAAA8dRyZgAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAIqdvZV54OAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAANU+HY8ZqD8AAAAAAAAAAACxOQFpAAAAAA==";

try {
  const coder = new BorshCoder(idl as any);
  const programId = new PublicKey('GUUnua8NmaJQKvseg1oGXcZn3Ddh1RGrDnaiXRzQUvew');
  const eventParser = new EventParser(programId, coder);

  const eventData = Buffer.from(programData, 'base64');
  console.log('Parsing event data...');
  const events = eventParser.parseLogs([`Program data: ${programData}`]);
  console.log('Found', events.length, 'events');

  for (const event of events) {
    console.log('\n========== SETTLEMENT EVENT ==========');
    console.log('Event Name:', event.name);
    console.log('Event Data:', JSON.stringify(event.data, null, 2));

    if (event.name === 'PoolSettled') {
      const data = event.data as any;
      console.log('\n--- Parsed Values ---');
      console.log('Pool:', data.pool?.toBase58());
      console.log('Epoch:', data.epoch?.toString());
      console.log('BD Score (millionths):', data.bd_score?.toString());
      console.log('BD Score (decimal):', Number(data.bd_score) / 1_000_000);

      console.log('\nReserves BEFORE:');
      console.log('  R_LONG:', data.r_long_before?.toString(), `($${Number(data.r_long_before) / 1_000_000})`);
      console.log('  R_SHORT:', data.r_short_before?.toString(), `($${Number(data.r_short_before) / 1_000_000})`);

      console.log('\nReserves AFTER:');
      console.log('  R_LONG:', data.r_long_after?.toString(), `($${Number(data.r_long_after) / 1_000_000})`);
      console.log('  R_SHORT:', data.r_short_after?.toString(), `($${Number(data.r_short_after) / 1_000_000})`);

      console.log('\nImplied Relevance:');
      const totalBefore = Number(data.r_long_before) + Number(data.r_short_before);
      const totalAfter = Number(data.r_long_after) + Number(data.r_short_after);
      console.log('  Before:', ((Number(data.r_long_before) / totalBefore) * 100).toFixed(2) + '%');
      console.log('  After:', ((Number(data.r_long_after) / totalAfter) * 100).toFixed(2) + '%');

      console.log('\nScaling Factors (millionths):');
      console.log('  f_long:', data.f_long?.toString(), `(${Number(data.f_long) / 1_000_000})`);
      console.log('  f_short:', data.f_short?.toString(), `(${Number(data.f_short) / 1_000_000})`);

      console.log('\nMarket Prediction:');
      console.log('  q (millionths):', data.market_prediction_q?.toString(), `(${Number(data.market_prediction_q) / 1_000_000})`);
    }
    console.log('======================================\n');
  }
} catch (error) {
  console.error('Failed to parse event:', error);
}
