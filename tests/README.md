# Test Suite

Automated tests for Veritas Protocol functions.

## Structure

```
tests/
├── protocol/          # Protocol-level edge function tests
│   └── agent-creation.test.ts
└── app/              # App-level edge function tests
    └── user-creation.test.ts
```

## Running Tests

### Prerequisites
1. Start Supabase locally: `npx supabase start`
2. Start functions server: `npx supabase functions serve`
3. Install Deno if not available: `curl -fsSL https://deno.land/install.sh | sh`
4. Add Deno to PATH: `export PATH="/Users/$USER/.deno/bin:$PATH"`

### Run All Tests
```bash
# Set PATH if needed
export PATH="/Users/$USER/.deno/bin:$PATH"

# Run all tests
deno test --allow-net tests/
```

### Run Specific Test Suite
```bash
# Protocol tests only
deno test --allow-net tests/protocol/

# App tests only  
deno test --allow-net tests/app/

# Specific test file
deno test --allow-net tests/app/user-creation.test.ts
```

## Test Coverage

### Protocol Tests
- ✅ `protocol-agent-creation`
  - Default stake creation
  - Custom stake creation  
  - Negative stake validation
  - Zero stake allowed

### App Tests
- ✅ `app-user-creation`
  - Success with display name
  - Success without display name (defaults to username)
  - Empty username validation
  - Whitespace username validation
  - Username too short/long validation
  - Duplicate username rejection

## Test Data

Tests use unique usernames generated with timestamps to avoid collisions:
```typescript
function generateUniqueUsername() {
  return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
```

## Environment

Tests run against local Supabase instance:
- Functions URL: `http://127.0.0.1:54321/functions/v1/`
- Uses local anon key for authentication