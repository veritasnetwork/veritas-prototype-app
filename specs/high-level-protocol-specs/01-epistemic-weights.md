# Epistemic Weights & Stake Scaling

Defines how agent stakes are distributed across multiple belief markets and converted to normalized voting weights for aggregation and scoring.

## Inputs
- Agent total stakes: $S_{total,i}$
- Active belief counts: $n_{beliefs,i}$ (beliefs agent participates in)
- Belief participants: set of agent IDs in belief market

## Outputs
- Normalized epistemic weights: $w_i$ where $\sum_i w_i = 1$
- Effective stakes per belief: $S_{effective,i}$

## Stake Distribution Rule

**For all operations:**
Agent's effective stake in any belief market:
$$S_{effective,i} = \frac{S_{total,i}}{n_{beliefs,i}}$$

## Aggregation Weights

**For belief aggregation:**
Weights normalized based on effective stakes within each belief market:
$$w_i = \frac{S_{effective,i}}{\sum_j S_{effective,j}}$$

## Scoring Stakes

**For BTS scoring:** Information scores use normalized weights:
$$g_i = w_i \times s_i$$

**For redistribution:** Operates on effective stakes, changes applied proportionally back to total stakes

## Example
Agent A has $100 total stake participating in 4 belief markets:
- Effective stake per market: $100 / 4 = $25
- If Agent A participates in a new belief:
  - Total stake remains: $100
  - Now participates in 5 markets
  - New effective stake per market: $100 / 5 = $20

## Purpose
Enables capital-efficient participation across multiple markets while preventing wealthy agents from dominating individual propositions through diversification requirements and stake-proportional influence.