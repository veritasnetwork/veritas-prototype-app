# Protocol Indexer Edge Functions

Protocol indexer operations provide **read-only access** to protocol state with enrichment and aggregation for external systems, dashboards, and analytics. These functions **do not modify protocol state** and are separate from core protocol logic.

## Purpose
Protocol indexers enable efficient querying and analysis of protocol data without participating in protocol operations. Critical for dashboard systems, analytics tools, and external integrations that need enriched views of protocol state.

## Architectural Separation
- **Protocol Functions**: State modification, logic execution, consensus operations
- **Protocol Indexer Functions**: Read-only queries, data enrichment, analytics aggregation
- **App Functions**: User-facing operations that combine protocol and app concerns

## Indexer Functions

### /protocol-indexer/beliefs/get-submissions
Retrieves and enriches belief submission data with user information and stake calculations.
**Input:** `belief_id`
**Output:** `belief_info`, `submissions` with user context and real-time stake data

### /protocol-indexer/users/get-activity
Retrieves comprehensive activity data for agents including all belief participations and stake allocations.
**Input:** `agent_ids`, `limit`, `offset`
**Output:** `agent_activities` with complete participation history and current stakes

## Key Characteristics

**Read-Only Operations:**
- No protocol state modifications
- No consensus participation
- Pure data retrieval and enrichment

**External Integration:**
- Real-time stake calculations via protocol functions
- User context enrichment from app databases
- Optimized for dashboard and analytics consumption

**Performance Optimized:**
- Batch processing capabilities
- Efficient pagination and filtering
- Caching-friendly data structures
- Minimal protocol function calls

## Usage Patterns
- Dashboard real-time displays
- Analytics and reporting systems
- Portfolio management interfaces
- Protocol state monitoring tools
- External API integrations

## Dependencies
- **Protocol Functions**: For real-time calculations (stakes, aggregations)
- **App Databases**: For user context and display enrichment
- **System Config**: For current epoch and protocol parameters