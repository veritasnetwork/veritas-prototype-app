# Tiptap Rich Text Editor Component Specification

## Overview
Rich text editor component for creating article-style posts with inline images, automatic link detection, and drag-and-drop image repositioning.

**Component**: `TiptapEditor`
**Location**: `src/components/post/TiptapEditor.tsx`
**Used in**: `CreatePostModal` (article posts)

---

## Features

### ✅ Text Formatting
- **Bold** (Ctrl/Cmd+B)
- **Italic** (Ctrl/Cmd+I)
- **Headings** (H1, H2, H3)
- **Normal Text** (Paragraph)
- **Bullet List**
- **Numbered List**
- **Blockquote**
- **Undo/Redo**

### ✅ Link Support
- **Auto-detection**: URLs automatically become clickable links
  - Type or paste `https://example.com` → becomes a link
  - Works on space or Enter key press
- **Paste URLs**: Pasted URLs automatically convert to links
- **Security**: All links open in new tab with `rel="noopener noreferrer nofollow"`
- **Styling**: Blue, underlined on hover
- **No manual dialog**: No browser prompts or manual link insertion needed

### ✅ Image Support
- **Inline insertion**: Click 🖼️ Image button → file picker → uploads to Supabase Storage
- **Cursor position**: Images insert exactly where cursor is in article
- **Drag & drop repositioning**: Click and drag images to reposition in article
- **Visual feedback**:
  - Hover: Shadow effect, cursor changes to "grab hand"
  - Dragging: Cursor changes to "grabbing hand", blue drop indicator shows target position
  - Selected: Blue outline with glow
- **Delete protection**: Backspace/Delete keys do NOT remove images
- **Delete button**: Red X button appears on hover/selection
  - Deletes image from backend storage (Supabase)
  - Removes image from editor
  - Shows loading spinner during deletion

### ✅ Sticky Toolbar
- **Always visible**: Toolbar stays fixed at top when scrolling long articles
- **Max height**: Editor container limited to 600px height
- **Scrollable content**: Article content scrolls independently beneath toolbar
- **Responsive**: Works on all screen sizes

---

## Visual Design

### Layout
```
┌────────────────────────────────────────────────────────┐
│ [B] [I] │ [H1][H2][H3][P] │ [•][1.]["] │ [↶][↷] [🖼️] │ ← Sticky Toolbar
├────────────────────────────────────────────────────────┤
│                                                        │
│  Article content scrolls here...                       │
│                                                        │
│  https://example.com ← auto-linked                    │
│                                                        │
│  ┌──────────────────────────┐                         │
│  │                          │ [X] ← Delete button     │
│  │      [Inline Image]      │                         │
│  │                          │                         │
│  └──────────────────────────┘                         │
│                                                        │
│  More content...                                       │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Dimensions
- **Max height**: 600px (with sticky toolbar)
- **Min height**: 250px
- **Toolbar height**: ~56px (auto)
- **Border**: 1px solid `#374151` (gray-700)
- **Border-radius**: 8px

### Styling
- **Background**:
  - Editor: `#0a0a0a` (very dark)
  - Toolbar: `#1a1a1a` (elevated)
- **Text color**: `#ffffff` (white)
- **Border**: `#374151` (gray-700)
- **Link color**: `#60a5fa` (blue-400)
- **Placeholder**: `#6b7280` (gray-500)

---

## Toolbar Buttons

### Formatting Buttons
| Icon | Function | Keyboard Shortcut | Active State |
|------|----------|-------------------|--------------|
| **B** | Bold | Ctrl/Cmd+B | Blue background |
| *I* | Italic | Ctrl/Cmd+I | Blue background |
| H1 | Heading 1 | - | Blue background |
| H2 | Heading 2 | - | Blue background |
| H3 | Heading 3 | - | Blue background |
| P | Paragraph | - | Blue background |
| • | Bullet List | - | Blue background |
| 1. | Numbered List | - | Blue background |
| " | Blockquote | - | Blue background |
| ↶ | Undo | Ctrl/Cmd+Z | Disabled when no history |
| ↷ | Redo | Ctrl/Cmd+Shift+Z | Disabled when no future |
| 🖼️ | Image Upload | - | Shows spinner when uploading |

