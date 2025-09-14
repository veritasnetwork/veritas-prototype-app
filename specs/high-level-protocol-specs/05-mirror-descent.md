# Mirror Descent

Updates passive agent beliefs toward collective aggregate, scaled by network certainty.

## Inputs
- Agent beliefs: $\{p_i^{(t)}\}$ where $p_i \in [0,1]$
- Pre-mirror descent aggregate: $P_{pre}$ 
- Certainty: $c$
- Active agent indicators

## Outputs
- Updated beliefs: $\{p_i^{(t+1)}\}$
- Post-mirror descent aggregate: $P_{post}$
- Post-mirror descent disagreement entropy: $D_{JS,post}$

## Mathematics
Learning rate: $\eta = c$

For passive agents, multiplicative update:
$$p_i^{(t+1)} = \frac{p_i^{(t)}^{1-\eta} \cdot P_{pre}^{\eta}}{p_i^{(t)}^{1-\eta} \cdot P_{pre}^{\eta} + (1-p_i^{(t)})^{1-\eta} \cdot (1-P_{pre})^{\eta}}$$

Active agents retain submitted beliefs unchanged.

Recompute aggregate: $P_{post} = \sum_i w_i \cdot p_i^{(t+1)}$

## Purpose
Enables passive agents to benefit from revealed information without active participation. High certainty = faster convergence. Low certainty = preserved diversity.