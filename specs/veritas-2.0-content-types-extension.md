# Veritas 2.0 Multiple Content Types - Complete Implementation Specification

## Executive Summary

Extend the current Veritas frontend from supporting a single content type (News) to supporting four distinct content types: News, Opinion Markets, Conversations, and Blog Posts. All content types will be ranked by the same algorithmic signal system but will have unique UI presentations and interaction patterns.

## Background & Context

### Current State
- The application currently only supports "News" content type
- All content is displayed using the same card and detail page components
- The feed shows content ranked by user-selected algorithms based on signals (truth, relevance, informativeness, etc.)
- PremierHeader shows top 3 items

### Conversation with Josh (Key Requirements)
- Josh emphasized the need for different content types to demonstrate various use cases
- Specific examples were provided for each content type
- UI should support both full-width and half-width cards in the feed
- Not all content needs graphs/charts
- Users should understand what it would look like to post content

## Content Types Specification

### 1. News Content (Existing - Enhanced)
**Purpose**: Breaking news, current events, factual reporting  
**Card Layout**: Full width in feed  
**Key Features**:
- Maintains current implementation with charts/graphs
- Article text with headline and excerpt
- Real-time data visualizations
- Single wide card in feed

**Examples**:
- Current news stories already in the system
- Breaking financial news
- Technology announcements

### 2. Opinion Market Content (New)
**Purpose**: Trade opinions, make predictions, gauge consensus  
**Card Layout**: Half width (2 cards per row)  
**Key Features**:
- Interactive prediction interface
- Big percentage/value display
- Users can validate/change predictions
- Multiple subtypes based on question format

**Subtypes**:
- **Percentage**: "What's the current inflation rate?" (0-100% slider)
- **Yes/No Binary**: "Is Multicoin a tier-one VC?" (toggle)
- **Multiple Choice**: "Best pizza topping?" (radio buttons)
- **Ranking**: "Top 10 most interesting DeFi protocols" (drag & drop list)

**Josh's Specific Examples**:
- "Likelihood of nuclear detonation" (percentage)
- "What's the current inflation rate?" (percentage)  
- "Best pizza topping" (multiple choice)
- "Is Multicoin a tier-one VC?" (yes/no)
- "Top 10 most interesting DeFi protocols" (ranking)

### 3. Conversation Content (New)
**Purpose**: Twitter-style discussion threads, community dialogue  
**Card Layout**: Half width or full width (flexible)  
**Key Features**:
- Topic header with description
- Threaded comments system
- Participant count and activity indicators
- Real-time discussion updates

**Examples**:
- "The future of DeFi governance"
- "Stablecoin adoption in emerging markets"
- "Weekly crypto market discussion"

### 4. Blog Post Content (New)
**Purpose**: Long-form analysis, opinion pieces, educational content  
**Card Layout**: Full width in feed  
**Key Features**:
- Article format without mandatory charts
- Author attribution
- Tags/categories
- Reading time estimate
- More focused on narrative than data

**Josh's Specific Examples**:
- "Why DeFi is better suited for emerging markets"
- "Stablecoins in Africa and cross-border payments"
- Financial analysis pieces
- Opinion editorials

## Data Structure Updates

### Type Definitions