### Button States
- **Default**: Gray (`#9ca3af`)
- **Hover**: Gray-700 background
- **Active**: Blue (`#60a5fa`) with gray-700 background
- **Disabled**: 50% opacity, not-allowed cursor

---

## Image Node Component

### Custom Image Extension
**File**: `src/components/post/CustomImageExtension.ts`
- Extends Tiptap Image extension
- Uses React Node View for custom rendering
- Prevents backspace/delete from removing images

### Image Node Component
**File**: `src/components/post/TiptapImageNode.tsx`

**Features**:
- Draggable (native HTML5 drag & drop)
- Delete button (top-right, red X)
- Backend cleanup on delete
- Loading state during upload/delete
- Selected state visual feedback

**Visual States**:
- **Default**: Rounded corners, responsive
- **Hover**: Subtle shadow, delete button appears, grab cursor
- **Dragging**: Grabbing cursor, blue drop indicator
- **Selected**: Blue ring outline
- **Deleting**: Spinner replaces X icon

---

## Link Auto-Detection

### Tiptap Link Extension
**Configuration**:
```typescript
Link.configure({
  openOnClick: false,       // Don't open in edit mode
  autolink: true,           // Auto-detect URLs
  linkOnPaste: true,        // Convert pasted URLs
  HTMLAttributes: {
    class: 'text-blue-400 underline hover:text-blue-500 cursor-pointer',
    target: '_blank',
    rel: 'noopener noreferrer nofollow',
  },
})
```

### Behavior
- User types: `Check out https://example.com for more info`
- After space/enter: `https://example.com` becomes a clickable link
- User pastes URL: Automatically converted to link
- In read mode (TiptapRenderer): Links are clickable

---

## Image Upload Flow

### 1. User Clicks Image Button
- File picker opens
- Accepts: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Max size: 10MB

### 2. Upload to Backend
**API**: `POST /api/media/upload-image`
- Uploads to Supabase Storage bucket: `veritas-media`
- Path: `images/{user_id}/{timestamp}-{random}.{ext}`
- Returns: `{ url: "https://..." }`

### 3. Insert in Editor
- Image inserted at cursor position
- Stored as Tiptap node with `src` attribute
- Rendered via custom React component

### 4. User Can Reposition
- Click and drag image anywhere
- Blue drop indicator shows target position
- Releases to drop in new position

### 5. User Can Delete
- Hover over image → X button appears
- Click X → shows spinner
- Deletes from Supabase Storage via `DELETE /api/media/delete`
- Removes from editor
- If backend delete fails, still removes from editor

---

## Image Deletion Flow

### Delete API Endpoint
**Route**: `DELETE /api/media/delete`
**File**: `app/api/media/delete/route.ts`

**Request**:
```json
{
  "path": "images/user123/12345-abc.jpg"
}
```

**Security**:
- Verifies user owns the file (checks path matches user ID)
- Uses Privy JWT authentication
- Only deletes from user's own folder

**Response**:
```json
{
  "success": true,
  "message": "File deleted successfully",
  "path": "images/user123/12345-abc.jpg"
}
```

---

## Keyboard Shortcuts

### Formatting
- **Bold**: Ctrl/Cmd+B
- **Italic**: Ctrl/Cmd+I
- **Undo**: Ctrl/Cmd+Z
- **Redo**: Ctrl/Cmd+Shift+Z

### Navigation
- **Tab**: Indent list item (if in list)
- **Shift+Tab**: Outdent list item
- **Enter**: New paragraph
- **Shift+Enter**: Line break

### Image Protection
- **Backspace**: Does NOT delete images (only text)
- **Delete**: Does NOT delete images (only text)
- Use delete button (X) to remove images

---

## Props Interface

