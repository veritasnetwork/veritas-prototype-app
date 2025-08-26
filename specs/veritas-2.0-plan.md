# Veritas Platform Evolution Specification

## Executive Summary

Veritas is evolving from a truth discovery protocol to a **decentralized content ranking and discovery platform**. While the core protocol primitive (Bayesian Truth Serum with belief aggregation) remains unchanged, the application layer is transforming to solve the internet's information discovery problem through market-driven signal aggregation.

---

## 1. Vision Evolution

### 1.1 Original Vision (What We Built)
**Focus**: Truth discovery for discrete propositions
- Single questions with truth-seeking outcomes
- Similar to prediction markets (Polymarket, Metaculus)
- One belief = one proposition
- Example: "Will inflation exceed 3% in Q1 2025?"

### 1.2 New Vision (Where We're Going)
**Focus**: Decentralized content ranking and discovery
- Content pieces with multiple signal dimensions
- Competing with algorithmic feeds (Twitter, TikTok, Google)
- One content piece = multiple belief signals
- Example: Blog post evaluated on truth, relevance, informativeness, quality, etc.

### 1.3 Why This Evolution
- **Bigger Problem Space**: Information discovery affects billions vs prediction markets serve thousands
- **Non-Competitive**: Not competing with established prediction markets
- **Value Creation**: Solving algorithmic manipulation and filter bubbles
- **Natural Fit**: BTS mechanism perfectly suited for multi-signal aggregation

---

## 2. Core Protocol (Unchanged)

### 2.1 Primitive Components
- **Belief Aggregation**: Weighted averaging using stake × trust
- **BTS Scoring**: Continuous Bayesian Truth Serum with KL divergence
- **Trust Dynamics**: Belief-specific reputation building
- **Economic Layer**: Zero-sum redistribution within beliefs
- **Mirror Descent**: Passive belief evolution

### 2.2 Key Mechanisms
```
For each belief/signal:
1. Agents submit: belief distribution + meta-prediction
2. Aggregate using epistemic weights (stake × trust)
3. Score using BTS (info gain - prediction penalty)
4. Redistribute stake based on contribution
5. Update trust based on performance
```

### 2.3 Recent Protocol Updates
- **Direct Truth Inference**: BTS now computes full information posterior immediately
- **No Entropy Gate**: Scoring happens every epoch (no need for entropy decrease check)
- **Native Continuous**: KL divergence handles continuous distributions naturally

---

## 3. Application Layer (Complete Transformation)

### 3.1 Content Structure

#### Before: Simple Propositions
```
Proposition: "Will X happen?"
    └── Single Belief Aggregation
           └── Truth Score
```

#### After: Multi-Signal Content
```
Content Piece (Article/Video/Post)
    ├── Signal 1: Truthfulness → Belief Aggregation → Score
    ├── Signal 2: Relevance → Belief Aggregation → Score
    ├── Signal 3: Informativeness → Belief Aggregation → Score
    ├── Signal 4: Quality → Belief Aggregation → Score
    └── Signal N: [Custom] → Belief Aggregation → Score
    
    Combined Ranking Score → Feed Position
```

### 3.2 Signal Types

#### Core Signals (Always Available)
1. **Truth**: Factual accuracy of claims
2. **Relevance**: Current importance/timeliness
3. **Informativeness**: Novel information density
4. **Quality**: Production value, clarity, coherence

#### Domain-Specific Signals
- **News**: Breaking, Verified, Local Impact
- **Research**: Methodology, Reproducibility, Impact
- **Entertainment**: Humor, Originality, Production
- **Educational**: Clarity, Depth, Prerequisites

#### User-Defined Signals
- Custom signals for specific communities
- Emergent signal types based on usage

### 3.3 Content Lifecycle

```
1. Content Creation
   ├── Creator publishes content
   ├── System generates signal beliefs
   └── Initial signals seeded by creator

2. Signal Evolution
   ├── Agents stake on different signals
   ├── Each signal aggregates independently
   ├── BTS scoring every epoch per signal
   └── Trust builds per signal per agent

3. Ranking Computation
   ├── Algorithm weights signals
   ├── Combined score calculated
   └── Content position determined

4. User Consumption
   ├── Users see ranked content
   ├── Engagement feeds back to signals
   └── Creator rewards distributed
```

