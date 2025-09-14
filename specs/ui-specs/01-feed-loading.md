# Feed Loading - High Level Specification

## Purpose
Display chronological list of posts from app-post-get-feed API with opinion indicators for belief markets.

## Core Requirements
- Fetch posts from `/app/posts/get-feed` API endpoint
- Extract: author name, title, content, timestamp, belief aggregate (if opinion post)
- Display posts in reverse chronological order
- Show loading states and error handling
- Display belief aggregate in orange circular indicator (right-aligned) for opinion posts only

## Data Contract
**Input**: user_id, limit, offset
**Output**: posts array with embedded user and belief aggregate data
**Error Handling**: Continue rendering with valid data, show retry for network failures