```typescript
interface TiptapEditorProps {
  content: TiptapDocument | null;      // Tiptap JSON structure
  onChange: (content: TiptapDocument) => void;  // Called on every change
  placeholder?: string;                 // Placeholder text
  disabled?: boolean;                   // Disable editing
}
```

### TiptapDocument Type
```typescript
interface TiptapDocument {
  type: 'doc';
  content: TiptapNode[];
}

interface TiptapNode {
  type: string;                        // 'paragraph', 'heading', 'image', etc.
  attrs?: Record<string, any>;         // Node attributes (e.g., src for images)
  content?: TiptapNode[];              // Child nodes
  text?: string;                       // Text content
  marks?: Array<{                      // Text formatting marks
    type: string;                      // 'bold', 'italic', 'link'
    attrs?: Record<string, any>;       // Mark attributes (e.g., href for links)
  }>;
}
```

---

## Content Storage

### Example Tiptap JSON with Image and Link
```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Check out " },
        {
          "type": "text",
          "text": "https://example.com",
          "marks": [
            {
              "type": "link",
              "attrs": {
                "href": "https://example.com",
                "target": "_blank",
                "rel": "noopener noreferrer nofollow"
              }
            }
          ]
        },
        { "type": "text", "text": " for more info." }
      ]
    },
    {
      "type": "image",
      "attrs": {
        "src": "https://supabase.co/storage/v1/object/public/veritas-media/images/user123/12345-abc.jpg",
        "alt": null,
        "title": null
      }
    },
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "More content here..." }
      ]
    }
  ]
}
```

### Database Storage
- **Column**: `posts.content_json` (JSONB)
- **Plain text extraction**: Also stored in `posts.content_text` for search/preview

---

## TiptapRenderer Component

**File**: `src/components/post/TiptapRenderer.tsx`

### Purpose
Read-only rendering of Tiptap content for viewing posts.

### Differences from Editor
- No toolbar
- Not editable
- Links are clickable (`openOnClick: true`)
- Images are display-only (no delete button)
- No drag-and-drop

### Usage
```tsx
<TiptapRenderer
  content={post.content_json}
  className="custom-class"
/>
```

---

## CSS Styles

**File**: `src/styles/globals.css`

### Editor Base Styles
```css
.ProseMirror {
  outline: none;
  min-height: 200px;
  color: var(--text-primary);
}
```

### Link Styles
```css
.ProseMirror a {
  color: var(--accent-primary);     /* Blue-400 */
  text-decoration: underline;
  cursor: pointer;
}

.ProseMirror a:hover {
  color: var(--accent-hover);       /* Blue-500 */
}
```

### Image Styles
```css
.ProseMirror img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md);
  display: block;
  cursor: grab;
  transition: all 0.2s ease;
}

.ProseMirror img:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.ProseMirror img:active {
  cursor: grabbing;
}
```

### Drop Cursor (drag indicator)
```css
.ProseMirror .ProseMirror-dropcursor {
  position: relative;
  pointer-events: none;
}

.ProseMirror .ProseMirror-dropcursor::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  height: 3px;
  background-color: var(--accent-primary);  /* Blue line */
  border-radius: 2px;
}
```

---

## Dependencies

### NPM Packages
```json
{
  "@tiptap/react": "^3.6.5",
  "@tiptap/starter-kit": "^3.6.5",
  "@tiptap/extension-placeholder": "^3.6.5",
  "@tiptap/extension-link": "^3.6.6",
  "@tiptap/extension-image": "^3.6.6",
  "@tiptap/extension-dropcursor": "^3.6.6"
}
```

### Tiptap Extensions Used
1. **StarterKit** - Basic formatting (bold, italic, headings, lists, etc.)
2. **Placeholder** - Placeholder text
3. **Link** - Auto-link detection
4. **CustomImage** - Custom image with delete button
5. **Dropcursor** - Visual drop indicator for drag & drop

---

## Security Considerations

### Link Security
- ✅ `target="_blank"` - Opens in new tab
- ✅ `rel="noopener noreferrer nofollow"` - Prevents security exploits
- ✅ No JavaScript URLs allowed (Tiptap handles this)

