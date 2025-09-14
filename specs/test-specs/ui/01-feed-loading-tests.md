# Feed Loading - Test Specifications

*References: `/specs/ui-specs/01-feed-loading.md`, `/specs/ui-specs/low-level-ui-specs/01-feed-loading.md`*

## Component Unit Tests

### Feed Component State Management
- **Test**: Initial state setup
  - Verify `posts` starts as empty array
  - Verify `loading` starts as true
  - Verify `error` starts as null

- **Test**: Loading state transitions
  - Mount component → verify loading is true
  - API success → verify loading becomes false, posts populated
  - API error → verify loading becomes false, error set

### PostsService Data Transformation
- **Test**: API response transformation
  - Given valid API response → verify correct Post object structure
  - Given missing author name → verify fallback to 'Unknown'
  - Given missing title → verify fallback to 'Untitled'
  - Given opinion post with belief → verify opinion percentage calculation

- **Test**: Opinion post classification
  - Given post with `opinion_belief_id` → verify classified as opinion
  - Given post without `opinion_belief_id` → verify classified as regular
  - Given opinion post with `belief.initial_aggregate` → verify percentage = `Math.round(aggregate * 100)`

### Error Handling
- **Test**: Malformed API responses
  - Given response without `posts` array → verify graceful handling
  - Given response without `total_count` → verify graceful handling
  - Given posts with missing required fields → verify fallback values applied

## Integration Tests

### Feed Data Fetching
- **Test**: API call parameters
  - Verify POST request to correct endpoint
  - Verify Authorization header with Bearer token
  - Verify request body contains `user_id`, `limit`, `offset`

- **Test**: End-to-end data flow
  - Mock API response → verify Feed renders correct number of PostCards
  - Mock opinion post → verify OpinionIndicator appears
  - Mock regular post → verify OpinionIndicator does not appear

### Component Rendering
- **Test**: Loading state display
  - Mount Feed → verify skeleton with 3 placeholder cards
  - Skeleton should have author, title, content placeholders

- **Test**: Error state display
  - Mock API failure → verify error message displayed
  - Verify refresh button present and functional

- **Test**: Success state display
  - Mock successful API response → verify posts render in correct order
  - Verify author names, titles, content display correctly
  - Verify timestamps format correctly

## PostCard Component Tests

### Data Display
- **Test**: Basic post rendering
  - Given post with all fields → verify author, title, content render
  - Given post timestamp → verify relative time format
  - Given post without content → verify title still renders

### Opinion Indicator Integration
- **Test**: Opinion post rendering
  - Given opinion post with percentage → verify OpinionIndicator renders
  - Verify OpinionIndicator positioned right-aligned
  - Verify orange circle with correct percentage value

- **Test**: Regular post rendering
  - Given regular post → verify OpinionIndicator does not render
  - Verify layout remains correct without indicator

## API Contract Tests

### Response Validation
- **Test**: Expected API response structure
  - Mock actual API endpoint → verify response has required fields
  - Verify `posts` is array, `total_count` is number
  - Verify post objects contain expected fields

### Data Integrity
- **Test**: Real API integration
  - Call actual `/app/posts/get-feed` endpoint
  - Verify response matches PostsService transformation expectations
  - Verify no data is lost in transformation process

## Error Boundary Tests

### Network Failures
- **Test**: API timeout handling
  - Mock slow API response → verify error state after timeout
  - Verify existing posts remain if error occurs

- **Test**: Network connectivity issues
  - Mock network failure → verify error message with retry option
  - Mock invalid response → verify graceful degradation

### Data Validation
- **Test**: Invalid post data handling
  - Given posts with null/undefined fields → verify fallbacks applied
  - Given posts with invalid timestamps → verify graceful handling
  - Given malformed opinion data → verify safe rendering

## Performance Tests

### Rendering Performance
- **Test**: Large dataset handling
  - Mock 50 posts → verify rendering completes within reasonable time
  - Verify no memory leaks during re-renders

### State Update Efficiency
- **Test**: Unnecessary re-renders
  - Verify component doesn't re-render when props unchanged
  - Verify efficient state updates during loading transitions