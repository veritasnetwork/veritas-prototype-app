# Performance Improvements

## Active Belief Count Calculation

### Current: Dynamic Calculation
`get_agent_active_belief_count(agent_id)` runs `COUNT(*)` query per agent

### Performance Impact
- **Load:** O(n) queries vs O(1) with stored field
- **Scale:** 10-50x more database load for 100+ agent markets
- **Bottleneck:** Quadratic degradation during epoch processing

### Trade-offs
| Aspect | Dynamic | Stored Field |
|--------|---------|--------------|
| Database load | High | Low |
| Consistency | Always accurate | Requires maintenance |
| Complexity | Simple | Medium |

### Recommendation
**Use stored field for production.** Critical for markets >50 agents.

**Alternatives:** Redis caching, batch queries, materialized views