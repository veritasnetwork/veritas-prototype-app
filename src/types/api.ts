/**
 * API Type Schemas
 * Zod schemas for API request/response validation and TypeScript type inference
 */

import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  display_name: z.string().nullable(),
  avatar_url: z.string().url().nullable().optional(),
});

export const APIErrorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
  code: z.string().optional(),
});

// ============================================================================
// POST API RESPONSE (from /api/posts/[id])
// ============================================================================

export const PostAPIResponseSchema = z.object({
  id: z.string().uuid(),
  authorId: z.string().uuid(),
  timestamp: z.string(), // ISO string
  createdAt: z.string(), // ISO string

  // Content fields
  post_type: z.enum(['text', 'image', 'video']),
  content_text: z.string().nullable(),
  content_json: z.any().nullable(), // Tiptap JSON
  caption: z.string().nullable(),
  media_urls: z.array(z.string().url()).nullable(),
  article_title: z.string().nullable(),
  cover_image_url: z.string().url().nullable(),
  image_display_mode: z.enum(['contain', 'cover']).optional(),

  // Author (nested)
  author: z.object({
    id: z.string().uuid(),
    username: z.string(),
    display_name: z.string().nullable(),
    avatar_url: z.string().url().nullable().optional(),
  }).nullable(),

  // Belief
  belief: z.null(), // TODO: Add belief schema when protocol integration complete

  // Pool data (ICBS)
  poolAddress: z.string().nullable(),
  poolSupplyLong: z.number().nullable(),
  poolSupplyShort: z.number().nullable(),
  poolPriceLong: z.number().nullable(),
  poolPriceShort: z.number().nullable(),
  poolSqrtPriceLongX96: z.string().nullable(),
  poolSqrtPriceShortX96: z.string().nullable(),
  poolVaultBalance: z.number().nullable(),
  poolReserveLong: z.number().nullable(),
  poolReserveShort: z.number().nullable(),
  poolLastSyncedAt: z.string().nullable(),
  // ICBS parameters
  poolF: z.number().optional(),
  poolBetaNum: z.number().optional(),
  poolBetaDen: z.number().optional(),
});

// ============================================================================
// TRADE HISTORY API (from /api/posts/[id]/trades)
// ============================================================================

export const ChartDataPointSchema = z.object({
  time: z.number(),
  value: z.number(),
});

export const VolumeDataPointSchema = z.object({
  time: z.number(),
  value: z.number(),
  color: z.string(),
});

export const TradeStatsSchema = z.object({
  totalVolume: z.number(),
  totalTrades: z.number(),
  volumeLong: z.number(),
  volumeShort: z.number(),
  // LONG token stats
  currentPriceLong: z.number(),
  highestPriceLong: z.number(),
  lowestPriceLong: z.number(),
  priceChangeLong24h: z.number(),
  priceChangePercentLong24h: z.number(),
  // SHORT token stats
  currentPriceShort: z.number(),
  highestPriceShort: z.number(),
  lowestPriceShort: z.number(),
  priceChangeShort24h: z.number(),
  priceChangePercentShort24h: z.number(),
});

export const TradeHistoryResponseSchema = z.object({
  priceLongData: z.array(ChartDataPointSchema),
  priceShortData: z.array(ChartDataPointSchema),
  volumeData: z.array(VolumeDataPointSchema),
  stats: TradeStatsSchema,
});

// ============================================================================
// RELEVANCE HISTORY API (from /api/posts/[id]/history)
// ============================================================================

// Reuses ChartDataPointSchema for both actual and implied relevance
export const RelevanceHistoryResponseSchema = z.object({
  actualRelevance: z.array(ChartDataPointSchema), // BD relevance scores (ground truth)
  impliedRelevance: z.array(ChartDataPointSchema), // Market-implied relevance (predictions)
});

// ============================================================================
// TRADE RECORDING (POST /api/trades/record)
// ============================================================================

export const TradeRecordRequestSchema = z.object({
  user_id: z.string().uuid(),
  pool_address: z.string(),
  post_id: z.string().uuid(),
  wallet_address: z.string(),
  trade_type: z.enum(['buy', 'sell']),
  token_amount: z.string(),
  usdc_amount: z.string(),
  tx_signature: z.string(),
});

// ============================================================================
// EXPORTED TYPES
// ============================================================================

export type User = z.infer<typeof UserSchema>;
export type APIError = z.infer<typeof APIErrorSchema>;
export type PostAPIResponse = z.infer<typeof PostAPIResponseSchema>;
export type ChartDataPoint = z.infer<typeof ChartDataPointSchema>;
export type VolumeDataPoint = z.infer<typeof VolumeDataPointSchema>;
export type TradeStats = z.infer<typeof TradeStatsSchema>;
export type TradeHistoryResponse = z.infer<typeof TradeHistoryResponseSchema>;
export type RelevanceHistoryResponse = z.infer<typeof RelevanceHistoryResponseSchema>;
export type TradeRecordRequest = z.infer<typeof TradeRecordRequestSchema>;
