# Specification Consistency Analysis: Feed Data

## Cross-Layer Data Flow Analysis

### 1. App Layer Spec: `/app/posts/get-feed`
**Source**: `/specs/edge-function-specs/02-app-functions.md:89-106`

**Expected Response**:
- `posts`: Array of post objects with embedded belief data
- `total_count`: Total posts available

**Process**:
1. Query posts from app database
2. **For opinion posts, enrich with belief market data from protocol**
3. Return feed data optimized for UI display

### 2. UI Layer Specs: Feed Loading
**Sources**:
- `/specs/ui-specs/01-feed-loading.md`
- `/specs/ui-specs/low-level-ui-specs/01-feed-loading.md:19`

**Expected Data Transformation**:
- Extract: `id`, `title`, `content`, `created_at`, `user.display_name || user.username`
- Classify as opinion if `opinion_belief_id` exists
- **Calculate opinion percentage: `Math.round(belief.initial_aggregate * 100)`**
- Display opinion belief aggregate in orange circular indicator for opinion posts only

### 3. Protocol Layer: Belief Data
**Sources**:
- `/specs/edge-function-specs/01-protocol-functions.md:101-113`
- `/specs/data-structures/01-protocol-tables.md:5-18`

**Available Belief Data**:
- `previous_aggregate`: Post-mirror descent aggregate from last epoch
- `previous_disagreement_entropy`: Disagreement entropy
- `participant_count`: Number of agents with submissions
- `expiration_epoch`: When market expires
- `creator_agent_id`: Who created the belief

### 4. App Database Schema
**Source**: `/specs/data-structures/02-app-tables.md:23-38`

**Post Table Fields**:
- `opinion_belief_id`: Associated belief market (null if not opinion)
- `is_opinion`: Whether this post has an associated belief market

## 🚨 INCONSISTENCIES IDENTIFIED

### 1. **Field Name Mismatch**
- **Protocol**: `previous_aggregate` (decimal 0-1)
- **UI Spec**: Expects `belief.initial_aggregate`
- **Current API**: Returns `undefined` (missing entirely)

### 2. **Missing Data Enrichment**
- **App Spec**: "enrich with belief market data from protocol" ✅ Specified
- **Current Reality**: API returns posts without belief data ❌ Not implemented
- **Root Cause**: `/protocol/beliefs/get` function not called to enrich opinion posts

### 3. **Semantic Confusion**
- **Protocol Field**: `previous_aggregate` = "Post-mirror descent aggregate from **last epoch**"
- **UI Expectation**: Current/live aggregate for display
- **Question**: Should UI show last epoch's aggregate or current submissions?

### 4. **Data Flow Gap**
The app layer should:
1. Query posts from app database
2. For posts with `opinion_belief_id != null`:
   - Call `/protocol/beliefs/get` with the belief_id
   - Attach belief data to post object
3. Return enriched post objects

**Current Reality**: Step 2 is missing entirely.

## ✅ RECOMMENDATIONS

### Immediate Fix (Current Approach)
- ✅ **Default to 0.5 until belief aggregation implemented** (matches current implementation)
- ✅ **Update specs to reflect 0.5 default**

### Proper Implementation (Future)
1. **Fix `/app/posts/get-feed`** to call `/protocol/beliefs/get` for opinion posts
2. **Standardize field names**: Either use `previous_aggregate` everywhere or `initial_aggregate`
3. **Update UI spec** to expect `belief.previous_aggregate` instead of `belief.initial_aggregate`

### Spec Alignment Needed
**Protocol Spec**: Clarify if `previous_aggregate` is the right field for UI display, or if we need a "current_aggregate" field

**App Spec**: Add explicit step: "Call `/protocol/beliefs/get` for each opinion_belief_id"

**UI Spec**: Update to use correct field name from protocol spec

## 🎯 CONSISTENCY STATUS

| Layer | Field Expected | Current Status | Fix Required |
|-------|---------------|----------------|--------------|
| Protocol | `previous_aggregate` | ✅ Defined | None |
| App API | `belief` object | ❌ Missing | Enrich with protocol data |
| UI | `belief.initial_aggregate` | ⚠️ Wrong field name | Update to `previous_aggregate` |
| Current Code | `belief?.initial_aggregate ?? 0.5` | ✅ Works with fallback | Update field name when API fixed |

## 📋 ACTION ITEMS

1. **Immediate**: Keep 0.5 default (✅ Done)
2. **Next**: Fix app layer to call protocol for belief enrichment
3. **Then**: Update UI specs to use correct field names
4. **Finally**: Remove 0.5 fallback when real aggregates available