---

## 4. User Experience Transformation

### 4.1 User Personas

#### Content Consumers
- **Passive**: Browse algorithmically curated feed
- **Active**: Adjust algorithm preferences
- **Power**: Create custom algorithms

#### Signal Contributors
- **Specialists**: Focus on specific signals (e.g., fact-checkers on truth)
- **Generalists**: Contribute across multiple signals
- **Arbitrageurs**: Identify mispriced signals

#### Content Creators
- **Publishers**: Create original content
- **Curators**: Aggregate and contextualize
- **Analysts**: Deep-dive investigations

#### Algorithm Designers
- **Create**: Design ranking algorithms
- **Optimize**: Tune for specific audiences
- **Monetize**: Earn from algorithm usage

### 4.2 Interaction Patterns

#### For Consumers (Simplified UX)
```
1. Open app → See personalized feed
2. Dislike content → Slide "relevance" down
3. System auto-adjusts all contributing signals
4. Feed immediately adapts
```

#### For Contributors (Market UX)
```
1. See content with signal markets
2. Stake on undervalued signals
3. Submit belief + meta-prediction
4. Earn/lose based on contribution
```

#### For Creators (Dashboard UX)
```
1. Publish content
2. See signal evolution in real-time
3. Understand why content ranks where
4. Earn based on value created
```

---

## 5. Revenue Model Evolution

### 5.1 Previous Model
- **Pay-per-query**: Users pay to query belief outcomes
- **Subscription**: Access to belief markets
- **Bounty**: One-time rewards for resolution

### 5.2 New Model

#### Revenue Sources
1. **User Subscriptions**: Premium feed access ($X/month)
2. **Advertising**: Promoted content with truth labels
3. **API Access**: Developers building on signal data
4. **Algorithm Marketplace**: Premium algorithm access

#### Revenue Distribution
```
User Payment ($)
    ├── Platform (Y%)
    ├── Algorithm Designers (Z%)
    ├── Signal Contributors (W%)
    └── Content Creators (V%)
```

#### Value Flow
- Users pay for better information discovery
- Value flows to all participants in proportion to contribution
- Market determines optimal distribution
- Creates sustainable ecosystem

---

## 6. Technical Architecture Changes

### 6.1 On-Chain (Minimal Changes)
```
Beliefs Table:
- belief_id (unchanged)
- signal_type (NEW: truth, relevance, etc.)
- content_hash (NEW: reference to content)
- [Rest unchanged: aggregation, scoring, trust]
```

### 6.2 Off-Chain (Major Changes)

#### Content Layer (NEW)
```
Content Service:
- Content storage (IPFS/Arweave)
- Content-signal mapping
- Metadata management
- Version control
```

#### Signal Orchestration (NEW)
```
Signal Manager:
- Generate signals for new content
- Track signal relationships
- Compute composite scores
- Handle signal lifecycle
```

#### Ranking Engine (NEW)
```
Algorithm Engine:
- Load algorithm definitions
- Weight signals per algorithm
- Compute rankings
- Cache results
```

#### Feed Service (TRANSFORMED)
```
Feed API:
- Personalized feeds
- Algorithm selection
- Real-time updates
- Engagement tracking
```

### 6.3 Database Schema Changes

#### Before
```sql
-- Simple one-to-one
propositions
    └── beliefs
           └── submissions
```

#### After
```sql
-- Complex many-to-many
content
    └── content_signals (junction table)
           └── signals (beliefs)
                  └── submissions

algorithms
    └── algorithm_weights
           └── signals

user_preferences
    └── selected_algorithms
    └── signal_adjustments
```

---

## 7. Migration Strategy

### 7.1 Frontend Changes

#### Remove/Deprecate
- Single proposition creation flow
- Binary outcome focus
- Prediction market terminology
- Trading interface metaphors

#### Add/Enhance
- Content publishing interface
- Multi-signal dashboard
- Algorithm builder/selector
- Feed customization controls
- Signal contribution interface

