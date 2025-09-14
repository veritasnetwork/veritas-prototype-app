# Belief Creation

Creates a new binary belief market where agents express probabilistic assessments using their existing stake allocation.

## Inputs
- Creator's belief: $p_0 \in [0,1]$ (probability of "yes")
- Duration: $T$ epochs

## Outputs  
- Belief identifier: $b_{id}$
- Initial aggregate: $P_0 = p_0$
- Expiration epoch: $t_{end} = t_{current} + T$

## Mathematics
Creator allocates portion of existing stake to express belief $p_0$. For binary propositions:
$$p_0(\text{yes}) = p_0, \quad p_0(\text{no}) = 1 - p_0$$

Initial aggregate equals creator's belief: $P_0 = p_0$

Stake allocation validated: effective stake ≥ minimum threshold per belief.

## Purpose
Establishes a new prediction market for binary outcomes. Creator allocates existing stake and provides initial belief, setting market duration. Market becomes active for agent participation until expiration.