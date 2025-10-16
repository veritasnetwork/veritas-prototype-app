# Veritas Data Conventions

This document defines naming, unit, and data flow conventions across the Veritas application.

---

## Naming Standards

### Database

- **Style:** `snake_case`
- **Examples:** `token_supply`, `reserve_balance`, `created_at`, `post_type`

### API Responses

- **Style:** `camelCase` (with some exceptions for compatibility)
- **Examples:** `tokenSupply`, `reserveBalance`, `createdAt`
- **Exceptions:** Some fields kept as `snake_case` for consistency with database (e.g., `post_type`, `content_json`)

### Frontend Types

- **Properties:** `camelCase`
- **Types/Interfaces:** `PascalCase`
- **Examples:** `poolAddress`, `Post`, `TradeStats`

---

## Unit Conventions

### Token Amounts

- **Database:** String (atomic units, 6 decimal precision)
  - Example: `"15432000000"` = 15,432 tokens
- **API Response:** Number (atomic units)
  - Example: `15432000000`
- **Solana Chain:** `u128` (atomic units)
- **UI Display:** Number (display units = atomic / 1,000,000)
  - Example: `15432` tokens

**Conversion:**

```typescript
// Atomic to Display
const displayUnits = atomicUnits / 1_000_000;

// Display to Atomic
const atomicUnits = Math.floor(displayUnits * 1_000_000);
```

### USDC Amounts

- **Database:** String (micro-USDC, 6 decimals)
  - Example: `"2483000000"` = $2,483
- **API Response:** Number (micro-USDC)
  - Example: `2483000000`
- **Solana Chain:** `u64` (micro-USDC)
- **UI Display:** Number (dollars = micro / 1,000,000)
  - Example: `$2,483.00`

### Prices

- **Precision:** 4-6 decimal places
- **Format:** `$0.0012` or `$1.2345`
- **Calculation:** Price = reserve / (k × supply²) using bonding curve

---

## Data Flow

```
┌─────────────────────────────────────────────────┐
│ Database (Supabase PostgreSQL)                  │
│ - snake_case field names                        │
│ - Strings for large numbers                     │
│ - Timestamps as ISO strings                     │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│ API Routes (Next.js /app/api)                   │
│ - Transform snake_case → camelCase              │
│ - Parse strings → numbers                       │
│ - Validate with Zod schemas                     │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│ PostsService (src/services/posts.service.ts)    │
│ - Transform API response → Post type            │
│ - Add computed fields (signals, etc.)           │
│ - Convert ISO strings → Date objects            │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│ UI Components                                    │
│ - Convert atomic → display units                │
│ - Format numbers (k/m suffixes)                 │
│ - Display to user                               │
└─────────────────────────────────────────────────┘
```

---

## Field Mapping

Complete mapping of field names across layers:

| Concept         | Database                 | API Response                  | Frontend Type                   | UI Display                 |
| --------------- | ------------------------ | ----------------------------- | ------------------------------- | -------------------------- |
| Token Supply    | `token_supply` (string)  | `poolTokenSupply` (number)    | `poolTokenSupply` (number)      | `totalSupply` (display)    |
| Reserve Balance | `reserve` (string)       | `poolReserveBalance` (number) | `poolReserveBalance` (number)   | `reserveBalance` (dollars) |
| Bonding Curve K | `k_quadratic` (string)   | `poolKQuadratic` (number)     | `poolKQuadratic` (number)       | -                          |
| Post Type       | `post_type` (enum)       | `post_type` (enum)            | `post_type` (enum)              | -                          |
| Content         | `content_json` (jsonb)   | `content_json` (object)       | `content_json` (TiptapDocument) | Rendered HTML              |
| Created At      | `created_at` (timestamp) | `createdAt` (string)          | `timestamp` (Date)              | Formatted date             |
| Author ID       | `user_id` (uuid)         | `authorId` (uuid)             | `author.id` (string)            | -                          |

---

## Error Response Format

All API errors use this standard format:

```json
{
  "error": "Human-readable error message",
  "details": "Optional additional details",
  "code": "ERROR_CODE"
}
```

**Common Error Codes:**

- `POST_NOT_FOUND` - Post doesn't exist (404)
- `POOL_NOT_FOUND` - Pool not deployed for post (404)
- `INVALID_RESPONSE` - Data validation failed (500)
- `DATABASE_UNAVAILABLE` - Cannot connect to Supabase (503)

---

## Type Safety

### Zod Schemas

All API responses are validated using Zod schemas defined in `src/types/api.ts`:

```typescript
import { PostAPIResponseSchema } from "@/types/api";

// Validate API response
const validated = PostAPIResponseSchema.parse(data);
// TypeScript now knows exact shape of validated data
```

### Type Inference

Types are automatically inferred from Zod schemas:

```typescript
export type PostAPIResponse = z.infer<typeof PostAPIResponseSchema>;
// No manual type definition needed!
```

---

## Best Practices

1. **Always use Zod validation** for API responses
2. **Convert units at the edges** - Keep atomic units internally, convert only for display
3. **Use type-safe field names** - Import types from `@/types/api` or `@/types/post.types`
4. **Log validation errors** in development, fail in production
5. **Document new fields** in this file when adding to schemas

---

**Last Updated:** October 14, 2025
