/**
 * Manually decode settlement event data
 */

const programData = "MITabzatPYFI4XevTSwdE1IRt36rHd/r/8uV4IxSj7Wum0KSKWVvDYVycK7AcKnbBcZz6s4XEuDgGNNHPDFZgKP8RgBBGIQEAQAAAAAAAAD7fwQAsNkJAAAAAAAAAAAAAAAAAH34BgAAAAAAAAAAAAAAAACWWh4AAAAAAAAAAAAAAAAATCLMXQAAAAAAAAAAAAAAAHIkgDMAAAAAAAAAAAAAAADNcdkqAAAAAAAAAAAAAAAA8dRyZgAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAIqdvZV54OAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAANU+HY8ZqD8AAAAAAAAAAACxOQFpAAAAAA==";

const buffer = Buffer.from(programData, 'base64');

console.log('\n========== RAW SETTLEMENT DATA ==========');
console.log('Total bytes:', buffer.length);
console.log('First 32 bytes (hex):', buffer.subarray(0, 32).toString('hex'));

// Event discriminator is 8 bytes at the start
const discriminator = buffer.subarray(0, 8);
console.log('\nEvent discriminator:', discriminator.toString('hex'));

// Pool public key (32 bytes)
const poolStart = 8;
const poolBytes = buffer.subarray(poolStart, poolStart + 32);
console.log('\nPool pubkey bytes:', poolBytes.toString('hex'));

// Epoch (u32 at byte 40, little-endian)
const epochOffset = poolStart + 32;
const epoch = buffer.readUInt32LE(epochOffset);
console.log('\nEpoch:', epoch);

// BD score (u32 at byte 48, little-endian)
const bdScoreOffset = epochOffset + 8;
const bdScoreMillionths = buffer.readUInt32LE(bdScoreOffset);
const bdScoreDecimal = bdScoreMillionths / 1_000_000;
console.log('\nBD Score:');
console.log('  Millionths:', bdScoreMillionths);
console.log('  Decimal:', bdScoreDecimal);
console.log('  Percentage:', (bdScoreDecimal * 100).toFixed(2) + '%');

// Reserves (u64 values, 8 bytes each, little-endian)
const rLongBeforeOffset = bdScoreOffset + 8;
const rLongBefore = Number(buffer.readBigUInt64LE(rLongBeforeOffset));
console.log('\nR_LONG_BEFORE:');
console.log('  Micro-USDC:', rLongBefore);
console.log('  USDC:', (rLongBefore / 1_000_000).toFixed(2));

const rShortBeforeOffset = rLongBeforeOffset + 8;
const rShortBefore = Number(buffer.readBigUInt64LE(rShortBeforeOffset));
console.log('\nR_SHORT_BEFORE:');
console.log('  Micro-USDC:', rShortBefore);
console.log('  USDC:', (rShortBefore / 1_000_000).toFixed(2));

const rLongAfterOffset = rShortBeforeOffset + 8;
const rLongAfter = Number(buffer.readBigUInt64LE(rLongAfterOffset));
console.log('\nR_LONG_AFTER:');
console.log('  Micro-USDC:', rLongAfter);
console.log('  USDC:', (rLongAfter / 1_000_000).toFixed(2));

const rShortAfterOffset = rLongAfterOffset + 8;
const rShortAfter = Number(buffer.readBigUInt64LE(rShortAfterOffset));
console.log('\nR_SHORT_AFTER:');
console.log('  Micro-USDC:', rShortAfter);
console.log('  USDC:', (rShortAfter / 1_000_000).toFixed(2));

// Calculate implied relevance
const totalBefore = rLongBefore + rShortBefore;
const totalAfter = rLongAfter + rShortAfter;
const impliedBefore = (rLongBefore / totalBefore) * 100;
const impliedAfter = (rLongAfter / totalAfter) * 100;

console.log('\nIMPLIED RELEVANCE:');
console.log('  Before settlement:', impliedBefore.toFixed(2) + '%');
console.log('  After settlement:', impliedAfter.toFixed(2) + '%');

// Scaling factors (u32 millionths)
const fLongOffset = rShortAfterOffset + 8;
const fLongMillionths = buffer.readUInt32LE(fLongOffset);
const fLong = fLongMillionths / 1_000_000;

const fShortOffset = fLongOffset + 8;
const fShortMillionths = buffer.readUInt32LE(fShortOffset);
const fShort = fShortMillionths / 1_000_000;

console.log('\nSCALING FACTORS:');
console.log('  f_long:', fLong.toFixed(6), `(${fLongMillionths} millionths)`);
console.log('  f_short:', fShort.toFixed(6), `(${fShortMillionths} millionths)`);

// Market prediction q (u32 millionths)
const qOffset = fShortOffset + 8;
const qMillionths = buffer.readUInt32LE(qOffset);
const q = qMillionths / 1_000_000;

console.log('\nMARKET PREDICTION:');
console.log('  q:', q.toFixed(6), `(${qMillionths} millionths)`);
console.log('  q percentage:', (q * 100).toFixed(2) + '%');

console.log('\n========================================\n');
