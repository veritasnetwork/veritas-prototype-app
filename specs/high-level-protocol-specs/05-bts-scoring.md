# BTS Scoring

Calculates Bayesian Truth Serum scores to identify signal vs noise contributors.

## Inputs
- Updated agent beliefs: $\{p_i^{(t+1)}\}$ (post-mirror descent)
- Agent meta-predictions: $\{m_i\}$ 
- Agent stakes: $\{S_i\}$
- Leave-one-out aggregates: $\{\bar{p}_{-i}, \bar{m}_{-i}\}$

## Outputs
- BTS signal quality scores: $\{s_i\}$
- Information scores: $\{g_i\}$
- Winner/loser sets: $W$, $L$

## Mathematics
Binary KL divergence: $D_{KL}^{binary}(p \| q) = p \log\frac{p}{q} + (1-p) \log\frac{1-p}{1-q}$

BTS score:
$$s_i = \underbrace{D_{KL}(p_i \| \bar{m}_{-i}) - D_{KL}(p_i \| \bar{p}_{-i})}_{\text{information gain}} - \underbrace{D_{KL}(\bar{p}_{-i} \| m_i)}_{\text{prediction accuracy}}$$

Information score: $g_i = S_i \times s_i$

Partition: $W = \{i : g_i > 0\}$, $L = \{i : g_i < 0\}$

## Purpose
Rewards "surprisingly popular" positions where agents' beliefs differ from average in unpredicted ways, indicating genuine private information. Prevents strategic herding.