# User Dashboard Activity

Provides user-centric dashboard view showing complete belief participation history with app context integration for comprehensive user activity monitoring.

## Inputs
- Dashboard pagination parameters
- Optional user filtering criteria

## Outputs
- User profiles with display information
- Complete belief participation history per user
- Post context integration for opinion-based beliefs
- Stake allocation breakdown and portfolio view

## App Integration Logic

**User Context Enrichment:**
- Maps protocol agents to app user profiles
- Includes user display names, avatars, profile data
- Provides user-friendly identifiers and formatting

**Post Context Integration:**
For each belief participation:
- Checks if belief is associated with opinion post
- If yes: includes post title, content preview, creation context
- If no: displays as standalone protocol belief with description

**Portfolio View:**
- Aggregates all user belief participations
- Shows stake distribution across different beliefs
- Categorizes participations by post type (opinion vs protocol)
- Provides timeline of user activity

## Data Presentation Structure

**User Summary Card:**
- Profile information (username, display name, avatar)
- Portfolio metrics (total stake, active beliefs, participation rate)
- Recent activity summary

**Belief Participation List:**
- Mixed view of opinion posts and protocol beliefs
- For opinion posts: Post title, belief market, user's position
- For protocol beliefs: Belief description, market status, position
- Stake allocation and performance metrics per participation

**Activity Timeline:**
- Chronological view of user submissions and updates
- Entry/exit points from belief markets
- Stake reallocation events

## Dashboard Features
- User comparison and ranking capabilities
- Portfolio diversity analysis
- Belief market participation trends
- Performance tracking across different belief types

## Purpose
Creates comprehensive user-centric dashboard for tracking individual agent performance, portfolio management, and participation analytics across both opinion posts and standalone protocol beliefs.