```typescript
// content.types.ts - Core type definitions
export type ContentType = 'news' | 'opinion' | 'conversation' | 'blog';

export type OpinionType = 'percentage' | 'yes-no' | 'multiple-choice' | 'ranking';

// Base content interface shared by all types
export interface BaseContent {
  id: string;
  type: ContentType;
  heading: HeadingData;
  signals: SignalCollection;
  createdAt: string;
  updatedAt: string;
  status?: 'active' | 'resolved';
  isPremier?: boolean;
  author?: string;
  tags?: string[];
}

// News Content (existing, refined)
export interface NewsContent extends BaseContent {
  type: 'news';
  article: ArticleData;
  charts?: ChartData[];
  source?: string;
  breakingNews?: boolean;
}

// Opinion Market Content
export interface OpinionContent extends BaseContent {
  type: 'opinion';
  question: string;
  description?: string;
  opinionType: OpinionType;
  
  // For percentage type
  currentValue?: number;
  range?: { min: number; max: number };
  unit?: string; // %, $, etc.
  
  // For yes-no type
  yesPercentage?: number;
  
  // For multiple-choice and ranking
  options?: string[];
  optionVotes?: { [option: string]: number };
  
  // User participation tracking
  totalParticipants: number;
  userPredictions?: Map<string, any>;
  
  // Resolution
  resolutionDate?: string;
  resolvedValue?: any;
}

// Conversation Content
export interface ConversationContent extends BaseContent {
  type: 'conversation';
  topic: string;
  description: string;
  initialPost?: string;
  
  // Discussion metrics
  commentCount: number;
  participantCount: number;
  lastActivityAt: string;
  
  // Comments will be loaded separately
  featuredComments?: Comment[];
  
  // Moderation
  isLocked?: boolean;
  isPinned?: boolean;
}

// Blog Post Content
export interface BlogContent extends BaseContent {
  type: 'blog';
  article: ArticleData;
  author: string;
  authorBio?: string;
  
  // Blog-specific metadata
  readingTime: number; // in minutes
  wordCount: number;
  tags: string[];
  category: string;
  
  // Engagement
  relatedPosts?: string[]; // IDs of related content
  citations?: Citation[];
}

// Union type for all content
export type Content = NewsContent | OpinionContent | ConversationContent | BlogContent;

// Helper interfaces
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
  likes: number;
  replies?: Comment[];
  parentId?: string;
}

export interface Citation {
  text: string;
  source: string;
  url?: string;
}
```

## Component Architecture

### File Structure
```
src/components/
├── feed/
│   ├── ContentCard.tsx (main dispatcher)
│   ├── cards/
│   │   ├── NewsCard.tsx
│   │   ├── OpinionCard.tsx
│   │   ├── ConversationCard.tsx
│   │   └── BlogCard.tsx
│   └── MainFeed.tsx (updated for mixed content)
├── content-details/
│   ├── ContentDetailPage.tsx (main dispatcher)
│   ├── pages/
│   │   ├── NewsDetailPage.tsx (current implementation)
│   │   ├── OpinionDetailPage.tsx
│   │   ├── ConversationDetailPage.tsx
│   │   └── BlogDetailPage.tsx
│   └── shared/
│       ├── SignalsSection.tsx (shared across all types)
│       └── RelatedContent.tsx
└── premier/
    └── PremierHeader.tsx (updated with 4-dot system)
```

### Component Specifications

#### ContentCard Dispatcher
```typescript
// ContentCard.tsx
interface ContentCardProps {
  content: Content;
  variant?: 'feed' | 'compact' | 'premier';
  onClick: (id: string) => void;
}

// Routes to appropriate card based on content.type
// Handles layout (full vs half width)
```

#### OpinionCard Component
```typescript
// Key UI Elements:
// - Large percentage/value display
// - Interactive controls based on opinionType
// - Participation count
// - "Validate" button to contribute
// - Visual indicator of consensus/disagreement
```

#### ConversationCard Component
```typescript
// Key UI Elements:
// - Topic title prominently displayed
// - Comment count and participant avatars
// - Preview of latest comments
// - "Join conversation" CTA
// - Activity heat indicator
```

#### BlogCard Component  
```typescript
// Key UI Elements:
// - Title and excerpt
// - Author name and avatar
// - Reading time
// - Tags displayed
// - No charts/graphs required
// - Thumbnail image (optional)
```

## PremierHeader Enhancement

### 4-Dot Navigation System
Replace current 3-dot system with 5-dot system (one for each view):

```typescript
interface PremierHeaderState {
  activeView: 'all' | 'news' | 'opinion' | 'conversation' | 'blog';
  contentByType: {
    all: Content[];        // Top 3 overall by algorithm
    news: NewsContent[];   // Top 3 news
    opinion: OpinionContent[]; // Top 3 opinions
    conversation: ConversationContent[]; // Top 3 conversations
    blog: BlogContent[];   // Top 3 blogs
  };
}

// Visual representation:
// [●] All  [○] News  [○] Opinion  [○] Conversation  [○] Blog
// Clicking each dot filters PremierHeader to show top 3 of that type
```

### Behavior
- Default: "All" view shows top 3 content items regardless of type
- Type-specific views: Show top 3 items of that specific type
- Smooth transitions between views
- Dot indicators show active state

## Feed Layout Logic

