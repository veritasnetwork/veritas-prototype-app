# Post Card - High Level Specification

## Purpose
Render individual posts with appropriate visual differentiation for opinion vs regular posts.

## Core Requirements
- Display author avatar, name, and timestamp
- Display post title as prominent headline
- Display post content as body text
- For opinion posts only: Display aggregate belief in orange circular indicator (right-aligned)
- Handle missing data gracefully with fallback values
- Maintain consistent layout regardless of post type

## Visual Differentiation
- **Opinion Posts**: Include OpinionIndicator component showing belief aggregate
- **Regular Posts**: Standard layout without opinion indicator
- **Both Types**: Same author header, title, content structure

## Data Contract
**Input**: Post object with author, title, content, timestamp, opinion data (if applicable)
**Output**: Rendered post card with conditional opinion indicator
**Fallbacks**: Handle missing author names, titles, content gracefully