# Epistemic Weights & Stake Scaling Implementation

**Endpoint:** `/protocol/weights/calculate`

## Interface
**Input:**
- `belief_id`: string
- `participant_agents`: array[string] (agent IDs)

**Output:**
- `weights`: object {agent_id: normalized_weight}
- `effective_stakes`: object {agent_id: effective_stake}

## Algorithm
```python
def calculate_epistemic_weights(belief_id, participant_agents):
    effective_stakes = {}
    
    for agent_id in participant_agents:
        agent = db.agents.get(agent_id)
        effective_stake = agent.total_stake / agent.active_belief_count
        effective_stakes[agent_id] = effective_stake
    
    # Normalize to get weights
    total = sum(effective_stakes.values())
    if total > 0:
        weights = {k: v/total for k, v in effective_stakes.items()}
    else:
        # Equal weights if no stakes
        n = len(effective_stakes)
        weights = {k: 1.0/n for k in effective_stakes.keys()}
    
    return {
        "weights": weights,
        "effective_stakes": effective_stakes
    }
```

## Belief Creation Stake Deduction
**Endpoint:** `/protocol/stakes/create-belief`

**Input:**
- `agent_id`: string
- `belief_creation_cost`: number (default: 5)

**Output:**
- `updated_total_stake`: number
- `success`: boolean

```python
def deduct_creation_stake(agent_id, belief_creation_cost=5):
    agent = db.agents.get(agent_id)
    if agent.total_stake < belief_creation_cost:
        return {"success": False, "error": "Insufficient stake"}
    
    # Deduct stake and increment belief count
    agent.total_stake -= belief_creation_cost
    agent.active_belief_count += 1
    db.agents.update(agent)
    
    return {
        "success": True,
        "updated_total_stake": agent.total_stake
    }
```

**Usage:** Called once per belief per epoch for weights, called during belief creation for stake deduction.