### Layout Rules
```typescript
const getCardLayout = (content: Content): 'full' | 'half' => {
  switch(content.type) {
    case 'news': return 'full';      // 1 per row
    case 'blog': return 'full';      // 1 per row
    case 'opinion': return 'half';   // 2 per row
    case 'conversation': return 'half'; // 2 per row
  }
};
```

### Mixed Content Feed Rendering
```typescript
// MainFeed should intelligently group half-width cards
// Example feed layout:
// [------------ News Item ------------]
// [-- Opinion --][-- Conversation --]
// [------------ Blog Post ------------]
// [-- Opinion --][-- Opinion --------]
```

### Remove Feed Limit
- Currently limited to showing items 4-10 after premier
- Remove this cap for infinite scroll
- Load more content as user scrolls

## UI/UX Specifications

### Opinion Market Interactions

#### Percentage Type
- Horizontal slider (0-100 or custom range)
- Large percentage display above slider
- Show average vs user's prediction
- Animated transitions on value change

#### Yes/No Type
- Toggle switch or two large buttons
- Show percentage split (e.g., "73% Yes | 27% No")
- User's selection highlighted

#### Multiple Choice Type
- Radio button group
- Bar chart showing vote distribution
- Highlight user's selection

#### Ranking Type  
- Drag-and-drop list interface
- Show aggregate ranking vs user's ranking
- Visual diff indicator

### Conversation Threading
- Nested comment structure (max 3 levels)
- Collapsible threads
- Sort options: newest, oldest, most liked
- Reply button on each comment
- Show participant avatars

### Blog Post Display
- Clean article layout
- Typography optimized for reading
- Table of contents for long posts
- Share buttons
- Related posts section

## Sample Data Creation

### Test Data Structure
```typescript
// data/sample-content.ts

export const sampleOpinionContent: OpinionContent[] = [
  {
    id: 'opinion-1',
    type: 'opinion',
    heading: {
      title: 'Is Multicoin a Tier-1 VC?',
      subtitle: 'Community consensus on VC firm rankings'
    },
    question: 'Is Multicoin Capital considered a tier-one venture capital firm?',
    opinionType: 'yes-no',
    yesPercentage: 73,
    totalParticipants: 1247,
    signals: {
      truth: generateSignal(72),
      relevance: generateSignal(84),
      informativeness: generateSignal(67),
      // ... other signals
    },
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T14:30:00Z'
  },
  {
    id: 'opinion-2',
    type: 'opinion',
    heading: {
      title: 'Current Inflation Rate Prediction',
      subtitle: 'Crowd-sourced economic forecasting'
    },
    question: 'What is the current annual inflation rate?',
    opinionType: 'percentage',
    currentValue: 3.7,
    range: { min: 0, max: 10 },
    unit: '%',
    totalParticipants: 892,
    signals: {
      truth: generateSignal(81),
      relevance: generateSignal(91),
      informativeness: generateSignal(78),
      // ... other signals
    },
    createdAt: '2024-01-14T08:00:00Z',
    updatedAt: '2024-01-15T16:45:00Z'
  },
  {
    id: 'opinion-3',
    type: 'opinion',
    heading: {
      title: 'Top 10 DeFi Protocols',
      subtitle: 'Community ranking of most interesting DeFi projects'
    },
    question: 'Rank the most interesting DeFi protocols',
    opinionType: 'ranking',
    options: [
      'Uniswap',
      'Aave', 
      'Compound',
      'MakerDAO',
      'Curve',
      'Yearn',
      'Synthetix',
      'Balancer',
      'SushiSwap',
      'PancakeSwap'
    ],
    totalParticipants: 534,
    signals: {
      truth: generateSignal(65),
      relevance: generateSignal(77),
      informativeness: generateSignal(83),
      // ... other signals
    },
    createdAt: '2024-01-13T12:00:00Z',
    updatedAt: '2024-01-15T09:15:00Z'
  }
];

export const sampleConversationContent: ConversationContent[] = [
  {
    id: 'conv-1',
    type: 'conversation',
    heading: {
      title: 'Stablecoin Adoption in Africa',
      subtitle: 'Discussing cross-border payment solutions'
    },
    topic: 'How stablecoins are revolutionizing cross-border payments in Africa',
    description: 'A discussion about the role of stablecoins in solving remittance challenges and enabling financial inclusion across African markets.',
    commentCount: 127,
    participantCount: 43,
    lastActivityAt: '2024-01-15T16:20:00Z',
    signals: {
      truth: generateSignal(70),
      relevance: generateSignal(88),
      informativeness: generateSignal(75),
      // ... other signals
    },
    createdAt: '2024-01-12T10:00:00Z',
    updatedAt: '2024-01-15T16:20:00Z'
  }
];

export const sampleBlogContent: BlogContent[] = [
  {
    id: 'blog-1',
    type: 'blog',
    heading: {
      title: 'Why DeFi is Better Suited for Emerging Markets',
      subtitle: 'An analysis of decentralized finance adoption patterns'
    },
    article: {
      content: 'Full article content here...',
      credibility: 'high',
      headline: 'DeFi adoption in emerging markets is outpacing developed nations',
      excerpt: 'Traditional banking infrastructure limitations have created a unique opportunity for DeFi protocols to serve underbanked populations...'
    },
    author: 'Sarah Chen',
    authorBio: 'DeFi researcher and emerging markets specialist',
    readingTime: 8,
    wordCount: 1650,
    tags: ['DeFi', 'Emerging Markets', 'Financial Inclusion'],
    category: 'Analysis',
    signals: {
      truth: generateSignal(78),
      relevance: generateSignal(82),
      informativeness: generateSignal(89),
      // ... other signals
    },
    createdAt: '2024-01-14T14:00:00Z',
    updatedAt: '2024-01-14T14:00:00Z'
  }
];
```

