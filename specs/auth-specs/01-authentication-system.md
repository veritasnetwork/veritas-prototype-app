# Authentication & Access Control

User authentication via Privy with invite-based alpha access control. Each authenticated user gets one protocol agent with $10k starting stake.

## Authentication Methods
- **X (Twitter) OAuth**: Social login for discourse platform users
- **Google OAuth**: Widely adopted, convenient access
- **Apple OAuth**: iOS user expectation
- **Magic Link Email**: Passwordless email authentication

## Access Flow

**Landing Page:**
- Join Waitlist (email collection)
- Login (Privy authentication)

**Post-Authentication:**
- **First Time**: Enter invite code → Create protocol agent → App access
- **Returning**: Direct app access (code remembered)

## User-Agent Relationship
- **One-to-One**: Each authenticated user gets exactly one protocol agent
- **Automatic Creation**: Agent created when invite code applied
- **Stake Initialization**: $10,000 starting stake for all users

## Database Requirements

**invite_codes**: Pre-created codes, status tracking
**user_access**: User activation status per invite code
**waitlist**: Email collection for future invites
**users**: Link Privy auth_id to protocol agent_id

## Security Model
- **Privy JWT**: All operations require valid authentication token
- **Invite Validation**: Full app access requires valid invite code
- **Session Persistence**: Login state maintained across browser sessions
- **Row Level Security**: Database policies enforce user data isolation