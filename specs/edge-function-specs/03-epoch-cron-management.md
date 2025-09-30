# Epoch Cron Management Specification

Comprehensive specification for time-based epoch processing, cron scheduling, and UI-configurable timing controls.

## Overview

The system requires automated, time-based epoch processing with user-configurable intervals and start/stop controls accessible from the dashboard UI.

## Data Architecture

### **System Configuration Extensions**
Current `system_config` table enhanced with timing fields:

```sql
-- Existing fields:
current_epoch: "21"
epoch_duration_seconds: "3600"
epoch_processing_enabled: "false"
epoch_processing_trigger: "cron"

-- Required new fields:
current_epoch_start_time: "2025-09-15T10:00:00.000Z"
next_epoch_deadline: "2025-09-15T11:00:00.000Z"
cron_job_id: "epoch-processor-job-uuid"
cron_last_run: "2025-09-15T10:58:32.123Z"
cron_next_run: "2025-09-15T11:00:00.000Z"
cron_status: "active" | "paused" | "stopped" | "error"
```

### **Epoch History Table** (New)
Track epoch transitions and timing accuracy:

```sql
CREATE TABLE epoch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epoch_number INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  scheduled_duration_seconds INTEGER NOT NULL,
  actual_duration_seconds INTEGER,
  processing_triggered_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,
  processing_duration_ms INTEGER,
  beliefs_processed INTEGER DEFAULT 0,
  beliefs_expired INTEGER DEFAULT 0,
  cron_triggered BOOLEAN DEFAULT false,
  manual_triggered BOOLEAN DEFAULT false,
  status TEXT CHECK (status IN ('active', 'completed', 'failed', 'timeout')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Cron Management Functions

### **Start Cron Scheduling**
`/admin/cron/epoch-processing/start`

**Input:**
- `epoch_duration_seconds`: number (optional, uses config default)
- `immediate_start`: boolean (default: false)

**Behavior:**
1. Validate `epoch_processing_enabled` is true
2. Calculate next epoch deadline based on current time + duration
3. Create/update cron job with Supabase Cron extension
4. Update system_config with timing fields
5. Insert initial epoch_history record

**Output:**
- `cron_job_id`: string
- `next_epoch_deadline`: timestamp
- `status`: "started"

### **Stop Cron Scheduling**
`/admin/cron/epoch-processing/stop`

**Input:**
- `complete_current_epoch`: boolean (default: true)

**Behavior:**
1. Mark current cron job as stopped
2. If complete_current_epoch=true, allow current epoch to finish
3. Update system_config: cron_status="stopped"
4. Close current epoch_history record

**Output:**
- `status`: "stopped"
- `final_epoch`: number

### **Update Cron Timing**
`/admin/cron/epoch-processing/update-timing`

**Input:**
- `new_duration_seconds`: number
- `apply_immediately`: boolean (default: false)

**Behavior:**
1. Update epoch_duration_seconds in system_config
2. If apply_immediately=true:
   - Complete current epoch
   - Start new epoch with new timing
   - Reschedule cron job
3. If apply_immediately=false:
   - Apply to next epoch cycle

**Output:**
- `updated_duration`: number
- `next_epoch_start`: timestamp
- `cron_rescheduled`: boolean

## Cron Implementation Strategy

### **Supabase Cron Integration**
Use Supabase's built-in `pg_cron` extension:

```sql
-- Install cron extension (done once)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Dynamic cron job creation
SELECT cron.schedule(
  'epoch-processing-job',
  '0 * * * *', -- Every hour at minute 0
  'SELECT net.http_post(
    url := ''http://localhost:54321/functions/v1/protocol-epochs-process-cron'',
    headers := ''{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}''::jsonb,
    body := ''{}''::jsonb
  );'
);
```

### **Cron-Triggered Processing Function**
`/protocol/epochs/process-cron`

**Differences from manual processing:**
1. **Time validation**: Verify current time ≥ next_epoch_deadline
2. **History tracking**: Record cron trigger in epoch_history
3. **Error handling**: Enhanced logging for automated context
4. **Timing updates**: Automatically calculate next epoch timing

**Behavior:**
1. Check if cron processing is enabled and on schedule
2. Validate timing requirements are met
3. Execute standard epoch processing chain
4. Update timing fields for next epoch
5. Record comprehensive history metrics

## UI Dashboard Integration

### **Epoch Control Panel**
Dashboard section: `/dashboard/epoch-management`

**Controls:**
- **Status Indicator**: Current epoch, time remaining, cron status
- **Start/Stop Button**: Toggle automated processing
- **Timing Configuration**:
  - Duration slider (30s - 24h for development/production)
  - Apply timing changes immediately or next cycle
- **Manual Trigger**: Force epoch processing now
- **History View**: Recent epoch transitions and performance

**Real-time Updates:**
- WebSocket/polling for live epoch countdown
- Processing status during epoch transitions
- Error alerts for failed automated processing

### **Configuration API Endpoints**

**Get Status**: `GET /api/admin/epoch-status`
```json
{
  "current_epoch": 21,
  "epoch_start_time": "2025-09-15T10:00:00.000Z",
  "time_remaining_seconds": 1847,
  "next_deadline": "2025-09-15T11:00:00.000Z",
  "cron_status": "active",
  "processing_enabled": true
}
```

**Update Config**: `POST /api/admin/epoch-config`
```json
{
  "epoch_duration_seconds": 1800,
  "processing_enabled": true,
  "apply_immediately": false
}
```

## Error Handling & Recovery

### **Cron Failure Recovery**
- **Missed deadlines**: If cron doesn't execute within 5 minutes of deadline
- **Processing failures**: Retry logic with exponential backoff
- **System recovery**: Restart cron jobs after database restarts

### **Timing Drift Correction**
- **Clock sync validation**: Ensure database time matches system time
- **Deadline adjustment**: Compensate for processing delays
- **History analysis**: Track timing accuracy and drift patterns

## Minute-Aligned Timing System

### **Core Timing Constraints**
- **Minimum duration**: 60 seconds (1 minute)
- **Duration requirement**: Must be multiples of 60 seconds
- **Epoch boundaries**: Always start and end at :00 seconds
- **Auto-rounding**: Durations automatically rounded up to nearest minute

### **Examples**
```
Request: 90 seconds → System: 120 seconds (2 minutes)
Request: 45 seconds → System: 60 seconds (1 minute)
Request: 150 seconds → System: 180 seconds (3 minutes)
```

### **Benefits**
- Perfect pg_cron synchronization (no timing precision issues)
- Predictable scheduling (epochs always process at minute boundaries)
- 100% reliable triggering (no missed epochs due to timing misalignment)
- Simplified cron management (clean minute-based expressions)

### **Development vs Production Modes**

### **Development Mode**
- Shorter epochs (60 seconds - 300 seconds) for testing
- All durations still minute-aligned
- Manual override capabilities
- Detailed logging and debugging

### **Production Mode**
- Standard epochs (3600 seconds - 86400 seconds)
- All durations minute-aligned
- Robust error handling and recovery
- Performance monitoring and alerting

## Migration Requirements

### **Database Schema Updates**
1. Add new system_config fields with defaults
2. Create epoch_history table
3. Install pg_cron extension
4. Create initial cron job templates

### **Configuration Migration**
1. Set current_epoch_start_time based on last processing
2. Calculate initial next_epoch_deadline
3. Default cron_status to "stopped" (manual enable required)

## Security Considerations

### **Admin Access Control**
- Cron management requires admin privileges
- Service role authentication for cron-triggered functions
- Audit logging for configuration changes

### **Resource Protection**
- Rate limiting on manual epoch triggers
- Maximum epoch frequency limits
- Processing timeout protections

## Testing Strategy

### **Cron Simulation Testing**
- Mock time-based triggers for unit tests
- Configurable test epochs (1-second durations)
- Automated timing accuracy validation

### **Integration Testing**
- Full cron cycle testing in staging environment
- Error recovery scenario testing
- UI control integration testing

This specification ensures consistent, configurable, and UI-controllable epoch timing that scales from development testing to production operation.