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

  // Author (nested)
  author: z.object({
    id: z.string().uuid(),
    username: z.string(),
    display_name: z.string().nullable(),
    avatar_url: z.string().url().nullable().optional(),
  }).nullable(),

  // Belief
  belief: z.null(), // TODO: Add belief schema when protocol integration complete

  // Pool data
  poolAddress: z.string().nullable(),
  poolTokenSupply: z.number().nullable(),
  poolReserveBalance: z.number().nullable(),
  poolKQuadratic: z.number(),

  // Metadata
  likes: z.number(),
  views: z.number(),
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
  highestPrice: z.number(),
  lowestPrice: z.number(),
  currentPrice: z.number(),
  priceChange24h: z.number(),
  priceChangePercent24h: z.number(),
});

export const TradeHistoryResponseSchema = z.object({
  priceData: z.array(ChartDataPointSchema),
  volumeData: z.array(VolumeDataPointSchema),
  stats: TradeStatsSchema,
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
  token_supply_after: z.string(),
  reserve_after: z.string(),
  k_quadratic: z.string(),
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
export type TradeRecordRequest = z.infer<typeof TradeRecordRequestSchema>;
