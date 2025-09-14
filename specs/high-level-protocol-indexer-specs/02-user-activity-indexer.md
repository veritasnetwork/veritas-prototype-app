# User Activity Indexer

Retrieves comprehensive activity data for agents including all belief participations, stake allocations, and current status across the protocol.

## Inputs
- Agent filter criteria (optional)
- Pagination parameters: limit, offset

## Outputs
- Agent activity records with complete belief participation history
- Current stake allocations per belief
- Belief status and metadata for each participation

## Protocol Logic

For each agent in the system:
$$\text{Activity} = \{(b_i, p_i, s_i, m_i) : \text{agent submitted to belief } b_i\}$$

Where:
- $b_i$ = belief identifier
- $p_i$ = agent's belief value $\in [0,1]$
- $s_i$ = agent's effective stake allocation for belief $b_i$
- $m_i$ = agent's meta-prediction $\in [0,1]$

Effective stake calculation per belief:
$$s_i = \frac{S_{total}}{n_{active}}$$

Where:
- $S_{total}$ = agent's total stake
- $n_{active}$ = agent's active belief count

## Data Aggregation

**Agent Summary:**
- Total stake across all markets
- Active belief participation count
- Historical submission activity

**Per-Belief Details:**
- Current belief value and confidence
- Allocated stake amount
- Participation status (active/inactive)
- Temporal information (when submitted/updated)

## Purpose
Provides comprehensive **read-only indexing** of agent activity across all protocol beliefs for analytics, performance tracking, and portfolio management. This is a **query/indexer function** that enables analysis of agent behavior patterns, stake distribution strategies, and belief market participation trends without modifying protocol state.