# Mobile Navigation Component Specification

## Purpose
Fixed bottom navigation bar for mobile devices (<1024px) providing quick access to main app sections. Inspired by Substack mobile and modern app navigation patterns (Twitter, Instagram).

## Visual Design

### Layout (Mobile Only)
```
┌──────────────────────────────────────┐
│  Content Area                        │
│  (scrollable)                        │
│                                      │
├──────────────────────────────────────┤
│  [🏠]    [🔍]    [⊕]    [👤]        │  ← Fixed bottom
│  Home  Explore  Create Profile       │
└──────────────────────────────────────┘
```

## Dimensions & Position
- **Height**: 64px (h-16)
- **Position**: Fixed bottom, full-width
- **Background**: `#1a1a1a` with 95% opacity + backdrop-blur
- **Border**: Top border, 1px, `#2a2a2a` (gray-800)
- **Z-index**: 1100 (above content, below modals)
- **Padding**: 8px horizontal (px-2)

## Navigation Items

### 1. Home
- **Icon**: House/home (24px)
- **Label**: "Home" (text-xs, 11px)
- **Route**: `/feed`
- **Active State**:
  - Icon: Filled (solid) blue-400
  - Text: Blue-400
  - Active when: `pathname === '/feed'`
- **Inactive State**:
  - Icon: Outlined (stroke) gray-400
  - Text: Gray-400

### 2. Explore (Disabled)
- **Icon**: Search/magnifying glass (24px)
- **Label**: "Explore" (text-xs)
- **Route**: `/explore` (future)
- **State**: Disabled
  - Color: Gray-600
  - Cursor: not-allowed
  - No hover effect
- **Note**: Placeholder for future feature

### 3. Create Post (Center, Elevated)
- **Icon**: Plus sign (24px, stroke-width: 3)
- **Label**: None (icon only)
- **Style**: Elevated circle button
  - Background: Blue-500 circle (48px diameter)
  - Icon color: Black (for contrast)
  - Position: Absolutely centered vertically
  - Transform: translateY(-50%) to center
- **Hover**: Scale 1.05 (desktop only, mobile uses tap)
- **Action**: Opens CreatePostModal

### 4. Profile
- **Icon**: User/person (24px)
- **Label**: "Profile" (text-xs)
- **Route**: `/profile/{username}`
- **Active State**:
  - Icon: Filled (solid) blue-400
  - Text: Blue-400
  - Active when: `pathname.startsWith('/profile')`
- **Inactive State**:
  - Icon: Outlined (stroke) gray-400
  - Text: Gray-400
- **If Not Logged In**:
  - Label: "Login"
  - Routes to: `/feed` (for now)
  - Action: Triggers auth flow

## Item Layout
- **Width**: Each item takes equal space (flex: 1)
- **Height**: Full 64px (clickable area)
- **Layout**: Flex column, centered
  - Icon: Top (24px × 24px)
  - Label: Below icon, 4px gap (mt-1)
- **Alignment**: Center horizontally and vertically
- **Gap**: Icons distributed evenly with `justify-around`

## Interactive States

### Default (Inactive)
- Icon: Gray-400 outline
- Text: Gray-400, text-xs
- Background: Transparent

### Active
- Icon: Blue-400 filled
- Text: Blue-400, text-xs
- Background: Transparent (no background highlight)

### Tap/Press (Mobile)
- Brief scale down (0.95)
- Quick opacity pulse
- Haptic feedback (if supported)

### Disabled (Explore)
- Icon: Gray-600
- Text: Gray-600
- No interaction
- Cursor: not-allowed

### Create Button Special State
- Default: Blue-500 circle, black icon
- Press: Scale 0.95, opacity 0.9
- Stands out as primary action

## Responsive Behavior

### Mobile (<1024px)
- **Visible**: Yes (shown by default)
- **Content Padding**: Add `pb-20` (80px) to body/content to prevent overlap

### Desktop (≥1024px)
- **Hidden**: `lg:hidden` (completely hidden)
- **Replacement**: Sidebar navigation used instead

## Accessibility

- **Semantic**: `<nav>` element with `role="navigation"`
- **ARIA**: Each link has descriptive label
  - "Navigate to Home"
  - "Navigate to Profile"
  - "Create new post"
