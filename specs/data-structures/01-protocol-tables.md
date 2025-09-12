# Protocol Data Structures

Core protocol tables that handle belief market mechanics only.

## beliefs
Tracks active belief markets.

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique belief market ID |
| creator_agent_id | agent reference | Agent who created this belief |
| created_at | timestamp | When belief was created |
| created_epoch | integer | Epoch number at creation |
| expiration_epoch | integer | When belief market expires |
| previous_aggregate | decimal (0-1) | Post-mirror descent aggregate from last epoch |
| previous_disagreement_entropy | decimal | Post-mirror descent disagreement entropy from last epoch |
| participant_count | integer | Number of agents with submissions |

## agents
Generic agents in the protocol (not users).

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique agent ID |
| total_stake | decimal | Total stake across all markets (default $100) |
| active_belief_count | integer | Number of beliefs currently participating in |
| created_at | timestamp | When agent was created |

## belief_submissions
Active submissions awaiting scoring.

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique submission ID |
| belief_id | belief reference | Which belief market this is for |
| agent_id | agent reference | Agent making the submission |
| epoch | integer | Epoch when this belief was submitted |
| belief_value | decimal (0-1) | Agent's probability assessment (p) |
| meta_prediction | decimal (0-1) | Agent's prediction of average belief (m) |

**Constraints:**
- One submission per agent per belief
- Effective stake calculated at scoring time using stake scaling rules


