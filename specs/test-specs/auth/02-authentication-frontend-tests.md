# Authentication Frontend - Test Specifications

*References: `/specs/auth-specs/01-authentication-system.md`, `/specs/auth-specs/02-authentication-implementation.md`*

Test specification for authentication frontend components: AuthProvider, ProtectedRoute, LandingPage, and InviteCodePage.

## Core Requirements

### **AuthProvider Context**
- Manage Privy authentication state
- Handle user access status and invite activation
- Provide authentication actions (login, logout, activate, joinWaitlist)
- Integrate with Supabase authenticated client

### **ProtectedRoute Component**
- Route protection based on authentication status
- Conditional access control for invite-gated features
- Loading states and navigation logic

### **Landing Page**
- Multi-provider OAuth login options
- Waitlist email collection
- Feature showcase and branding

### **Invite Code Page**
- Invite code input and validation
- Error handling and user feedback
- Navigation to waitlist or logout

## Essential Tests - AuthProvider

### **Context Initialization**
```
Test 1: Initial state setup
- Mount: AuthProvider wrapper
- Expected: user=null, hasAccess=false, needsInvite=false, isLoading=true

Test 2: Privy provider configuration
- Setup: Environment variables set
- Expected: PrivyProvider configured with correct appId and login methods

Test 3: Authentication state sync
- Input: Privy authentication change
- Expected: AuthProvider state updates accordingly
```

### **User Status Management**
```
Test 4: Status check on mount
- Setup: Authenticated user, mock status API response
- Expected: checkUserStatus called, state updated from response

Test 5: Unauthenticated user state
- Setup: No Privy authentication
- Expected: hasAccess=false, needsInvite=false, user=null

Test 6: Authenticated user without access
- Setup: Valid JWT, API returns needs_invite=true
- Expected: hasAccess=false, needsInvite=true, user=null

Test 7: Activated user state
- Setup: Valid JWT, API returns has_access=true
- Expected: hasAccess=true, needsInvite=false, user populated
```

### **Invite Activation**
```
Test 8: Successful invite activation
- Input: Valid invite code
- Expected: API call succeeds, state updated, returns {success: true}

Test 9: Invalid invite code
- Input: Non-existent code
- Expected: API call fails, returns {success: false, error: "Invalid invite code"}

Test 10: Network error during activation
- Setup: Mock network failure
- Expected: Returns {success: false, error: "Network error"}

Test 11: State update after activation
- Input: Successful activation
- Expected: user set, hasAccess=true, needsInvite=false
```

### **Waitlist Functionality**
```
Test 12: Successful waitlist signup
- Input: Valid email address
- Expected: API call succeeds, returns {success: true}

Test 13: Invalid email format
- Input: Malformed email
- Expected: Returns {success: false, error: "Valid email address is required"}

Test 14: Duplicate email handling
- Input: Email already in waitlist
- Expected: Returns {success: true} (graceful handling)
```

## Essential Tests - ProtectedRoute

### **Authentication Checks**
```
Test 15: Unauthenticated user redirection
- Setup: authenticated=false
- Expected: Redirect to "/" (landing page)

Test 16: Authenticated user without access
- Setup: authenticated=true, hasAccess=false, requireAccess=true
- Expected: Redirect to "/invite"

Test 17: Authenticated user with access
- Setup: authenticated=true, hasAccess=true, requireAccess=true
- Expected: Render children components

Test 18: Loading state display
- Setup: isLoading=true
- Expected: Show loading spinner, don't render children
```

### **Route Protection Logic**
```
Test 19: Basic authentication requirement
- Setup: requireAccess=false, authenticated=true
- Expected: Render children regardless of access status

Test 20: Access requirement enforcement
- Setup: requireAccess=true, authenticated=true, hasAccess=false
- Expected: Block access, redirect to invite page

Test 21: Navigation timing
- Setup: State changes from loading to authenticated
- Expected: Proper navigation without flicker
```

## Essential Tests - LandingPage

### **Authentication Integration**
```
Test 22: Privy login trigger
- Action: Click "Sign In" button
- Expected: Privy login modal opens with correct providers

Test 23: Login method configuration
- Setup: Component mount
- Expected: X/Twitter, Google, Apple, Magic Link options available

Test 24: Post-login navigation
- Setup: Successful Privy authentication
- Expected: User redirected based on access status
```

### **Waitlist Functionality**
```
Test 25: Email form submission
- Input: Valid email in waitlist form
- Expected: joinWaitlist called, success message displayed

Test 26: Email validation
- Input: Invalid email format
- Expected: Form validation error, no API call

Test 27: Success message display
- Setup: Successful waitlist join
- Expected: "Successfully joined" message, form cleared

Test 28: Error message display
- Setup: API error during signup
- Expected: Error message shown, form remains populated
```

