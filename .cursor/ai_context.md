# Veritas Project Context

## What Veritas Is

Veritas is a **decentralized information intelligence platform** that aggregates collective understanding into truth signals through economic incentives. 

**Core Philosophy: "Polymarket predicts. Veritas understands. Veritas can infer meaning."**

### Veritas Capabilities (Unlike Prediction Markets):

1. **Continuous Data**: Weather metrics, prices, real-time measurements
2. **Social Opinion**: Mindshare within industries, ranking beliefs, collective preferences  
3. **Unresolvable Questions**: Source credibility, document interpretation, moral arguments, analytical remarks
4. **Human Coordination**: Revealing emergent collective voice by ranking beliefs into most important things
5. **Actual News**: Truthful information aggregation, not just betting charts
6. **Past/Present/Future**: Any timeframe, not limited to future predictions

### Key Differentiators:
- **Information over speculation**: Users come to understand, not gamble
- **Truth inference**: Uses economic incentives to surface quality information
- **Collective intelligence**: Harnesses crowd wisdom for understanding complex topics
- **Modular architecture**: Information presented through composable components

## Technical Architecture

### Frontend Stack:
- **Next.js 13+** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Progressive Web App** (PWA)
- **React Context** for state management

### Component Architecture:
- **Template-based design**: Components accept variant props for different contexts
- **Nested components**: Every belief contains HeadingComponent + ArticleComponent + ChartComponent + MetadataComponent
- **Theme-aware**: Light/dark mode support with proper color tokens
- **Mobile-first**: Responsive design with progressive enhancement

### Data Structure:
Beliefs are rich information objects containing:
- **Heading**: Title, subtitle, importance indicators
- **Article**: Headlines, excerpts, sources, credibility scores
- **Chart**: Data visualizations, trends, metrics
- **Metadata**: Quality indicators, timestamps, reliability metrics

## UI/UX Principles

### Design Philosophy:
- **News feed style**: Like BBC meets X/Instagram, not Polymarket
- **Maximum information density**: Every pixel should inform users
- **Content-first**: Headlines, articles, and charts dominate the interface
- **Implicit interaction**: Click cards to explore, minimal UI chrome

### What to Emphasize:
- ✅ **Information quality**: Credibility, sources, reliability
- ✅ **Content clarity**: Headlines, data, visual hierarchy
- ✅ **Understanding aids**: Charts, summaries, context
- ✅ **Truth indicators**: Consensus quality, information gain

### What to De-emphasize:
- ❌ **Financial metrics**: Stakes, winnings, betting language
- ❌ **Gambling elements**: Prediction buttons, odds, speculation
- ❌ **Market mechanics**: Participants counts, financial incentives
- ❌ **Unnecessary chrome**: Excessive buttons, labels, decorations

## Current Project State

### Sprint 2 Focus:
Currently refactoring from prediction market styling to information intelligence platform:

1. **Feed Redesign**: Transform grouped prediction cards to social media-style information feed
2. **Content Focus**: Emphasize headlines, articles, and data over financial metrics
3. **Component Integration**: Implement nested component architecture in feed cards
4. **Navigation Updates**: Auto-hide dock, simplified filtering, information-focused categories

### Key Changes Needed:
- Remove prediction market visual language
- Implement bigger cards with rich content
- Hide or minimize stake/participant displays
- Focus space on informational content
- Make interaction implicit (click to explore)

## Development Guidelines

### When Building Components:
- Ask: "Does this help users understand truth?"
- Prioritize information over interaction
- Make content scannable and digestible  
- Support both mobile and desktop seamlessly
- Maintain component composability

### Data Handling:
- Use JSON mock data during development
- Structure for rich content (articles, charts, images)
- Focus on information quality over financial metrics
- Support past, present, and future events equally

### Performance Priorities:
- Optimize for content-heavy feeds
- Implement smooth scrolling and loading
- Support offline reading (PWA)
- Maintain fast interaction responses

## Target User Experience

Users should:
1. **Immediately understand** what information is being presented
2. **Feel informed** rather than pressured to speculate
3. **Want to explore** topics more deeply
4. **Trust the information** quality and sources
5. **Find navigation** natural and helpful

The platform should feel like an **intelligent news aggregator** that helps users understand complex topics through collective intelligence, not a place for betting or speculation.

## Competitive Context

**Not competing with**: Prediction markets (Polymarket, Kalshi, Manifold)
**Actually competing with**: Information platforms, news aggregators, research tools

**Unique value**: Combines collective intelligence with rich information presentation to help users understand truth, rather than just predict outcomes. 