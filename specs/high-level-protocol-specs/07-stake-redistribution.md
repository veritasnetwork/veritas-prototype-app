# Stake Redistribution

Performs zero-sum economic transfers from noise contributors to signal providers when learning occurs.

## Inputs
- Learning occurred: boolean
- Economic learning rate: $\eta_{econ}$
- Information scores: $\{g_i\}$
- Winner/loser sets: $W$, $L$
- Agent stakes: $\{S_i\}$

## Outputs  
- Updated stakes: $\{S_i'\}$
- Individual rewards: $\{\Delta R_i\}$ 
- Individual slashes: $\{\Delta S_j\}$

## Mathematics
If no learning: all stakes unchanged.

When learning occurred:

Slashing pool: $Pool_{slash} = \eta_{econ} \times \sum_{j \in L} S_j$

Individual slashes: $\Delta S_j = \frac{|g_j|}{\sum_{k \in L} |g_k|} \times Pool_{slash}$

Individual rewards: $\Delta R_i = \frac{g_i}{\sum_{k \in W} g_k} \times Pool_{slash}$

Conservation: $\sum_j \Delta S_j = \sum_i \Delta R_i$

## Submission Cleanup
After stake redistribution completes, if learning occurred:
- Delete all submissions for this belief from active pool
- Decrement active_belief_count for all participating agents
- Belief market remains active until expiration epoch

## Belief Lifecycle
Beliefs remain active until expiration epoch, regardless of learning events. Learning triggers submission cleanup but not belief termination.

## Purpose
Creates economic incentives for truth-telling. Rewards genuine epistemic contribution, penalizes noise. Zero-sum ensures no money creation/destruction.