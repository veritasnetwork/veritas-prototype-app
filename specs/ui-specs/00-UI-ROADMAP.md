# UI Implementation Roadmap

## Overview
This document tracks the implementation status of all UI components, pages, and flows in the Veritas application.

## Directory Structure
```
specs/ui-specs/
├── 00-UI-ROADMAP.md          # This file
├── design-system.md           # Global styles, colors, typography
├── components/                # Reusable UI components
│   ├── NavigationHeader.md
│   ├── PostCard.md
│   ├── CreatePostModal.md
│   ├── PostHeader.md         # (part of PostCard)
│   └── BeliefSubmission.md   # (part of PostCard)
├── pages/                     # Full page layouts
│   ├── LandingPage.md
│   ├── FeedView.md
│   ├── ProfilePage.md
│   └── PostDetailView.md     # TODO
└── flows/                     # Multi-step user journeys
    └── BuyTokensFlow.md       # TODO
```

---

## ✅ Completed Components

### Components
- [x] **NavigationHeader** (`specs/ui-specs/components/NavigationHeader.md`)
  - Location: `src/components/layout/NavigationHeader.tsx`
  - Status: ✅ Built & functional
  - Notes: Logo, nav links, wallet connection

- [x] **PostCard** (`specs/ui-specs/components/PostCard.md`)
  - Location: `src/components/feed/PostCard/PostCard.tsx`
  - Status: ✅ Built & functional
  - Includes: PostHeader, buy tokens interface, pool price display
  - Recently removed: BeliefIndicator (deprecated)

- [x] **CreatePostModal** (`specs/ui-specs/components/CreatePostModal.md`)
  - Location: `src/components/post/CreatePostModal.tsx`
  - Status: ✅ Built & functional
  - Notes: Modal for creating posts with beliefs

### Pages
- [x] **LandingPage** (`specs/ui-specs/pages/LandingPage.md`)
  - Location: `src/components/auth/LandingPage.tsx`
  - Route: `/`
  - Status: ✅ Built & functional
  - Notes: Simple auth entry point

- [x] **FeedView** (`specs/ui-specs/pages/FeedView.md`)
  - Location: `src/components/feed/Feed.tsx`
  - Route: `/feed`
  - Status: ✅ Built & functional
  - Notes: Main feed of posts

- [x] **ExplorePage** (`specs/ui-specs/pages/ExplorePage.md`)
  - Location: `src/components/explore/Explore.tsx`
  - Route: `/explore`
  - Status: ✅ Built & functional
  - Notes: Grid view for visual content discovery
  - Uses: CompactPostCard component

### Components (Additional)
- [x] **CompactPostCard** (`specs/ui-specs/components/CompactPostCard.md`)
  - Location: `src/components/feed/PostCard/CompactPostCard.tsx`
  - Status: ✅ Built & functional
  - Notes: Grid-optimized card for Explore page

---

## 🚧 In Progress

None currently.

---

## 📋 Planned Components

### Pages
- [ ] **ProfilePage** (`specs/ui-specs/pages/ProfilePage.md`)
  - Route: `/profile/[username]`
  - Status: ⚠️ Spec exists, not built
  - Priority: **HIGH** (next to build)
  - Features needed:
    - User avatar and display name
    - Wallet address display
    - Stake and post count stats
    - Recent activity feed
  - Dependencies: None (spec complete)

- [ ] **PostDetailView** (`specs/ui-specs/pages/PostDetailView.md`)
  - Route: `/post/[id]`
  - Status: ✅ **Spec complete**, not built
  - Priority: **HIGH** (next to build)
  - Features needed:
    - Full post display with complete content
    - Three tabs: Overview | Trading | Analytics
    - Buy/sell interface with bonding curve pricing
    - Historical delta relevance chart
    - Historical token price chart
    - Pool metrics and user holdings
  - Dependencies:
    - **Database**: Need to create `belief_history` and `pool_history` tables
    - **API**: Need `/api/posts/[id]` and `/api/posts/[id]/history` endpoints
    - **Epoch Processing**: History tables populated by epoch processing function

### Flows
- [ ] **BuyTokensFlow**
  - Status: ❌ No spec yet
  - Priority: **MEDIUM**
  - Current: Buy interface exists in PostCard
  - Enhancement: Multi-step flow with confirmation, wallet approval, success state

---

## 🗑️ Deprecated / Removed

- [x] ~~**Navbar**~~ - Replaced by NavigationHeader (deleted Oct 2025)
- [x] ~~**BeliefIndicator**~~ - Removed from PostCard (deleted Oct 2025)
- [x] ~~**InviteCodeRedemption**~~ - Invite codes deprecated (exists but unused)

---

## 🔧 Utility Components (No Specs Needed)

These are imported UI library components (shadcn/ui):
- `ui/badge.tsx`
- `ui/button.tsx`
- `ui/card.tsx`
- `ui/progress.tsx`
- `ui/tabs.tsx`

These are auth/routing utilities:
- `auth/PrivyErrorBoundary.tsx`
- `auth/ProtectedRoute.tsx`

---

## Next Actions

### Immediate (This Week)
1. ✅ **Reorganize specs** into components/pages/flows structure
2. ✅ **Create PostDetailView spec**
3. 🎯 **Implement database history tables** for PostDetailView
4. 🎯 **Build PostDetailView** following new spec

### Short Term (Next 2 Weeks)
5. **Build ProfilePage** following existing spec
6. **Polish existing components** (animations, micro-interactions)
7. **Create BuyTokensFlow spec** for better UX (may be redundant with Trading tab)

### Medium Term (Next Month)
7. **User settings page** (edit profile, preferences)
8. **Notifications UI** (toast notifications, activity feed)
9. **Search functionality** (find posts, users)

---

## Implementation Guidelines

### When Building New Components

1. **Check this roadmap** - Is there already a spec?
2. **Read the spec thoroughly** - Understand requirements
3. **Start functional first** - Layout and data, style later
4. **Use design-system.md** - Consistent colors, typography
5. **Update this roadmap** - Mark as in progress, then complete

### How to Prompt Claude Code

**Good prompts:**
- ✅ "Build the ProfilePage component following `specs/ui-specs/pages/ProfilePage.md`. Start with data fetching and basic layout."
- ✅ "Implement the Stats Grid section from ProfilePage spec (lines 83-98). Use the design system colors."
- ✅ "Add loading states to ProfilePage per the spec requirements."

**Bad prompts:**
- ❌ "Build a profile page"
- ❌ "Make it look nice"
- ❌ "Add some animations"

---

## Maintenance

- **Update this file** when:
  - New specs are created
  - Components are built
  - Components are deprecated/removed
  - Priorities change

- **Review quarterly** to ensure accuracy

---

Last updated: October 2025
