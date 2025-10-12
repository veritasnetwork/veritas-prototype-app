# Sidebar Component Specification

## Purpose
Fixed left sidebar navigation for desktop (≥1024px) providing persistent access to main navigation, create post action, and wallet status. Inspired by Substack's sidebar design.

## Visual Design

### Layout (Desktop Only)
```
┌────────────────────────┐
│  [Logo] VERITAS        │
│                        │
│  🏠 Home          •    │
│  🔍 Explore      Soon  │
│  👤 Profile       •    │
│  ─────────────────     │
│  ➕ Create Post        │
│                        │
│                        │
│  [Wallet Status]       │
└────────────────────────┘
```

## Dimensions & Position
- **Width**: 256px (64 * 4 = w-64)
- **Position**: Fixed left, top: 0, h-screen
- **Padding**: 24px (p-6)
- **Background**: `#0f0f0f` (matches body)
- **Border**: Right border, 1px, `#2a2a2a` (gray-800)
- **Z-index**: Base (doesn't need elevation, fixed)

## Components

### 1. Logo Section (Top)
- **Layout**: Flex row, gap 12px, margin-bottom 32px
- **Logo Image**: 40px × 40px
- **Text**: "VERITAS"
  - Font: Bold, 24px (text-2xl), font-mono
  - Color: White
  - Tracking: Wider letter-spacing
- **Hover**: Opacity 0.8, smooth transition
- **Action**: Link to /feed

### 2. Navigation Links
- **Container**: Flex column, gap 8px, flex-1 (takes remaining space)

#### Link Structure (Active State)
```
🏠 Home                    •
├─ Background: rgba(59, 130, 246, 0.1) (blue-500/10)
├─ Text: #60a5fa (blue-400)
├─ Icon: 20px, blue-400
├─ Dot: 6px circle, blue-400, right-aligned
└─ Border-radius: 8px
```

#### Link Structure (Inactive State)
```
👤 Profile
├─ Background: Transparent
├─ Text: #9ca3af (gray-400)
├─ Icon: 20px, gray-400
├─ Hover Background: rgba(255, 255, 255, 0.05)
├─ Hover Text: White
└─ Border-radius: 8px
```

#### Individual Links:

**Home** (`/feed`)
- Icon: House/home icon
- Label: "Home"
- Active when: `pathname === '/feed'`

**Explore** (`/explore` - future)
- Icon: Search/magnifying glass
- Label: "Explore"
- Status: Disabled (gray-600, cursor not-allowed)
- Badge: "Soon" (text-xs, gray-600)

**Profile** (`/profile/[username]`)
- Icon: User/person icon
- Label: "Profile"
- Active when: `pathname.startsWith('/profile')`
- Only shown if user logged in

### 3. Divider
- **Margin**: 8px vertical
- **Style**: 1px border-top, `#2a2a2a` (gray-800)

### 4. Create Post Button
- **Width**: Full width
- **Padding**: 12px 16px (px-4 py-3)
- **Background**: `#3b82f6` (blue-500)
- **Text Color**: Black (for high contrast)
- **Font**: Semibold, 16px
- **Border-radius**: 8px
- **Icon**: Plus sign, 20px, inline left
- **Hover**:
  - Background: `#60a5fa` (blue-400, lighter)
  - Transition: All 200ms
- **Action**: Opens CreatePostModal

### 5. Wallet Status (Bottom)
- **Position**: Bottom of sidebar (mt-auto)
- **Padding-top**: 24px (pt-6)
- **Border-top**: 1px, `#2a2a2a` (gray-800)

#### State 1: Not Connected
```
┌──────────────────────┐
│  Connect Wallet      │
└──────────────────────┘
```
- **Style**: Outlined button
- **Border**: 1px, blue-400
- **Text**: Blue-400
- **Hover**: Border blue-300, text blue-300
- **Padding**: 12px 16px
- **Font**: Medium, 14px
- **Action**: Calls `linkWallet()` from Privy

#### State 2: Connected
```
┌──────────────────────┐
│ Wallet Connected     │
│ 7gZWQi...xwhkz9      │
└──────────────────────┘
```
- **Background**: `#111827` (gray-900)
- **Padding**: 12px 16px
- **Border-radius**: 8px
- **Label**: "Wallet Connected"
  - Font: 12px (text-xs)
  - Color: Gray-500
  - Margin-bottom: 4px
- **Address**:
  - Truncated: First 6 chars + "..." + Last 6 chars
  - Font: 14px, mono
  - Color: Gray-300

## Responsive Behavior

### Desktop (≥1024px)
- **Visible**: Yes (lg:flex)
- **Position**: Fixed left
- **Feed shifts**: Main content has `ml-64` (margin-left 256px)

### Tablet & Mobile (<1024px)
- **Hidden**: `hidden lg:flex` (completely hidden on small screens)
- **Replacement**: NavigationHeader (horizontal top bar)
- **Mobile nav**: Use bottom nav bar instead (Phase 4)

## Interactive States

### Navigation Links
- **Default**: Gray-400 text, transparent background
- **Hover**: White text, subtle white/5 background
- **Active**: Blue-400 text, blue-500/10 background, blue dot indicator
- **Disabled** (Explore): Gray-600, no hover, "Soon" badge

### Create Button
- **Default**: Blue-500 bg, black text
- **Hover**: Blue-400 bg, scale 1.02 (subtle)
- **Active**: Scale 0.98

### Wallet Button
- **Connect (not connected)**:
  - Default: Blue-400 border/text
  - Hover: Blue-300 border/text
- **Connected**: Static display (no interaction)

## Accessibility

- **Semantic**: `<aside>` element with `role="navigation"`
- **Keyboard Navigation**:
  - Tab through all links
  - Enter to activate
  - Focus visible (blue ring)
- **Screen Reader**:
  - "Main navigation"
  - "Create new post button"
  - Active state announced
  - Disabled links announced
- **Focus Management**: Trap focus in modal when Create clicked

## Data Requirements

```typescript
interface SidebarProps {
  onCreatePost: () => void; // Callback to open CreatePostModal
}
```

**Dependencies**:
- `useAuth()` - Get current user, username
- `usePrivy()` - Get `linkWallet` function
- `useSolanaWallet()` - Get wallet address
- `usePathname()` - Determine active route

## Implementation Notes

- **Component**: `<Sidebar onCreatePost={handleOpen} />`
- **Location**: `src/components/layout/Sidebar.tsx`
- **Used in**: Feed, Profile, PostDetailView (all main pages)
- **State**: Stateless (all state managed by parent)
- **Styling**: Tailwind utility classes

## Integration with Feed

```tsx
// In Feed.tsx
<>
  {/* Hide NavigationHeader on desktop */}
  <div className="lg:hidden">
    <NavigationHeader />
  </div>

  {/* Show Sidebar on desktop */}
  <Sidebar onCreatePost={() => setIsCreateModalOpen(true)} />

  {/* Main content shifts right on desktop */}
  <div className="min-h-screen bg-[#0f0f0f] lg:ml-64">
    <div className="max-w-feed mx-auto px-6 py-12">
      {/* Feed content */}
    </div>
  </div>
</>
```

## Edge Cases

1. **No user logged in**: Hide Profile link
2. **Very long username**: Truncate in Profile link with ellipsis
3. **Wallet connect fails**: Show error toast (handled by Privy)
4. **Sidebar too short for content**: Scrollable (shouldn't happen with current items)
5. **Logo image missing**: Show text-only "VERITAS"

## Future Enhancements

1. **Explore link activation**: Enable when /explore page built
2. **Settings link**: Add below Profile
3. **Notifications badge**: Show unread count on Profile
4. **Collapse/expand**: Allow sidebar to collapse to icon-only
5. **User avatar**: Show avatar in wallet section when connected
6. **Balance display**: Show USDC balance below wallet address

## Design Rationale

### Why Fixed Sidebar (Not Sticky)?
- Always visible during scroll
- Feels more app-like (Substack style)
- Wallet status always accessible

### Why Desktop-Only?
- Mobile has limited horizontal space
- Mobile users prefer bottom navigation (Phase 4)
- Matches modern design patterns (Twitter, LinkedIn)

### Why Blue-500 for Create Button?
- Stands out against dark background
- Matches accent color system
- Black text ensures readability (8.6:1 contrast)

### Why Bottom Wallet Status?
- Secondary importance (not navigation)
- Persistent visibility
- Doesn't clutter nav area

---

**Last Updated**: October 2025
**Status**: ✅ Implemented
**Priority**: HIGH (Phase 3 complete)
