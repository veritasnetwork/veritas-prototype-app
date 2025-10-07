# Landing Page Specification

## Purpose
Entry point for unauthenticated users. Displays brand identity and wallet connection.

## Route
- **Path**: `/`
- **Auth Required**: No
- **Redirect**: If authenticated → `/feed`

## Visual Design

### Layout
```
┌─────────────────────────────────────────────────────┐
│  [Logo] VERITAS                                     │
│                                                     │
│                                                     │
│                                                     │
│           DISCOVER WHAT HUMANITY                    │
│              TRULY BELIEVES.                        │
│                                                     │
│            [CONNECT WALLET]                         │
│                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Components

### Logo Header (Top Left)
- **Position**: Absolute, top-left (32px from edges)
- **Layout**: Horizontal flex, gap 12px
- **Logo Image**:
  - Source: `/icons/logo.png`
  - Size: 32x32px
  - Alt: "Veritas Logo"
- **Brand Text**: "VERITAS"
  - Font: Mono, Bold, 20px
  - Color: `#F0EAD6` (eggshell)
  - Letter-spacing: 0.1em

### Hero Section (Centered)
- **Container**:
  - Position: Centered (flex items-center justify-center)
  - Text-align: center
- **Tagline**:
  - Text: "DISCOVER WHAT HUMANITY TRULY BELIEVES."
  - Font: Mono, Medium, 24px
  - Color: `#F0EAD6` (eggshell)
  - Letter-spacing: 0.05em
  - Margin-bottom: 48px
- **CTA Button**: "CONNECT WALLET"
  - Background: `#B9D9EB` (powder blue)
  - Text Color: `#0C1D51` (oxford blue)
  - Font: Mono, Medium, 14px
  - Padding: 16px 32px
  - Border-radius: 4px
  - Border: 1px solid `#0C1D51`
  - Hover State:
    - Background: `#0C1D51`
    - Text Color: `#B9D9EB`
    - Border: 1px solid `#B9D9EB`
  - Disabled State:
    - Opacity: 50%
    - Cursor: not-allowed
  - Transition: All 300ms ease-in-out

### Background
- **Color**: `#000000` (pure black)
- **Height**: 100vh (full screen)
- **Overflow**: hidden

## States

### Loading (Initial)
- Show spinner centered:
  - Size: 32px
  - Border: 2px
  - Color: `#B9D9EB`
  - Animation: Spin

### Ready (Unauthenticated)
- Display logo, tagline, and CTA button
- Button enabled
- Clicking button opens Privy auth modal

### Authenticating
- Keep page visible
- Privy modal overlays on top
- Button disabled during auth flow

### Authenticated & Has Access
- Show loading spinner
- Redirect to `/feed` automatically

### Authenticated & No Access
- Show loading spinner briefly
- Logout user automatically
- Retry login after 1 second

## Interactions

### Connect Wallet Button Click
1. Check if Privy is ready
2. If already authenticated without access:
   - Logout user
   - Wait 1 second
   - Open login modal
3. If not authenticated:
   - Open Privy login modal
4. On successful auth:
   - Redirect to `/feed`

### Auto-Redirect
- If user is already authenticated and has access
- Redirect happens on page load
- No flash of landing page content

## Data Requirements

```typescript
interface LandingPageState {
  ready: boolean;              // Privy SDK ready
  authenticated: boolean;      // User authenticated via Privy
  hasAccess: boolean;          // User has Solana wallet & DB record
  isLoading: boolean;          // Auth status loading
}
```

### Hooks Used
- `usePrivy()` - Privy auth state and methods
- `useAuth()` - App auth state (hasAccess, isLoading)
- `useRouter()` - Next.js navigation

## Responsive Behavior

### Desktop (>768px)
- Tagline: 24px
- Logo header: 32px from edges
- Button: 16px padding vertical

### Mobile (<768px)
- Tagline: 18px, line-height 1.4
- Logo header: 16px from edges
- Button: 12px padding vertical
- Horizontal padding: 16px

## Accessibility

- **Semantic**: `<main>` wrapper
- **Heading**: h1 for tagline (visually styled but semantic)
- **Button**:
  - Proper `<button>` element
  - Disabled state properly indicated
  - Focus visible
- **Alt Text**: Logo image has descriptive alt
- **Keyboard**: Button keyboard accessible

## Performance

- **No Heavy Assets**: Single small logo image
- **Instant Load**: Minimal JavaScript
- **No Data Fetching**: Only auth state checks

## Implementation Notes

- **Component**: `<LandingPage />`
- **Location**: `src/components/auth/LandingPage.tsx`
- **Page**: `app/page.tsx`
- **No Server-Side Logic**: Fully client-side
- **Auto-redirect**: useEffect watches auth state

## Edge Cases

- **Privy Not Ready**: Show loading, disable button
- **Auth Error**: Log to console, allow retry
- **Slow Auth Check**: Show loading until resolved
- **Network Offline**: Privy handles error states
- **Missing Logo**: Fallback to text-only header

## Future Enhancements

- Background animation/gradient
- Feature highlights
- Social proof
- Beta waitlist (if re-enabled)
