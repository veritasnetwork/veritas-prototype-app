# Create Post Modal Component Specification

## Purpose
Full-screen modal for creating new posts with belief markets, allowing users to input title, content, and belief duration.

## Visual Design

### Layout (Desktop)
```
┌────────────────────────────────────────────────────┐
│  Create Post                           [✕ Close]   │
├────────────────────────────────────────────────────┤
│                                                    │
│  Title                                             │
│  ┌──────────────────────────────────────────────┐ │
│  │ Enter post title...                          │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  Content                                           │
│  ┌──────────────────────────────────────────────┐ │
│  │                                              │ │
│  │ Share your thoughts...                       │ │
│  │                                              │ │
│  │                                              │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  Belief Duration                                   │
│  ┌──────────────────────────────────────────────┐ │
│  │ 48 hours ▾                                   │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│                        [Cancel]  [Create Post →]  │
└────────────────────────────────────────────────────┘
```

### Dimensions
- **Width**: 600px (desktop), 100% (mobile)
- **Height**: Auto (min-height 500px)
- **Padding**: 32px (desktop), 24px (mobile)
- **Border-radius**: 16px (desktop), 0 (mobile full-screen)

### Styling
- **Background**: `var(--bg-elevated)` (#1a1a1a)
- **Backdrop**:
  - `background: rgba(0, 0, 0, 0.8)`
  - `backdrop-filter: blur(10px)`
- **Border**: 1px solid `var(--border-elevated)`
- **Shadow**: `var(--shadow-xl)`
- **Z-index**: `var(--z-modal)` (1200)

## Components

### Header
- **Title**: "Create Post"
  - Font: Bold, 24px
  - Color: `var(--text-primary)`
- **Close Button**:
  - Position: Absolute top-right
  - Size: 40x40px
  - Icon: ✕ (20px)
  - Color: `var(--text-secondary)`
  - Hover: `var(--text-primary)`, background `var(--bg-hover)`
  - Border-radius: 8px
  - Keyboard: Escape key also closes

### Title Input
- **Label**: "Title"
  - Font: Medium, 14px
  - Color: `var(--text-secondary)`
  - Margin-bottom: 8px
- **Input**:
  - Font: Regular, 18px
  - Color: `var(--text-primary)`
  - Background: `var(--bg-primary)`
  - Border: 1px solid `var(--border)`
  - Border-radius: 8px
  - Padding: 12px 16px
  - Placeholder: "Enter post title..."
  - Max-length: 200 characters
  - Focus: Border `var(--accent-primary)`, outline none
  - Character count: Show "45/200" in corner (tertiary text)

### Content Input
- **Label**: "Content"
  - Same styling as Title label
- **Textarea**:
  - Font: Regular, 16px
  - Color: `var(--text-primary)`
  - Background: `var(--bg-primary)`
  - Border: 1px solid `var(--border)`
  - Border-radius: 8px
  - Padding: 16px
  - Min-height: 200px
  - Resize: vertical
  - Placeholder: "Share your thoughts..."
  - Max-length: 2000 characters
  - Focus: Border `var(--accent-primary)`
  - Character count: Show "125/2000" in corner

### Belief Duration Dropdown
- **Label**: "Belief Duration"
  - Same styling as Title label
- **Select**:
  - Font: Regular, 16px
  - Color: `var(--text-primary)`
  - Background: `var(--bg-primary)`
  - Border: 1px solid `var(--border)`
  - Border-radius: 8px
  - Padding: 12px 16px
  - Options:
    - "24 hours" (1 epoch)
    - "48 hours" (2 epochs) - **Default**
    - "72 hours" (3 epochs)
    - "1 week" (7 epochs)
  - Icon: Chevron down (right-aligned)

### Footer Actions
- **Layout**: Flex row, justify-end, gap 12px
- **Cancel Button**:
  - Text: "Cancel"
  - Font: Medium, 16px
  - Color: `var(--text-secondary)`
  - Background: transparent
  - Border: 1px solid `var(--border)`
  - Padding: 12px 24px
  - Border-radius: 8px
  - Hover: Background `var(--bg-hover)`
- **Create Button**:
  - Text: "Create Post →"
  - Font: Medium, 16px
  - Color: #ffffff
  - Background: `var(--accent-primary)`
  - Border: none
  - Padding: 12px 32px
  - Border-radius: 8px
  - Hover: Background `var(--accent-hover)`, scale(1.02)
  - Disabled: Opacity 0.4, cursor not-allowed
  - Loading: Show spinner, text "Creating..."

## States

### Default
- All fields empty
- Create button disabled

### Filling
- Title has focus, placeholder visible
- Create button disabled until title + content filled

### Valid
- Title and content have text
- Create button enabled

### Submitting
- All inputs disabled
- Create button shows loading spinner
- Close button disabled

### Error
- Show error message below form
- Red border on invalid field
- Create button re-enabled

## Interactions

### Open Modal
1. Fade in backdrop (200ms)
2. Scale modal from 0.95 to 1 (200ms, ease-out)
3. Disable body scroll
4. Focus on title input
5. Trap keyboard focus in modal

### Close Modal
1. ESC key, backdrop click, or close button
2. Confirm if content exists: "Discard post?"
3. Fade out backdrop
4. Scale modal from 1 to 0.95
5. Re-enable body scroll
6. Return focus to FAB

### Submit
1. Validate title (1-200 chars) and content (1-2000 chars)
2. Show loading state
3. Call API: `POST /api/posts/create`
4. On success:
   - Close modal
   - Show toast: "Post created!"
   - Navigate to `/post/{id}` OR prepend to feed
5. On error:
   - Show error message
   - Re-enable form

## Data Flow

### Request Format
```typescript
POST /api/posts/create
{
  title: string;
  content: string;
  belief_duration_hours: number; // 24, 48, 72, 168
}
```

### Response Format
```typescript
{
  success: boolean;
  post: {
    id: string;
    title: string;
    content: string;
    created_at: string;
    belief_id: string;
  };
}
```

## Validation Rules

### Title
- Required: Yes
- Min length: 1 character
- Max length: 200 characters
- Pattern: Any text (no special validation)

### Content
- Required: Yes
- Min length: 1 character
- Max length: 2000 characters
- Pattern: Any text

### Duration
- Required: Yes
- Default: 48 hours
- Valid values: [24, 48, 72, 168]

## Responsive Behavior

### Desktop (>768px)
- Centered modal (600px width)
- Rounded corners
- Can be closed by clicking backdrop

### Mobile (<768px)
- Full-screen modal (100% width, height)
- No rounded corners
- Backdrop click does not close (requires X button)
- Close button fixed top-right
- Keyboard pushes content up (iOS)

## Accessibility
- **Semantic**: `<dialog>` element or `role="dialog"`
- **ARIA**:
  - `aria-labelledby="modal-title"`
  - `aria-modal="true"`
- **Focus Trap**: Trap focus within modal
- **Keyboard**:
  - ESC to close
  - Tab cycles through inputs
  - Enter in title focuses content
  - Cmd/Ctrl+Enter submits
- **Screen Reader**: Announce modal open/close

## Performance
- **Lazy Load**: Only render when opened
- **Debounce**: Character count updates debounced (100ms)
- **Optimistic UI**: Prepend post to feed immediately after submit

## Implementation Notes
- Component: `<CreatePostModal isOpen={isOpen} onClose={onClose} />`
- Location: `src/components/post/CreatePostModal.tsx`
- Triggered by: FAB click in Feed
- State management: Local state for form inputs
- API: `useCreatePost()` hook

## Edge Cases
- **Network Error**: Show retry button
- **Server Error**: Show error message with details
- **Concurrent Creation**: Prevent multiple submits
- **Data Loss**: Auto-save draft to localStorage (future)
- **Long Content**: Textarea expands, modal scrolls
- **Special Characters**: Allow all UTF-8 characters
