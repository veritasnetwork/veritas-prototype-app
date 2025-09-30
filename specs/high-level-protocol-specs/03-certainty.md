# Certainty & Entropy Calculation

Calculates and returns certainty metrics for belief markets in single-shot scoring.

## Inputs
- Current disagreement entropy: $D_{JS}$ (from aggregation step)
- Current aggregate: $P_{agg}$

## Outputs
- Certainty level: $C \in [0,1]$
- Entropy metrics for analysis

## Mathematics
**Certainty**: $C = 1 - D_{JS}$
- High certainty (≈1): Strong consensus among agents
- Low certainty (≈0): High disagreement among agents

## Purpose
Provides certainty metrics for:
- **UI display**: Show consensus strength to users
- **Solana layer**: Export certainty scores for content curation
- **Analysis**: Track final belief market consensus
- **Future features**: Potential certainty-based bonuses

**Note**: Pure calculation function - does not gate any downstream processing or persist state.