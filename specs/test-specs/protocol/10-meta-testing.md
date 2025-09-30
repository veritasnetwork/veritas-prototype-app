# Test 10: Meta-Testing Framework Specification

## Overview

Design a comprehensive meta-testing framework that enables systematic validation of the Veritas protocol across multiple scenarios, agent behaviors, and scale levels. The framework should provide sufficient context for automated reasoning about protocol correctness and identification of edge cases or unexpected behaviors.

## Goals

1. **Systematic Protocol Validation**: Test protocol behavior across multiple configurations
2. **Behavioral Pattern Analysis**: Study how different agent types interact and evolve
3. **Edge Case Discovery**: Identify corner cases and failure modes
4. **Performance Characteristics**: Understand system behavior at scale
5. **Automated Analysis**: Provide sufficient context for AI-assisted protocol analysis

## Key Requirements

### 1. Test Configuration Management
- **Parameterized Scenarios**: Easy configuration of different test scenarios
- **Agent Behavior Modeling**: Configurable agent behavioral patterns
- **Scale Flexibility**: Support for small validation tests to large stress tests
- **Reproducibility**: Deterministic test execution with seed control

### 2. Comprehensive Context Capture
- **Complete Transaction History**: Every function call with parameters and responses
- **State Transitions**: Before/after system state for each operation
- **Timing Information**: Performance metrics and execution timing
- **Error Context**: Detailed error information and recovery paths

### 3. Analysis Framework
- **Expected Behavior Patterns**: Well-defined expectations for different scenarios
- **Anomaly Detection**: Systematic identification of unexpected behaviors
- **Protocol Invariant Validation**: Mathematical properties that must hold
- **Performance Benchmarking**: Baseline performance characteristics

## Random Configuration Testing Strategy

### Core Approach: Stress Test with Random Configurations

**Philosophy**: Generate many random test scenarios to discover edge cases and protocol failures through systematic exploration of the parameter space.

### Test Parameters
- **Agents**: 1-1000 agents per test
- **Beliefs**: 1-1000 beliefs per test
- **Initial Stake**: $10,000 per agent (to handle min stake thresholds)
- **Belief Duration**: 5-20 epochs each
- **Participation**: Random - agents sometimes participate, sometimes abstain

### Agent Behavior
**Simple Random Behavior**:
- Random belief values [0,1]
- Random meta-predictions [0,1]
- Random participation (50% chance per belief)
- Random stake allocation within available funds

### Minimal Logging Strategy

**Log Only Essential Events**:
1. **Belief Submissions**: Who submitted, belief value, meta-prediction
2. **Stake Allocations**: When scoring happens, how much stake allocated per belief
3. **Aggregate Changes**: Before/after aggregate values
4. **Stake Redistributions**: Who gained/lost stakes and amounts

**Analysis Focus**:
- Flag suspicious aggregate changes
- Track stake redistribution patterns over time
- Identify conservation violations
- Detect unexpected behavioral patterns

### Test Execution Strategy

**Configuration Generation**:
1. Randomly select agent count (1-1000)
2. Randomly select belief count (1-1000)
3. Create agents with $10k initial stake each
4. Generate beliefs with random 5-20 epoch durations
5. Run simulation until all beliefs expire

**Participation Model**:
- Each epoch, each agent has 50% chance to participate in each active belief
- If participating: random belief [0,1], random meta-prediction [0,1]
- Stake allocation: random portion of available funds

### LLM Analysis Requirements

**Input Data**: Minimal log of key events (submissions, stakes, redistributions)

**Analysis Tasks**:
1. **Sanity Checking**: Verify expected protocol behavior
2. **Anomaly Detection**: Flag suspicious changes to aggregates or stakes
3. **Conservation Validation**: Ensure zero-sum redistributions
4. **Pattern Recognition**: Identify concerning trends over time
5. **Edge Case Identification**: Highlight unusual scenarios

**Expected Reasoning**: LLM should reason about what *should* happen given the inputs and flag anything that seems "off" mathematically or behaviorally.

## Implementation Requirements

### Data Storage
- **Format**: Simple JSON log files
- **Structure**: Chronological events with timestamps
- **Retention**: Keep all test results for pattern analysis

### Execution
- **Parallelization**: Run multiple configurations concurrently
- **Termination**: Stop when all beliefs expire
- **Error Handling**: Log failures but continue testing other configurations

## Test Categories

### Small Scale (Validation)
- **Agents**: 1-10
- **Beliefs**: 1-5
- **Purpose**: Quick validation
- **Duration**: <5 minutes

### Medium Scale (Stress Testing)
- **Agents**: 10-100
- **Beliefs**: 5-50
- **Purpose**: Moderate load testing
- **Duration**: 5-30 minutes

### Large Scale (Edge Case Discovery)
- **Agents**: 100-1000
- **Beliefs**: 50-1000
- **Purpose**: Find scaling issues
- **Duration**: 30+ minutes

## Protocol Invariants to Validate

### Mathematical Constraints
1. **Stake Conservation**: Total stakes remain constant
2. **Probability Bounds**: All beliefs stay in [0,1]
3. **Zero-Sum Redistributions**: Gains equal losses
4. **Non-Negative Stakes**: No agent can have negative stakes

### Expected Behaviors
1. **Aggregation**: Weighted averages should be reasonable
2. **Learning Assessment**: Should trigger when entropy drops
3. **BTS Scoring**: Should reward better calibration
4. **Redistribution**: Should transfer stakes based on performance

### Suspicious Patterns
1. **Extreme Stake Concentrations**: One agent getting most stakes
2. **Rapid Aggregate Swings**: Beliefs changing dramatically without reason
3. **Conservation Violations**: Stakes appearing/disappearing
4. **Stuck Processing**: Epochs not advancing properly

## Success Metrics

### Test Coverage
- Generate 100+ random configurations
- Cover full parameter space (1-1000 agents/beliefs)
- Test various epoch durations and participation rates

### Issue Detection
- Catch mathematical errors (division by zero, etc.)
- Identify conservation violations
- Flag suspicious behavioral patterns
- Detect edge cases that break the protocol

### Analysis Quality
- LLM should accurately identify what's "normal" vs "abnormal"
- Provide actionable insights for protocol improvements
- Track patterns across multiple test runs

## Implementation Plan

### Phase 1: Basic Framework
1. Create random configuration generator
2. Implement minimal logging system
3. Build test execution engine
4. Generate small-scale test reports

### Phase 2: Scale Testing
1. Test medium and large configurations
2. Add parallel execution capability
3. Optimize for performance at scale
4. Validate against known edge cases

### Phase 3: Analysis Integration
1. Structure logs for LLM consumption
2. Create analysis prompt templates
3. Test anomaly detection capabilities
4. Iterate on reporting format

## Next Steps

1. **Implement Phase 1**: Start with basic random configuration testing
2. **Validate Approach**: Run small tests and verify log quality
3. **Scale Up**: Test larger configurations once basic framework works
4. **Integrate Analysis**: Add LLM reasoning capabilities