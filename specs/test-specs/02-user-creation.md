# User Creation Test Specification

**Test File:** `tests/app/user-creation.test.ts`
**Function:** `/app/users/create`

## Test Cases

### Happy Path
- **Basic creation**: Required auth_provider + auth_id, auto-generated username
- **Custom username**: Provided username, auth credentials
- **Custom stake**: Custom initial_stake passed to agent creation
- **Return validation**: Verify user_id, agent_id, and user object with total_stake

### Authentication Validation
- **Missing auth_provider**: Empty string → 422 error
- **Missing auth_id**: Empty string → 422 error
- **Duplicate auth**: Same auth_provider + auth_id → 409 error

### Username Handling
- **Auto-generation**: No username provided → generates "privy123456" format
- **Username collision**: Auto-generated username exists → regenerates
- **Custom valid**: Provided username "testuser" → uses as-is
- **Custom duplicate**: Provided username exists → 409 error
- **Invalid length**: Username too short/long → 422 error

### Protocol Integration
- **Agent creation**: Calls `/protocol/agents/create` with correct initial_stake
- **Agent linking**: User record correctly references created agent_id
- **Stake caching**: User.total_stake matches agent.total_stake

### Edge Cases
- **Long auth_id**: 255 character auth_id → successful creation
- **Special characters**: auth_id with special chars → successful creation
- **Display name**: Provided display_name different from username