# Critical Bug: Non-Idempotent Epoch Processing

## Problem

If a user's settlement transaction fails after epoch processing completes, running epoch processing again will **compound stake changes**.

### Current Flow
1. User clicks "Rebase"
2. Server runs epoch processing → **Updates stakes in database**
3. Server returns settlement transaction to user
4. User's transaction fails (network error, rejected, etc.)
5. User tries to rebase again
6. Server runs epoch processing AGAIN → **Updates stakes AGAIN with same data**

### Why It Compounds
- Epoch processing calculates BTS scores from belief submissions
- Redistributes stakes based on those scores
- **Next run uses the newly updated stakes** to calculate weights
- Same predictions get rewarded/slashed multiple times

## Example
- Agent A: 100 USDC stake, submits good prediction
- Agent B: 100 USDC stake, submits bad prediction

**First epoch process:**
- Agent A: +10 USDC → 110 USDC
- Agent B: -10 USDC → 90 USDC

**Second epoch process (if tx failed):**
- Weights now 110:90 instead of 100:100
- Agent A gets rewarded MORE (has more stake weight)
- Agent B gets slashed MORE (has less stake weight)
- Compounds unfairly!

## Solutions

### Option 1: Track Last Processed Epoch (Recommended)
Add `last_processed_epoch` to beliefs table:
- Before processing: Check if `last_processed_epoch >= current_epoch`
- If yes: Skip processing, return existing BD score
- If no: Process and update `last_processed_epoch`

### Option 2: Rollback on Transaction Failure
- Store changes in temporary table
- Commit only after on-chain confirmation
- Complex distributed transaction logic

### Option 3: Dry-Run Mode
- Add `dry_run` parameter to epoch processing
- Dry-run: Calculate BD score without updating stakes
- After tx confirms: Run again with dry-run=false

## Recommended Fix: Option 1

Most pragmatic and safe.
