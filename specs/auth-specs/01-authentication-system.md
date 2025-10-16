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

**Post-Authentication:**
- **First Time**: Auto-creates protocol agent with $10k starting stake
- **Returning**: Direct access to all features

## User-Agent Relationship
- **One-to-One**: Each authenticated user gets exactly one protocol agent
- **Automatic Creation**: Agent created on first login via `/api/auth/status`
- **Stake Initialization**: $10,000 starting stake for all new users

## Database Schema

**agents**: Protocol agents with Solana address and stake tracking
**users**: App users linked to protocol agents via `agent_id`

## Security Model
- **Privy JWT**: All authenticated operations require valid JWT token
- **Auto-Registration**: Users automatically registered on first login
- **Session Persistence**: Login state maintained across browser sessions
- **Row Level Security**: Database policies enforce user data isolation