# Belief Creation

Creates a new binary belief market where agents stake capital and express probabilistic assessments.

## Inputs
- Initial stake: $S_0 = \$5$ (fixed)
- Creator's belief: $p_0 \in [0,1]$ (probability of "yes")
- Duration: $T$ epochs

## Outputs  
- Belief identifier: $b_{id}$
- Initial aggregate: $P_0 = p_0$
- Expiration epoch: $t_{end} = t_{current} + T$

## Mathematics
Creator provides fixed $5 stake and belief $p_0$. For binary propositions:
$$p_0(\text{yes}) = p_0, \quad p_0(\text{no}) = 1 - p_0$$

Initial aggregate equals creator's belief: $P_0 = p_0$

## Purpose
Establishes a new prediction market for binary outcomes. Creator commits capital and initial belief, setting market duration. Market becomes active for agent participation until expiration.