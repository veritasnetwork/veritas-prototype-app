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
2. **Belief Expiration Check** - Delete expired beliefs and their submissions
3. **Process Updates** - Add/update/remove agent submissions
4. **Execute Protocol Chain** - Aggregation → Mirror Descent → Learning Assessment → BTS Scoring → Stake Redistribution
5. **Submission Status Update** - Set all submissions to passive (is_active = false)
6. **State Persistence** - Store updated belief states
7. **Epoch Open** - Begin accepting submissions for epoch $t+1$

## Belief Termination vs Submission Status Updates
**Belief Termination (delete belief and submissions):**
- **Time-based**: current_epoch ≥ expiration_epoch
- **Single-agent**: Cannot be scored, auto-expire
- Belief record and all submissions are deleted

**Submission Status Updates (belief remains active):**
- **After every epoch processing**: ALL submissions become passive (is_active = false)
- Submissions remain in database for historical record
- Agents must resubmit in next epoch to participate in scoring
- Belief continues accepting new submissions until expiration_epoch

## Purpose
Ensures deterministic state transitions while handling belief lifecycle management. Variable epoch duration allows different topics to evolve at appropriate speeds.