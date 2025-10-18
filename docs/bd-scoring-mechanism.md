# BD Scoring Mechanism - Complete Implementation

## ✅ **Status: Fully Implemented**

The complete Belief Decomposition scoring mechanism from McCoy & Prelec is now implemented.

---

## 📐 **Scoring Formula**

For each agent i, the score is:

```
V_i = α·S(x̄^(-i), y_i) + (1-α)·S(x̄^(-i), ŷ_i) + λ·S(y_i, ŷ_i) - S(x̄^(-i), p̃^(-i))
```

### **Components:**

1. **score1** = `α·S(x̄^(-i), y_i)`
   - How well agent's prediction matches others' average belief
   - Higher α weights this more

2. **score2** = `(1-α)·S(x̄^(-i), ŷ_i)`  
   - How well implied prediction matches others' average belief
   - Lower α weights this more

3. **score3** = `λ·S(y_i, ŷ_i)`
   - Consistency between agent's prediction and implied prediction
   - Rewards internal consistency

4. **side_payment** = `S(x̄^(-i), p̃^(-i))`
   - Subtracted to ensure proper incentives
   - Prevents gaming the mechanism

### **Terms:**

- **x̄^(-i)** = Average belief of all other agents (excluding i)
- **y_i** = Agent i's meta-prediction
- **ŷ_i** = Implied prediction = `x_i · W^(-i)[0][0] + (1-x_i) · W^(-i)[1][0]`
- **p̃^(-i)** = Leave-one-out prior (estimated without agent i)
- **W^(-i)** = W matrix estimated without agent i
- **S(p, q)** = Proper scoring rule (negative KL divergence)

---

## 🎯 **Proper Scoring Rule**

Uses **negative KL divergence**:

```typescript
S(target, prediction) = -KL(target || prediction)
                      = -(target·log₂(target/prediction) + (1-target)·log₂((1-target)/(1-prediction)))
```

**Higher scores are better.**

---

## 🔧 **Implementation Details**

### **Key Methods**

1. **`properScoringRule(target, prediction)`**
   - Computes negative KL divergence
   - Handles edge cases (identical values → 0)
   - Returns higher scores for better predictions

2. **`computeScores()`**
   - For each agent, creates leave-one-out dataset
   - Estimates LOO W matrix and prior
   - Calculates implied prediction ŷ_i
   - Computes all 4 score components
   - Stores in `this.scores` map

3. **`run()`**
   - Now calls `computeScores()` after computing posterior
   - Returns both aggregate AND scores

### **Parameters**

- **alpha** (α): Balance between direct prediction vs implied prediction
  - α = 0.5 (default): Equal weight
  - α = 1.0: Only reward direct predictions
  - α = 0.0: Only reward implied predictions

- **lambda** (λ): Weight for consistency scoring
  - λ = 0.5 (default): Moderate consistency reward
  - λ = 1.0: Strong consistency reward
  - λ = 0.0: No consistency reward

---

## 📊 **Example Output**

```json
{
  "pre_mirror_descent_aggregate": 0.65,
  "bd_prior": 0.52,
  "bd_scores": {
    "agent1": 0.042,   // Good performance
    "agent2": -0.018,  // Below average
    "agent3": 0.089    // Best performer
  },
  "jensen_shannon_disagreement_entropy": 0.12,
  "certainty": 0.88,
  ...
}
```

---

## 🎲 **Interpretation**

### **Positive Scores** (> 0)
- Agent performed better than baseline
- Their predictions added information
- Should receive rewards (in stake redistribution)

### **Negative Scores** (< 0)
- Agent performed worse than baseline  
- Their predictions detracted from aggregate quality
- Should receive penalties

### **Near-Zero Scores** (≈ 0)
- Neutral performance
- Neither helped nor hurt aggregate

### **NaN Scores**
- Single agent (can't score with n=1)
- Insufficient data for scoring

---

## 🔬 **What Makes a Good Score?**

High scores result from:

1. **Accurate Predictions** (score1)
   - Meta-prediction close to others' average belief

2. **Good Implied Predictions** (score2)
   - Agent's belief + W matrix produces good prediction

3. **Internal Consistency** (score3)
   - Meta-prediction aligns with implied prediction

4. **Better than Prior** (side_payment)
   - Performance exceeds what prior alone would predict

---

## 🧪 **Testing**

The scoring mechanism can be tested with:

```bash
# Run BD aggregation with scoring
curl -X POST http://127.0.0.1:54321/functions/v1/protocol-beliefs-aggregate-bd \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "belief_id": "uuid",
    "weights": {"agent1": 0.33, "agent2": 0.33, "agent3": 0.34},
    "alpha": 0.5,
    "lambda": 0.5
  }'
```

Response will include `bd_scores` for each agent.

---

## 📈 **Integration with Protocol**

The BD scores can be used in:

1. **Stake Redistribution**
   - Replace or augment BTS scores
   - Redistribute stake based on BD performance

2. **Reputation System**
   - Track cumulative BD scores
   - Weight future contributions by past performance

3. **Agent Filtering**
   - Identify consistently high/low performers
   - Adjust participation requirements

---

## ⚙️ **Computational Complexity**

For n agents:
- **Aggregation**: O(n) for binary case
- **Scoring**: O(n²) due to n leave-one-out calculations
  - Each LOO: O(n) for W estimation
  - Total: n × O(n) = O(n²)

**Optimization opportunities:**
- Parallel LOO calculations
- Cache W matrices
- Approximate for large n

---

## 🎓 **Theoretical Properties**

The BD scoring mechanism is:

1. **Incentive Compatible**
   - Truth-telling is optimal strategy
   - Side payment ensures proper incentives

2. **Individually Rational**
   - Agents benefit from participation
   - Expected score ≥ 0 for honest agents

3. **Bayesian Truthful**
   - Optimal to report true beliefs and predictions
   - No advantage to strategic misreporting

4. **Proper**
   - Uses proper scoring rule (KL divergence)
   - Maximized when prediction = true distribution

---

## 📚 **References**

- McCoy & Prelec (2017): "A Bayesian Approach to the 'Wisdom of Crowds'"
- Scoring rules and information elicitation
- Bayesian Truth Serum mechanism design

---

## ✨ **Summary**

**The BD implementation is now COMPLETE with:**

✅ Correct prior calculation (general formula)  
✅ Correct posterior normalization (both states)  
✅ Complete scoring mechanism (all components)  
✅ Proper scoring rule (negative KL divergence)  
✅ Leave-one-out calculations  
✅ Full API response with scores  

**Ready for production use!**