## Implementation Phases

### Phase 1: Foundation (Day 1)
1. Create type definitions in `content.types.ts`
2. Update existing types to use new structure
3. Create sample data for all content types
4. Update data loading functions

### Phase 2: Detail Pages (Day 1-2)
1. Refactor current ContentDetailPage to NewsDetailPage
2. Create OpinionDetailPage with interaction components
3. Create ConversationDetailPage with comment system
4. Create BlogDetailPage with article layout
5. Create ContentDetailPage dispatcher

### Phase 3: Card Components (Day 2)
1. Refactor current ContentCard to NewsCard
2. Create OpinionCard with percentage/vote display
3. Create ConversationCard with activity indicators
4. Create BlogCard with author info
5. Create ContentCard dispatcher

### Phase 4: Feed Updates (Day 2-3)
1. Update MainFeed to handle mixed content types
2. Implement intelligent layout grouping for half-width cards
3. Remove feed limit, implement infinite scroll
4. Test with mixed content data

### Phase 5: PremierHeader Enhancement (Day 3)
1. Implement 5-dot navigation system
2. Add filtering logic for each content type
3. Create smooth transitions between views
4. Update data fetching to get top 3 per type

### Phase 6: Polish & Testing (Day 3)
1. Ensure signals work consistently across all types
2. Test algorithm ranking with mixed content
3. Verify responsive design for all card types
4. Add loading states and error handling

## Technical Considerations

### Algorithm Compatibility
- All content types must have the same signal structure
- Signals should be comparable across different content types
- Algorithm weights apply uniformly regardless of content type

### Performance
- Lazy load comments for conversation type
- Virtualize long lists for ranking opinions
- Optimize image loading for blog posts
- Cache algorithm calculations

### State Management
```typescript
// FeedContext updates
interface FeedContextType {
  // ... existing
  contentTypeFilter: ContentType | 'all';
  setContentTypeFilter: (type: ContentType | 'all') => void;
}
```

### Responsive Design
- Half-width cards should stack on mobile
- Opinion interactions should be touch-friendly
- Comment threads should be readable on small screens

### Accessibility
- ARIA labels for all interactive elements
- Keyboard navigation for ranking interfaces
- Screen reader support for percentage displays
- Proper heading hierarchy in blog posts

## Success Criteria

1. **Multiple Content Types**: Successfully display and interact with all 4 content types
2. **Mixed Feed**: Feed shows all content types ranked by selected algorithm
3. **Type-Specific UIs**: Each content type has appropriate interaction patterns
4. **PremierHeader Filtering**: 5-dot system allows filtering by content type
5. **Consistent Signals**: All content types work with existing signal/algorithm system
6. **Responsive Layout**: Half and full-width cards display correctly
7. **Sample Data**: Josh's specific examples are implemented
8. **User Understanding**: Clear visual distinction between content types