### Image Security
- ✅ File type validation (JPEG, PNG, GIF, WebP only)
- ✅ File size limits (10MB max)
- ✅ Authenticated uploads only (Privy JWT)
- ✅ User-specific storage paths (`images/{user_id}/`)
- ✅ Public read, authenticated write (RLS policies)
- ✅ Delete authorization (users can only delete own files)

### Content Security
- ✅ Content stored as JSON (no XSS risk)
- ✅ Images served from trusted Supabase domain
- ✅ No user-uploaded JavaScript execution

---

## Performance Considerations

### Image Loading
- Images stored in Supabase CDN (fast loading)
- Consider: Lazy loading for posts with many images (future)
- Consider: Image optimization/compression (future)

### Editor Performance
- Tiptap is lightweight and performant
- JSON storage is efficient
- Debouncing not needed for current use case

### Rendering Performance
- TiptapRenderer is read-only (no unnecessary updates)
- Feed cards use plain text (`content_text`) for preview
- Rich rendering only in detail view

---

## Accessibility

### Keyboard Navigation
- All toolbar buttons focusable
- Tab through buttons
- Keyboard shortcuts work
- Undo/Redo accessible

### Screen Readers
- Toolbar buttons have `title` attributes
- Image nodes have `alt` attributes
- Links announce as links
- Edit mode clearly indicated

### Focus Management
- Editor focuses on mount (if needed)
- Focus returns to button after upload
- No focus traps

---

## Edge Cases & Error Handling

### Image Upload Errors
- **Network error**: Show alert, allow retry
- **File too large**: Show alert, prevent upload
- **Invalid file type**: Show alert, prevent upload
- **Authentication failed**: Show alert, prompt login

### Image Deletion Errors
- **Network error**: Still removes from editor (orphaned file won't break UI)
- **Unauthorized**: Show alert
- **File not found**: Still removes from editor

### Content Errors
- **Large documents**: Editor handles gracefully
- **Many images**: Scroll works with sticky toolbar
- **Empty content**: Placeholder shows

### Browser Compatibility
- Tested on: Chrome, Firefox, Safari, Edge
- Mobile: iOS Safari, Android Chrome
- Drag & drop: Works on desktop, touch on mobile

---

## Future Enhancements

### Image Features
- [ ] Drag-and-drop file upload
- [ ] Image alt text editor
- [ ] Image resize handles
- [ ] Image alignment options (left, center, right)
- [ ] Image captions
- [ ] Image compression/optimization
- [ ] Multiple image upload at once

### Link Features
- [ ] Link preview cards (unfurl)
- [ ] Link validation (check if URL exists)
- [ ] Internal post linking (`/post/[id]`)
- [ ] Link editing dialog (vs. automatic)

### Editor Features
- [ ] Code blocks with syntax highlighting
- [ ] Tables
- [ ] Embeds (YouTube, Twitter, etc.)
- [ ] Mentions (@username)
- [ ] Emoji picker
- [ ] Markdown shortcuts (e.g., `**bold**`)

---

## Testing Checklist

### Unit Tests
- [ ] Image upload to Supabase Storage
- [ ] Image URL insertion into editor
- [ ] Link auto-detection
- [ ] Image drag & drop
- [ ] Image deletion from storage
- [ ] Backspace protection for images

### Integration Tests
- [ ] Create article post with inline image
- [ ] Create article post with links
- [ ] View post in detail panel - images render
- [ ] View post in detail panel - links are clickable
- [ ] Delete image - removes from storage and editor
- [ ] Drag image - repositions correctly

### Visual/UX Tests
- [ ] Sticky toolbar stays at top when scrolling
- [ ] Upload spinner shows during image upload
- [ ] Delete button appears on hover
- [ ] Drag cursor changes (grab → grabbing)
- [ ] Blue drop indicator shows during drag
- [ ] Images are properly styled (rounded, responsive)
- [ ] Links are visually distinct (blue, underlined on hover)

---

**Status**: ✅ Implemented
**Last Updated**: January 2025
**Version**: 1.0
