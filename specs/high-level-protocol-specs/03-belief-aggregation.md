# Belief Aggregation

Combines individual agent beliefs into collective probability weighted by stake.

## Inputs
- Agent beliefs: $\{p_i\}$ where $p_i \in [0,1]$
- Agent stakes: $\{S_i\}$ 
- Agent meta-predictions: $\{m_i\}$ where $m_i \in [0,1]$

## Outputs
- Pre-mirror descent aggregate: $P_{pre}$
- Jensen-Shannon disagreement entropy: $D_{JS}$
- Certainty: $c = 1 - \hat{D}_{JS}$

## Mathematics
Normalize stakes: $w_i = \frac{S_i}{\sum_j S_j}$

Weighted aggregate: $P_{pre} = \sum_i w_i \cdot p_i$

Binary disagreement entropy: $D_{JS} = H(P_{pre}) - \sum_i w_i H(p_i)$
where $H(p) = -p\log_2(p) - (1-p)\log_2(1-p)$

## Leave-One-Out Function
For BTS scoring, compute aggregates excluding agent $i$:
$$w_{j,-i} = \frac{S_j}{\sum_{k \neq i} S_k}, \quad \bar{p}_{-i} = \sum_{j \neq i} w_{j,-i} \cdot p_j$$

## Purpose
Creates collective belief from individual assessments. Higher stake = higher influence. Disagreement entropy measures collective uncertainty for adaptive system behavior.