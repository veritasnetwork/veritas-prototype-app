# Architecture Overview

## Layer Separation

### Protocol Layer
**Purpose:** Pure belief market mechanics - creating beliefs, staking, aggregation, scoring, and redistribution.

**Characteristics:**
- Protocol-agnostic to content type or presentation
- Only knows about:
  - Belief IDs (not what they represent)
  - Agent IDs (not who they are)
  - Stakes and probabilities
  - Epochs and timing
- Could be replaced by a blockchain without affecting app layer
- Stateless edge functions that process belief mechanics

### App Layer  
**Purpose:** User-facing application that maps real-world content to belief markets.

**Characteristics:**
- Manages all content (posts, media, text)
- Handles user profiles and authentication
- Creates UI/UX around belief markets
- Maps posts → beliefs and users → agents
- Stores all media and content-specific data

## Data Structure Implications

### Protocol Tables (Minimal, Generic)
```
beliefs
agents  
belief_submissions
epoch_states
redistributions
```

### App Tables (Rich, Content-Aware)
```
posts (with belief_id reference)
users (with agent_id reference)
media_attachments
comments
user_profiles
```

### Edge Function Design
- Protocol functions only receive/return IDs and numbers
- App functions handle the mapping layer
- Clear API boundary between layers

## Migration Path
When moving protocol to blockchain:
1. Protocol tables → Smart contract state
2. Edge functions → Smart contract methods
3. App layer remains unchanged, just points to new protocol endpoint