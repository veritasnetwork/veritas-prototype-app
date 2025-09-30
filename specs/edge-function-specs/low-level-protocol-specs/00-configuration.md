# Configuration Parameters

All configurable parameters for the Veritas protocol.

## Database Storage
Configuration parameters are stored in the `system_config` table with these initial values:

### Economic Parameters
- **min_participants_for_scoring**: "2" (minimum agents for BTS scoring)
- **min_stake_per_belief**: "0.5" (minimum stake allocated per belief in USD)
- **initial_agent_stake**: "100.0" (default stake for new agents)

### Belief Constraints
- **min_belief_duration**: "5" (minimum epochs)
- **max_belief_duration**: "100" (maximum epochs)

### Epoch Management
- **epoch_duration_seconds**: "3600" (1 hour per epoch, configurable: 300/3600/86400)
- **epoch_processing_trigger**: "cron" (options: "cron", "manual", "event-driven")
- **epoch_processing_enabled**: "false" (whether automatic processing is active)
- **current_epoch**: "0" (global epoch counter)

### System Limits
- **max_agents_per_belief**: "10000"

## Hardcoded Constants
These values are compile-time constants for numerical stability:

- **EPSILON_PROBABILITY**: 1e-10 (for clamping probabilities away from 0/1)
- **EPSILON_STAKES**: 1e-8 (for stake calculations)
- **CONSERVATION_TOLERANCE**: 1e-6 (for stake conservation verification)

## Application Constants
Character limits for app layer:

- **MAX_TITLE_LENGTH**: 200 characters
- **MAX_CONTENT_LENGTH**: 2000 characters

### Media Validation
File upload constraints for Supabase Storage:

- **SUPPORTED_IMAGE_TYPES**: ["image/jpeg", "image/png", "image/gif", "image/webp"]
- **SUPPORTED_VIDEO_TYPES**: ["video/mp4", "video/webm", "video/mov"]
- **MAX_IMAGE_SIZE_MB**: 10 (megabytes)
- **MAX_VIDEO_SIZE_MB**: 100 (megabytes)
- **STORAGE_BUCKET**: "post-media"

### Media Processing
- **Image optimization**: Automatic WebP conversion via Supabase transforms
- **Video processing**: Client-side compression recommended
- **CDN delivery**: Automatic via Supabase Storage CDN

## Complexity Bounds
- **Aggregation**: O(n) where n = participants
- **BTS Scoring**: O(n²) where n = participants

## Error Codes

### Client Errors (4xx)
- **400**: Invalid input
- **404**: Resource not found
- **409**: Insufficient participants
- **422**: Missing required fields

### Server Errors (5xx)
- **500**: Conservation violation
- **501**: Division by zero
- **502**: Numerical overflow
- **503**: Database transaction failure
- **504**: Invalid state

## Usage
- Database-stored configs: Read from `system_config` table by key
- Hardcoded constants: Reference directly in code
- Character limits: Validate in app layer before protocol calls