# Epoch Management

Coordinates temporal cycle of belief evolution and manages state transitions between epochs.

## Inputs
- Current epoch number: $t$
- All active beliefs and their states  
- New agent submissions for current epoch
- Agent withdrawal requests

## Outputs
- Next epoch number: $t+1$
- Updated belief states
- Epoch transition events
- Historical state snapshot

## Epoch Sequence
1. **Epoch Close** - Stop accepting submissions for epoch $t$
2. **Belief Expiration Check** - Remove expired beliefs
3. **Process Updates** - Add/update/remove agent submissions
4. **Execute Protocol Chain** - Aggregation → Mirror Descent → Learning Assessment → BTS Scoring → Stake Redistribution
5. **Submission Cleanup** - Flush submissions from beliefs that learned
6. **State Persistence** - Store updated states
7. **Epoch Open** - Begin accepting submissions for epoch $t+1$

## Belief Termination vs Submission Cleanup
**Belief Termination (only):**
- **Time-based**: current_epoch ≥ expiration_epoch  
- **Single-agent**: Cannot be scored, auto-expire

**Submission Cleanup (belief remains active):**
- **Learning-based**: η_econ > 0 (disagreement entropy decreased)
- Submissions flushed, agents paid out, belief continues accepting new submissions

## Purpose
Ensures deterministic state transitions while handling belief lifecycle management. Variable epoch duration allows different topics to evolve at appropriate speeds.