- **Touch Targets**: Full 64px height meets minimum 44px
- **Keyboard**: Tab through items (though primarily for touch)
- **Focus**: Visible focus rings on each item
- **Screen Reader**: Announces active state
  - "Home, selected"
  - "Profile, link"

## Content Spacing

To prevent bottom nav from covering content:
```tsx
<div className="min-h-screen pb-20 lg:pb-0">
  {/* Content here */}
</div>
```
- Mobile: 80px padding-bottom (pb-20)
- Desktop: No padding (lg:pb-0)

## z-index Hierarchy
```
Modal/Toast:    1400 (highest)
Popover:        1300
Modal Overlay:  1200
MobileNav:      1100 ← This component
Sidebar:        0 (fixed, doesn't need elevation)
Content:        0
```

## Data Requirements

```typescript
interface MobileNavProps {
  onCreatePost: () => void; // Callback to open CreatePostModal
}
```

**Dependencies**:
- `useAuth()` - Get current user
- `usePathname()` - Determine active route

## Implementation Notes

- **Component**: `<MobileNav onCreatePost={handleOpen} />`
- **Location**: `src/components/layout/MobileNav.tsx`
- **Used in**: All main pages (Feed, Profile, PostDetailView)
- **State**: Stateless (all state managed by parent)
- **Styling**: Tailwind utility classes

## Integration with Feed

```tsx
// In Feed.tsx
<>
  {/* Mobile header (simplified) */}
  <div className="lg:hidden">
    <NavigationHeader />
  </div>

  {/* Desktop Sidebar */}
  <Sidebar onCreatePost={() => setIsCreateModalOpen(true)} />

  {/* Main content with bottom padding for mobile nav */}
  <div className="min-h-screen pb-20 lg:pb-0 lg:ml-64">
    {/* Feed content */}
  </div>

  {/* Mobile bottom nav */}
  <MobileNav onCreatePost={() => setIsCreateModalOpen(true)} />
</>
```

## Design Comparison: Desktop vs Mobile

| Feature | Desktop (Sidebar) | Mobile (Bottom Nav) |
|---------|------------------|---------------------|
| Position | Fixed left | Fixed bottom |
| Size | 256px wide | 64px tall |
| Items | 5+ (scalable) | 4 (optimal for mobile) |
| Create | Button in list | Center, elevated circle |
| Wallet | Bottom status card | In top header |
| Active | Blue bg + dot | Blue icon only |

## Edge Cases

1. **User not logged in**: Show "Login" instead of "Profile"
2. **Very small screens (<375px)**: Icons still fit (24px + 8px padding)
3. **Landscape mode**: Still fixed bottom, may reduce viewport height
4. **iOS safe area**: May need `pb-safe` for devices with notches
5. **Create modal open**: Nav stays visible (doesn't hide)
6. **Keyboard open**: Nav may be pushed up by virtual keyboard

## Future Enhancements

1. **Enable Explore**: Activate when /explore page built
2. **Notification badges**: Red dot on Profile when new activity
3. **Haptic feedback**: Vibrate on tap (iOS/Android)
4. **Swipe gestures**: Swipe up on nav to expand quick actions
5. **Long-press menus**: Hold icon for contextual actions
6. **Smooth transitions**: Animate icon fill on route change

## Design Rationale

### Why Bottom Navigation?
- **Thumb-friendly**: Easy to reach on large phones
- **Standard pattern**: Users expect it (Instagram, Twitter, TikTok)
- **Persistent access**: Always visible while scrolling

### Why 4 Items (Not 5)?
- **Optimal ergonomics**: 4 items = balanced spacing
- **Clear hierarchy**: Create button stands out in center
- **Less cluttered**: Mobile space is limited

### Why Center-Elevated Create Button?
- **Primary action**: Most important mobile action
- **Visual hierarchy**: Clearly stands out
- **Familiar pattern**: Common in social apps (TikTok, Instagram)

### Why Gray-400 Instead of White?
- **Reduces visual noise**: Not competing with content
- **Clear active state**: Blue stands out more from gray
- **Better hierarchy**: Content is primary, nav is secondary

---

**Last Updated**: October 2025
**Status**: ✅ Implemented
**Priority**: HIGH (Phase 4 complete)