#### Refactor
- Belief display → Signal market display
- Outcome tracking → Ranking tracking
- Portfolio view → Contribution analytics
- Leaderboard → Multi-dimensional reputation

### 7.2 User Flow Changes

#### Old Flow
1. Browse questions
2. Select proposition
3. Submit belief
4. Wait for resolution
5. See outcome

#### New Flow
1. Browse content
2. Contribute to signals
3. See immediate ranking impact
4. Earn continuous rewards
5. Build signal-specific reputation

### 7.3 Messaging Changes

#### Terminology Evolution
- "Beliefs" → "Signals" (in UI)
- "Truth discovery" → "Quality discovery"
- "Consensus" → "Market assessment"
- "Staking" → "Contributing" or "Backing"
- "Resolution" → "Continuous evolution"

#### Value Proposition
- **Before**: "Bet on outcomes"
- **After**: "Curate the internet"

---

## 9. Success Metrics

### 9.1 Platform Health
- Daily active contributors
- Signals per content piece
- Content ranking accuracy
- User retention rate

### 9.2 Economic Health
- Total value locked (TVL)
- Revenue per user
- Creator earnings
- Contributor ROI

### 9.3 Content Quality
- Truth score correlation with fact-checks
- User satisfaction scores
- Content diversity index
- Information quality metrics

---

## 10. Risk Mitigation

### 10.1 Technical Risks
- **Scaling**: Implement efficient caching, consider L2
- **Complexity**: Progressive disclosure, sensible defaults
- **Latency**: Optimize aggregation, use approximations

### 10.2 User Adoption Risks
- **Learning Curve**: Gamification, tutorials, simple mode
- **Cold Start**: Seed with quality content, incentive program
- **Retention**: Daily rewards, reputation building

### 10.3 Economic Risks
- **Manipulation**: Trust system, stake requirements
- **Extraction**: Balanced incentives, long-term alignment
- **Sustainability**: Multiple revenue streams, efficient distribution

---

## Appendix A: Example User Journeys

### A.1 Casual Reader
```
Sarah opens app → Sees personalized feed → Reads article about climate change → 
Finds it misleading → Slides relevance down → Feed adapts → Better content appears
```

### A.2 Truth Specialist
```
Alex focuses on fact-checking → Stakes on truth signals → Builds reputation → 
Becomes trusted truth arbiter → Earns consistent returns → Influences what millions see
```

### A.3 Content Creator
```
Jordan publishes investigation → Seeds initial signals → Community validates truth → 
Relevance spikes on breaking news → Article tops feeds → Earns from value created
```

### A.4 Algorithm Designer
```
Morgan creates "High-Truth Tech News" algorithm → Weights: 40% truth, 30% tech relevance, 
30% recency → Users adopt algorithm → Morgan earns percentage of subscriptions
```

---

## Appendix B: Signal Definitions

### Truth Signal
- **Question**: "How factually accurate is this content?"
- **Range**: 0-100% accurate
- **Aggregation**: Weighted by fact-checker reputation
- **Update Frequency**: Continuous but slower

### Relevance Signal
- **Question**: "How important is this content right now?"
- **Range**: 0-100% relevant
- **Aggregation**: Weighted by domain expertise
- **Update Frequency**: Rapid, especially on breaking news

### Informativeness Signal
- **Question**: "How much new information does this provide?"
- **Range**: 0-100% novel
- **Aggregation**: Weighted by subject matter expertise
- **Update Frequency**: Moderate, decreases over time

---

## Conclusion

Veritas is evolving from a prediction protocol to the decentralized internet's content curation layer. The core protocol remains robust and unchanged, while the application layer transforms to address a massive, underserved market. This evolution positions Veritas not as another prediction market, but as the foundational infrastructure for trustworthy, market-driven information discovery.

The key to success will be maintaining the power of market mechanisms while hiding complexity from end users. By allowing markets to determine what information surfaces while making consumption as simple as scrolling a feed, Veritas can achieve the ambitious goal of "financializing relevance" to create better information diets for humanity.