# Protocol Indexer Belief Submissions Tests

Tests for `/protocol-indexer/beliefs/get-submissions` endpoint to ensure proper retrieval and enrichment of belief submission data with stake calculations.

## Test Categories

### 1. Input Validation Tests
- **Valid belief_id format**: Accept valid UUID
- **Invalid belief_id format**: Reject malformed UUIDs (422)
- **Missing belief_id**: Reject empty request (422)
- **Non-existent belief_id**: Return 404 for valid UUID that doesn't exist

### 2. Data Retrieval Tests
- **Belief with submissions**: Return belief info and all submissions
- **Belief without submissions**: Return belief info with empty submissions array
- **Multiple submissions**: Handle beliefs with many submissions correctly
- **Submission ordering**: Return submissions ordered by created_at DESC

### 3. Data Enrichment Tests
- **User data joining**: Include correct username and display_name for each submission
- **Stake calculation**: Call epistemic weights function and include stake_allocated
- **Missing user data**: Handle submissions where user no longer exists
- **Stake calculation failure**: Graceful handling when stake calculation fails

### 4. Response Structure Tests
- **Required fields present**: All specified fields exist in response
- **Data types correct**: Numbers are numbers, strings are strings, etc.
- **Belief info structure**: Contains all belief metadata fields
- **Submission structure**: Each submission has required fields

### 5. Performance Tests
- **Response time**: Complete within reasonable time for typical belief
- **Large submission sets**: Handle beliefs with many submissions (50+)
- **Concurrent requests**: Handle multiple simultaneous requests

### 6. Edge Cases
- **Expired belief**: Return data for expired beliefs
- **System config missing**: Handle missing current_epoch gracefully
- **Database connection issues**: Return 503 on database errors

## Specific Test Scenarios

### Test Data Setup
```
Belief: test-belief-id-1
- creator_agent_id: agent-alice
- previous_aggregate: 0.65
- expiration_epoch: 10
- status: active

Submissions:
1. User: alice, belief: 0.7, meta: 0.6, stake: 25.5, active: true
2. User: bob, belief: 0.4, meta: 0.5, stake: 18.2, active: true
3. User: charlie, belief: 0.8, meta: 0.7, stake: 12.3, active: false
```

### Expected Response Format
```json
{
  "belief_id": "test-belief-id-1",
  "belief_info": {
    "creator_agent_id": "agent-alice",
    "previous_aggregate": 0.65,
    "expiration_epoch": 10,
    "status": "active"
  },
  "submissions": [
    {
      "user": {
        "username": "alice",
        "display_name": "Alice Smith"
      },
      "belief": 0.7,
      "meta_prediction": 0.6,
      "stake_allocated": 25.5,
      "is_active": true
    }
  ]
}
```

## Error Response Tests

### 422 - Invalid Input
```json
{
  "error": "Invalid belief_id format",
  "code": 422
}
```

### 404 - Belief Not Found
```json
{
  "error": "Belief not found",
  "code": 404
}
```

### 503 - Service Error
```json
{
  "error": "Failed to calculate stake allocations",
  "code": 503
}
```