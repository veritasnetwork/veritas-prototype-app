# Post Card - Low Level Specification

## Algorithm

### 1. Data Validation
- Verify post object has required fields: `author`, `title`, `timestamp`
- Apply fallbacks: author name defaults to 'Unknown', title defaults to 'Untitled'
- Determine post type: opinion if `opinion_belief_id` exists, regular otherwise

### 2. Header Rendering
- Render author avatar (circular, initials if no avatar image)
- Display author name from `author.display_name || author.username || 'Unknown'`
- Display timestamp in relative format (e.g., "2 hours ago")
- Layout: horizontal flex with avatar, name, timestamp

### 3. Content Layout
- **Title Area**:
  - Display post title as large headline
  - If opinion post: Position OpinionIndicator in top-right of title area
  - Layout: flex row with title taking remaining space, indicator fixed width
- **Body Area**:
  - Display post content below title
  - Apply text truncation if content exceeds 3 lines
  - Skip body if content is empty

### 4. Opinion Indicator (Opinion Posts Only)
- **Condition**: Render only if `opinion_belief_id` exists and `opinion.yesPercentage` is available
- **Position**: Right-aligned in title area, flex-shrink-0 to prevent compression
- **Data**: Pass `opinion.yesPercentage` to OpinionIndicator component
- **Component**: Renders orange circle with percentage value and "YES" label

### 5. Layout Structure
```
┌─────────────────────────────────────────┐
│ [Avatar] Author Name • timestamp        │
├─────────────────────────────────────────┤
│ Post Title                    [○ 75%]   │ ← Opinion indicator if applicable
│                               [YES ]    │
├─────────────────────────────────────────┤
│ Post content text here...               │
│ Multiple lines supported...             │
└─────────────────────────────────────────┘
```

## Conditional Rendering Rules
- **Author Avatar**: Show initials circle if no avatar image
- **Opinion Indicator**: Only for posts with `opinion_belief_id` and valid percentage
- **Content Area**: Hide if content is null/empty
- **Title**: Always show, use fallback if missing

## Error Handling
- Missing author data: Use 'Unknown' fallback
- Missing title: Use 'Untitled' fallback
- Invalid opinion percentage: Skip OpinionIndicator
- Missing content: Render title-only layout