### **UI Component Rendering**
```
Test 29: Feature showcase display
- Setup: Component mount
- Expected: Three feature cards with icons and descriptions

Test 30: Responsive layout
- Setup: Different screen sizes
- Expected: Grid layout adapts properly

Test 31: Dark mode support
- Setup: Dark theme active
- Expected: Proper color scheme applied
```

## Essential Tests - InviteCodePage

### **Invite Code Handling**
```
Test 32: Code input formatting
- Input: Lowercase code "alpha001"
- Expected: Automatically converted to uppercase "ALPHA001"

Test 33: Successful code activation
- Input: Valid invite code
- Expected: activateInvite called, redirect to "/feed"

Test 34: Invalid code error
- Setup: API returns invalid code error
- Expected: Error message displayed, form remains active

Test 35: Loading state during activation
- Action: Submit form
- Expected: Button shows "Activating...", form disabled
```

### **Navigation Options**
```
Test 36: Waitlist navigation
- Action: Click "Join the waitlist" link
- Expected: Navigate to landing page

Test 37: Logout functionality
- Action: Click "Sign out" button
- Expected: Privy logout called, redirect to landing

Test 38: Error state recovery
- Setup: Activation fails
- Expected: User can retry or navigate away
```

### **Form Validation**
```
Test 39: Required field validation
- Input: Empty form submission
- Expected: Browser validation prevents submission

Test 40: Code format consistency
- Input: Mixed case code "Alpha001"
- Expected: Normalized to "ALPHA001" before submission
```

## Integration Tests

### **End-to-End Authentication Flow**
```
Test 41: Complete signup flow
- Flow: Landing → Login → Invite → Feed
- Expected: Seamless navigation, proper state transitions

Test 42: Waitlist to activation flow
- Flow: Join waitlist → Receive invite → Activate → Access app
- Expected: Complete user journey works correctly

Test 43: Error recovery flow
- Flow: Failed activation → Retry → Success
- Expected: User can recover from errors gracefully
```

### **State Synchronization**
```
Test 44: Cross-component state consistency
- Setup: Login in one component, check state in another
- Expected: All components reflect same authentication state

Test 45: Refresh handling
- Setup: Page refresh during authenticated session
- Expected: Authentication state properly restored

Test 46: Network failure recovery
- Setup: Network error during status check
- Expected: Graceful error handling, retry mechanism
```

## Security Tests

### **JWT Handling**
```
Test 47: Token inclusion in requests
- Setup: Authenticated user makes API call
- Expected: JWT included in Authorization header

Test 48: Token refresh handling
- Setup: Token expiration during session
- Expected: Automatic refresh, seamless user experience

Test 49: Logout token cleanup
- Action: User logout
- Expected: Tokens cleared, unauthenticated state
```

### **Route Security**
```
Test 50: Direct URL access prevention
- Setup: Unauthenticated user navigates to protected route
- Expected: Redirect to authentication, route blocked

Test 51: Access level enforcement
- Setup: User without invite tries to access feed
- Expected: Redirect to invite page, access denied
```

## Performance Tests

### **Component Optimization**
```
Test 52: Unnecessary re-renders
- Setup: Authentication state unchanged
- Expected: Components don't re-render unnecessarily

Test 53: Large user session handling
- Setup: Extended authenticated session
- Expected: No memory leaks, stable performance

Test 54: Network request efficiency
- Setup: Multiple components using auth context
- Expected: Single status check, shared state
```

### **Loading States**
```
Test 55: Initial load performance
- Setup: App startup
- Expected: Authentication check completes quickly

Test 56: Navigation responsiveness
- Setup: Route changes during auth
- Expected: Immediate loading states, smooth transitions
```

## Error Boundary Tests

### **Component Error Handling**
```
Test 57: AuthProvider error isolation
- Setup: Force error in auth context
- Expected: Error boundary catches, app remains functional

Test 58: Privy integration errors
- Setup: Privy SDK failure
- Expected: Graceful degradation, fallback auth flow

Test 59: API integration errors
- Setup: Auth API unavailable
- Expected: Proper error messages, retry options
```

## Validation Rules
- All authentication state must be consistent across components
- JWT tokens must be securely handled and included in requests
- Error messages must be user-friendly and actionable
- Loading states must provide clear feedback
- Navigation must be smooth and predictable
- Forms must have proper validation and error handling
- Dark mode support must be comprehensive
- Component cleanup must prevent memory leaks