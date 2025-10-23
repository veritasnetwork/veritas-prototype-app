# Authentication System

Simple Privy-based authentication with automatic user registration. No invite codes or waitlist.

## Authentication Methods
- **Email**: Passwordless magic link authentication
- **Apple**: OAuth for iOS users
- **Solana Wallet**: External wallet connection (Phantom, Backpack, etc.)

## Access Flow

**Landing Page (/):**
- Redirects to `/feed`

**Feed Page (/feed):**
- Shows posts to all visitors (authenticated or not)
- Displays auth popup modal for unauthenticated users
- Authenticated users can create posts and trade on pools

**Authentication & Onboarding Flow:**
1. **Unauthenticated**: Shows auth popup → user connects wallet via Privy
2. **Authenticated, First Time**: `/api/auth/status` returns `needsOnboarding: true` → shows onboarding modal
3. **Onboarding**: User enters username → creates agent ($10k stake) + user record via edge function
4. **Authenticated, Returning**: Direct access to all features

**Critical Requirement**: Onboarding modal ONLY appears if `authenticated === true AND needsOnboarding === true`

## User-Agent Relationship
- **One-to-One**: Each authenticated user gets exactly one protocol agent
- **Automatic Creation**: Agent created during onboarding via edge function `app-user-creation`
- **Stake Initialization**: $10,000 starting stake for all new users
- **Timing**: Agent + user created atomically when user completes onboarding (NOT on first auth check)

## Database Schema

**agents**: Protocol agents with Solana address and stake tracking
**users**: App users linked to protocol agents via `agent_id`

## Security Model
- **Privy JWT**: All authenticated operations require valid JWT token
- **Auto-Registration**: Users automatically registered on first login
- **Session Persistence**: Login state maintained across browser sessions
- **Row Level Security**: Database policies enforce user data isolation