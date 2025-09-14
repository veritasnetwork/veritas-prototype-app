# Dashboard Feed Tests

Tests for `/dashboard/posts/get-feed` endpoint to ensure proper retrieval of posts with enriched belief and submission data for dashboard monitoring.

## Test Categories

### 1. Basic Feed Functionality Tests
- **Standard feed request**: Return posts with pagination
- **Empty feed**: Handle case with no posts
- **Pagination**: Respect limit and offset parameters
- **Post ordering**: Return posts in reverse chronological order

### 2. Belief Data Enrichment Tests
- **Opinion posts**: Include belief data for posts with opinion_belief_id
- **Regular posts**: No belief data for posts without opinion_belief_id
- **Mixed feed**: Handle mix of opinion and regular posts correctly
- **Missing belief data**: Graceful handling when belief record is missing

### 3. Submission Data Enrichment Tests
- **Posts with submissions**: Include detailed submission data
- **Posts without submissions**: Empty submissions array for beliefs with no submissions
- **Submission data accuracy**: Verify stake calculations and user data are correct
- **Partial submission failures**: Continue processing other posts if one fails

### 4. Data Consistency Tests
- **Field alignment**: Ensure same fields as regular feed are present
- **Data type consistency**: Numbers, strings, dates in correct format
- **User data consistency**: Same user representation across posts and submissions
- **Belief data consistency**: Same belief fields as regular API

### 5. Performance Tests
- **Response time**: Acceptable performance with submission data included
- **Large datasets**: Handle feeds with many opinion posts
- **Submission-heavy posts**: Handle posts with many submissions efficiently
- **Concurrent dashboard requests**: Multiple dashboard users

### 6. Error Handling Tests
- **Downstream failures**: Handle submission API failures gracefully
- **Partial data**: Return posts even if some submission data unavailable
- **Database errors**: Proper error responses for database issues
- **Stake calculation errors**: Continue with partial data if stakes fail

## Specific Test Scenarios

### Test Data Setup
```
Posts:
1. Regular post: "News Update" (no opinion_belief_id)
2. Opinion post: "Will it rain tomorrow?"
   - belief_id: test-belief-1
   - 3 submissions from alice, bob, charlie
3. Opinion post: "Market prediction"
   - belief_id: test-belief-2
   - 1 submission from alice
4. Opinion post: "No submissions yet"
   - belief_id: test-belief-3
   - 0 submissions
```

### Expected Response Structure
```json
{
  "posts": [
    {
      "id": "post-1",
      "title": "News Update",
      "opinion_belief_id": null,
      "user": { "username": "admin" }
      // No belief or submissions fields
    },
    {
      "id": "post-2",
      "title": "Will it rain tomorrow?",
      "opinion_belief_id": "test-belief-1",
      "user": { "username": "alice" },
      "belief": {
        "belief_id": "test-belief-1",
        "previous_aggregate": 0.65,
        "status": "active"
      },
      "submissions": [
        {
          "user": { "username": "alice" },
          "belief": 0.7,
          "stake_allocated": 25.5
        },
        {
          "user": { "username": "bob" },
          "belief": 0.4,
          "stake_allocated": 18.2
        }
      ]
    }
  ],
  "total_count": 4
}
```

## Integration Test Scenarios

### 1. End-to-End Data Flow
- Create test user and belief
- Submit belief to market
- Fetch dashboard feed
- Verify user, belief, and stake data are correct

### 2. Real Stake Calculations
- Use actual epistemic weights calculations
- Verify stake allocations match protocol rules
- Test with different agent total stakes

### 3. Cross-Function Consistency
- Compare with regular feed API for basic post data
- Ensure belief data matches between APIs
- Verify user data consistency

## Performance Benchmarks

### Response Time Targets
- **Small feed (5 posts, 10 submissions)**: < 500ms
- **Medium feed (20 posts, 50 submissions)**: < 1000ms
- **Large feed (50 posts, 200 submissions)**: < 2000ms

### Error Response Tests

### 422 - Invalid Pagination
```json
{
  "error": "Limit must be between 1 and 100",
  "code": 422
}
```

### 503 - Service Unavailable
```json
{
  "error": "Failed to enrich submission data",
  "code": 503
}
```

### Partial Success Response
```json
{
  "posts": [/* posts with available data */],
  "total_count": 10,
  "warnings": [
    "Submission data unavailable for 2 posts"
  ]
}
```