# Belief Submissions Indexer

Retrieves and enriches belief submission data with user information and stake calculations for analysis and dashboard display.

## Purpose
Provides read-only access to belief submission data with enrichment for external systems, dashboards, and analytics. This is a **query/indexer function** that does not modify protocol state.

## Inputs
- Belief identifier: $b_{id}$
- Optional filtering and pagination parameters

## Outputs
- Complete belief metadata and status
- All submissions for the belief with user context
- Real-time stake calculations for each participant
- Enriched user information (usernames, display names)

## Data Aggregation

**Belief Context:**
- Current status and expiration information
- Aggregate belief value and disagreement metrics
- Creator information and temporal data

**Submission Enrichment:**
For each submission $(s_i, a_i, p_i, m_i)$:
- $s_i$ = submission identifier
- $a_i$ = agent identifier → enriched with user data
- $p_i$ = belief value $\in [0,1]$
- $m_i$ = meta-prediction $\in [0,1]$

**Stake Calculation Integration:**
Real-time effective stake computation:
$$S_{effective,i} = \frac{S_{total,i}}{n_{beliefs,i}}$$

## Indexer Characteristics

**Read-Only Operation:**
- No state modifications
- No protocol logic execution
- Pure data retrieval and enrichment

**External Dependencies:**
- Calls epistemic weights calculator for stake data
- Joins with user management system for display names
- Real-time computation of derived values

**Performance Optimized:**
- Single belief focus for efficient querying
- Batch processing of stake calculations
- Minimal data fetching with selective enrichment

## Purpose in Architecture
Separates data indexing/querying concerns from protocol execution logic. Essential for external dashboard systems, analytics, and monitoring tools that need enriched views of protocol state without participating in protocol operations.