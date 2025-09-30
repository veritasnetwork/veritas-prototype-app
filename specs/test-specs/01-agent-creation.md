# Agent Creation Test Specification

**Test File:** `tests/protocol/agent-creation.test.ts`
**Function:** `/protocol/agents/create`

## Test Cases

### Happy Path
- **Default stake creation**: No initial_stake provided, uses system config value
- **Custom stake creation**: Valid initial_stake provided, creates agent with specified amount
- **Return validation**: Verify response contains agent_id (UUID) and confirmed total_stake

### Input Validation
- **Zero stake rejection**: initial_stake = 0 → 422 error
- **Negative stake rejection**: initial_stake = -100 → 422 error
- **Invalid type**: initial_stake = "invalid" → 422 error

### System Integration
- **Config fallback**: Missing system_config.initial_agent_stake defaults to 100.0
- **Database persistence**: Agent record correctly saved in agents table
- **UUID generation**: agent_id is valid UUID format

### Edge Cases
- **Large stake**: initial_stake = 999999 → successful creation
- **Decimal stake**: initial_stake = 50.75 → successful creation