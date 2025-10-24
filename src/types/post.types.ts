/**
 * Frontend types for the application
 * These types represent how data is used in the UI
 *
 * PHASE 3: Added dual schema support for rich media migration
 */

export interface Author {
  id?: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  // Legacy field for backward compatibility
  name?: string;
  avatar?: string;
}

export interface PostSignals {
  truth: number;
  novelty: number;
  importance: number;
  virality: number;
}

export interface BeliefData {
  yesPercentage: number;
  history?: BeliefHistoryPoint[];
}

export interface BeliefHistoryPoint {
  yesPercentage: number;
  recordedAt: Date;
}

/**
 * Post content types
 */
export type PostType = 'text' | 'image' | 'video';

/**
 * Tiptap JSON document structure
 */
export interface TiptapDocument {
  type: 'doc';
  content: TiptapNode[];
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TiptapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
}

/**
 * Post interface - NEW SCHEMA ONLY
 * All posts must have post_type and appropriate content fields
 */
export interface Post {
  id: string;

  // === CONTENT FIELDS (required based on post_type) ===
  post_type?: PostType;
  content_json?: TiptapDocument; // For text posts
  media_urls?: string[]; // For image/video posts
  caption?: string; // Optional caption for image/video posts
  content_text?: string; // Extracted plain text for search/preview

  // === ARTICLE-SPECIFIC FIELDS (optional for text posts) ===
  article_title?: string; // Optional dedicated title for articles
  cover_image_url?: string; // Optional cover/hero image for articles (requires article_title)

  // === COMMON FIELDS ===
  author: Author;
  timestamp: Date;
  relevanceScore: number;
  signals: PostSignals;
  sources?: string[];
  discussionCount: number;
  belief: BeliefData | null;
  poolAddress?: string; // Solana pool address for this post
  // ICBS parameters
  poolF?: number; // Growth exponent (default: 3)
  poolBetaNum?: number; // Beta numerator (default: 1)
  poolBetaDen?: number; // Beta denominator (default: 2)
  // ICBS pool state (cached from on-chain)
  poolSupplyLong?: number; // LONG token supply (atomic units)
  poolSupplyShort?: number; // SHORT token supply (atomic units)
  poolPriceLong?: number; // LONG token price in USDC
  poolPriceShort?: number; // SHORT token price in USDC
  poolSqrtPriceLongX96?: string; // LONG sqrt price in X96 format
  poolSqrtPriceShortX96?: string; // SHORT sqrt price in X96 format
  poolVaultBalance?: number; // USDC vault balance (micro-USDC)
  poolLastSyncedAt?: string; // Last sync timestamp
  totalVolumeUsdc?: number; // All-time total trading volume in USDC (cached)
  // Decayed pool state (enriched from on-chain)
  decayedPoolState?: DecayedPoolState | null;
}

/**
 * Decayed pool state from on-chain view function
 * Includes time-based decay calculations
 */
export interface DecayedPoolState {
  /** Relevance score (0.0 to 1.0) with decay applied */
  q: number;
  /** LONG price with decay applied (USDC per token) */
  priceLong: number;
  /** SHORT price with decay applied (USDC per token) */
  priceShort: number;
  /** Days since pool expiration (0 if not expired) */
  daysExpired: number;
  /** Days since last on-chain decay update */
  daysSinceLastUpdate: number;
  /** True if decay will be applied on next trade */
  decayPending: boolean;
  /** Unix timestamp when decay starts */
  expirationTimestamp: number;
  /** Unix timestamp of last on-chain decay execution */
  lastDecayUpdate: number;
}

/**
 * Helper: Get display title from post
 */
export function getPostTitle(post: Post): string {
  if (post.post_type === 'text') {
    // NEW: Prioritize article_title for text posts
    if (post.article_title) {
      return post.article_title;
    }

    // First try content_text (extracted plain text)
    if (post.content_text) {
      const text = post.content_text.trim();
      return text.length > 80 ? text.substring(0, 80) + '...' : text;
    }

    // Fallback: extract from content_json
    if (post.content_json) {
      // Extract first heading from Tiptap JSON
      const firstHeading = post.content_json.content.find(
        node => node.type === 'heading' && node.attrs?.level <= 2
      );
      if (firstHeading?.content?.[0]?.text) {
        return firstHeading.content[0].text;
      }

      // Fallback: extract first paragraph
      const firstPara = post.content_json.content.find(
        node => node.type === 'paragraph' && node.content && node.content.length > 0
      );
      if (firstPara?.content) {
        // Concatenate all text nodes in the paragraph
        const text = firstPara.content
          .filter(n => n.text)
          .map(n => n.text)
          .join('');
        if (text) {
          return text.length > 80 ? text.substring(0, 80) + '...' : text;
        }
      }
    }
  }

  if (post.post_type === 'image' || post.post_type === 'video') {
    return post.caption || 'Media post';
  }

  return 'Untitled';
}

/**
 * Helper: Get post preview text
 */
export function getPostPreview(post: Post, maxLength: number = 200): string {
  if (post.post_type === 'text' && post.content_text) {
    return post.content_text.length > maxLength
      ? post.content_text.substring(0, maxLength) + '...'
      : post.content_text;
  }

  if ((post.post_type === 'image' || post.post_type === 'video') && post.caption) {
    return post.caption.length > maxLength
      ? post.caption.substring(0, maxLength) + '...'
      : post.caption;
  }

  return '';
}

/**
 * Helper: Extract plain text from Tiptap JSON
 */
export function extractPlainTextFromTiptap(doc: TiptapDocument): string {
  function traverse(node: TiptapNode): string {
    if (node.text) return node.text;
    if (node.content) {
      return node.content.map(traverse).join(' ');
    }
    return '';
  }
  return traverse(doc).trim();
}

/**
 * Helper: Determine if a text post is short-form (tweet-like) or long-form (article)
 */
export function isShortFormPost(post: Post): boolean {
  if (post.post_type !== 'text') return false;

  // If has title or cover, it's an article
  if (post.article_title || post.cover_image_url) return false;

  // If content is short enough, it's a tweet-like post
  const textLength = post.content_text?.length || 0;
  return textLength > 0 && textLength <= 500; // ~500 char threshold
}

