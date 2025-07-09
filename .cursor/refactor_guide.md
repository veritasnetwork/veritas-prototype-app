# Sprint 2 Refactor Guide: Prediction Market → Information Intelligence

## 🎯 Core Transformation

**FROM**: Prediction market interface (like Polymarket)
**TO**: Information intelligence feed (like intelligent BBC)

## 📊 Belief Data Structure Changes

### Current Structure (Prediction Market):
```typescript
// Emphasis on financial/betting metrics
{
  id: string;
  title: string;
  category: string;
  totalStake: number;        // ← Prominent
  participantCount: number;  // ← Prominent  
  consensusLevel: number;    // ← Shown as %
  // Minimal content
}
```

### New Structure (Information Intelligence):
```typescript
// Emphasis on rich information content
{
  id: string;
  title: string;
  category: string;
  
  // Rich content components (PRIMARY FOCUS)
  components: {
    heading: { currentVersion: { title, subtitle, importance } };
    article: { currentVersion: { headline, excerpt, credibility } };
    chart: { currentVersion: { type, data, timeframe } };
    metadata: { currentVersion: { quality, reliability } };
  };
  
  // Veritas metrics (secondary, often hidden)
  consensusLevel: number;     // ← Quality indicator, not betting %
  entropy: number;           // ← Information quality
  totalStake?: number;       // ← Hidden or minimal
  participantCount?: number; // ← Secondary info
}
```

## 🃏 Feed Card Transformation

### Current Cards (Remove These):
- ❌ Grouped containers ("Breaking News", "Crypto")
- ❌ Small cards with betting metrics prominent
- ❌ "View" and "Predict" buttons
- ❌ Stake amounts and participant counts
- ❌ Prediction market language

### New Cards (Implement These):
- ✅ **Larger cards** with rich content
- ✅ **Headlines** as primary element
- ✅ **Article excerpts** for context
- ✅ **Charts/data** integrated naturally
- ✅ **Implicit interaction** (click anywhere to explore)
- ✅ **Information quality** indicators
- ✅ **Clean, news-feed styling**

## 🎨 Visual Hierarchy Changes

### Priority 1 (Largest, Most Prominent):
- **Headlines/Titles**: Clear, informative titles
- **Key Data**: Charts, numbers, visual information
- **Article Content**: Excerpts, summaries, context

### Priority 2 (Secondary Information):
- **Credibility**: Quality indicators
- **Quality Metrics**: Information reliability
- **Categories**: Topic classification

### Priority 3 (Minimal/Hidden):
- **Financial Metrics**: Stakes, earnings, betting data
- **Participant Counts**: Number of contributors
- **Market Mechanics**: Prediction-specific elements

## 🚀 Component Updates Needed

### BeliefCard Component:
```typescript
// OLD: Prediction market focus
<BeliefCard>
  <CategoryBadge />
  <SmallTitle />
  <MetricsGrid> {/* participants, stakes, consensus */}
  <ActionButtons> {/* View, Predict */}
</BeliefCard>

// NEW: Information focus  
<BeliefCard>
  <HeadingComponent variant="card" />
  <ArticleComponent variant="card" />
  <ChartComponent variant="card" />
  <MetadataComponent variant="card" />
  {/* Implicit interaction - click anywhere */}
</BeliefCard>
```

### Feed Container:
```typescript
// OLD: Grouped themed sections
<GroupedCardContainer>
  <CardGroup title="Breaking News" />
  <CardGroup title="Crypto" />
  <CardGroup title="Politics" />
</GroupedCardContainer>

// NEW: Social media style stream
<InformationFeed>
  {beliefs.map(belief => 
    <BeliefCard belief={belief} />
  )}
</InformationFeed>
```

## 🗂️ File Changes Required

### Update These Files:
1. **BeliefCard.tsx**: Remove betting UI, add nested components
2. **GroupedCardContainer.tsx**: Replace with simple feed stream
3. **belief.types.ts**: Add component structure, de-emphasize financial data
4. **FeedNav.tsx**: Update filters to focus on information types
5. **data/beliefs.json**: Add rich content (articles, charts, headlines)

### Keep These Patterns:
- ✅ Component composition architecture
- ✅ Theme system (dark/light)
- ✅ Navigation dock styling
- ✅ TypeScript interfaces
- ✅ Mobile-responsive design

## 📱 Navigation Updates

### Remove:
- ❌ Market-focused categories
- ❌ Prediction-specific filters
- ❌ Financial sorting options

### Add/Modify:
- ✅ **Information types**: News, Analysis, Data, Opinion
- ✅ **Quality filters**: High credibility, Verified information
- ✅ **Content types**: Articles, Charts, Summaries
- ✅ **Time relevance**: Recent, Trending, Historical

## ⚡ Quick Implementation Steps

1. **Update data structure** in beliefs.json with rich content
2. **Redesign BeliefCard** to show nested components
3. **Replace GroupedCardContainer** with simple feed
4. **Hide financial metrics** or make them very small
5. **Remove action buttons** (View/Predict)
6. **Add article headlines** and excerpts prominently
7. **Integrate charts** naturally into cards
8. **Test information density** and readability

## 🎯 Success Criteria

**Before**: "I can bet on Bitcoin price"
**After**: "I understand what's happening with Bitcoin based on collective intelligence"

The refactor is successful when users immediately see **rich, informative content** rather than betting interfaces, and the platform feels like an **intelligent news feed** that helps them understand truth through collective wisdom. 