# Veritas Web Application Development

## Project Status
✅ **Core Protocol COMPLETE** - Mirror descent, BTS scoring, stake redistribution all working correctly

## Web Application Roadmap

### Phase 1: Authentication & User Foundation ✅
- **Privy Auth**: Email, Apple, and wallet authentication
- **User Onboarding**: Auto-registration on first login with $0 stake (users deposit via Veritas Custodian Solana contract)
- **Invite System**: Optional invite codes for exclusive access (works alongside auto-registration)
- **Stake History Tracking**: New table to track user stake over epochs (app layer)

### Phase 2: Posts Core Features ✅
- **Post Creation**: Any authenticated user can create posts with beliefs (48h default duration)
- **Belief Submission Interface**: Dual sliders (0-100 scale)
  - Belief slider: User's probability estimate
  - Meta-prediction slider: What they think others will believe
- **Feed Display**: Show posts with:
  - Current aggregate belief percentage
  - Total effective stake
  - Countdown to next epoch processing
  - Aggregate history chart (epochs over time)

### Phase 3: User Profiles & History
- **Profile Page**:
  - Current stake balance display
  - Stake history chart (epochs over time)
  - No BTS scores or submission history for now
- **Belief History**: New table to store aggregate history per belief over epochs

### Phase 4: Post Expansion & Detailed Views
- **Expandable Posts**:
  - Certainty metric
  - Belief expiry timer
  - Interactive aggregate history chart
- **Chart Implementation**: Interactive charts for time-series data

### Phase 5: Tag System
- **Tag Categories**: Pre-defined categories with paid tag creation
  - Fee amount stored in config table
  - Dedicated UI for tag creation/management
- **Post-Tag Belief Markets**: Each post-tag combination becomes its own protocol belief market (relevance scoring 0-100)
  - Posts are tagged by creators with arbitrary tags
  - Belief markets are created for each post-tag pair, not for tags themselves
  - Users bet on how relevant a specific tag is to a specific post

### Phase 6: Voice-to-AI Feed Algorithm
- **Voice Input**: Voice-to-text feature for expressing interests
- **LLM Processing**: Convert voice input to tag preferences (proportional weights out of 100%)
- **Algorithmic Ranking**: Score posts based on:
  - User's tag preference weights
  - Post-tag belief markets (crowd-sourced relevance scores per post-tag pair)
  - Creator-assigned tags on posts

## Technical Architecture Decisions Needed

### Database Schema Extensions
1. **User Stake History**: `user_stake_history` table
2. **Belief Aggregate History**: `belief_aggregate_history` table
3. **Posts Table**: All posts have `belief_id` (required)
4. **Tag System**: `tags`, `post_tags`, `user_tag_preferences` tables
5. **Post-Tag Belief Markets**: Link post-tag pairs to belief markets for relevance scoring

### Implementation Priority Discussion
Based on user impact and technical complexity, I recommend:

**Priority 1 (Completed)**: Phase 1 (Auth) ✅ → Phase 2 (Posts with Beliefs) ✅
**Priority 2 (Next)**: Phase 3 (Profiles) → Phase 4 (Expansion)
**Priority 3 (Future)**: Phase 5 (Tags) → Phase 6 (AI Algorithm)

## Development Approach
- Build incrementally with working features at each phase
- Test each phase thoroughly before moving to next
- Focus on core user experience first (posts with beliefs + basic profiles)
- Save complex features (AI algorithm) for last when foundation is solid

---

*Updated from protocol development to web application development focus*