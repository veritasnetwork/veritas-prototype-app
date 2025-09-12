# Learning Assessment Implementation

**Endpoint:** `/protocol/beliefs/learning-assessment`

## Interface
**Input:**
- `belief_id`: string
- `post_mirror_descent_disagreement_entropy`: number

**Output:**
- `learning_occurred`: boolean
- `disagreement_entropy_reduction`: number
- `economic_learning_rate`: number

## Algorithm
1. **Load previous entropy:**
   - `belief = db.beliefs.get(belief_id)`
   - `previous_entropy = belief.previous_disagreement_entropy`

2. **Calculate entropy change:**
   - `entropy_reduction = previous_entropy - post_mirror_descent_disagreement_entropy`
   - `learning_occurred = entropy_reduction > 0`

3. **Calculate economic rate:**
   - If `previous_entropy == 0`: `economic_rate = 0`
   - Else: `economic_rate = max(0, entropy_reduction) / previous_entropy`

4. **Update database:**
   - Set `belief.previous_disagreement_entropy = post_mirror_descent_disagreement_entropy`
   - Save: `db.beliefs.update(belief_id, belief)`

5. **Return:** `{learning_occurred, disagreement_entropy_reduction: entropy_reduction, economic_learning_rate: economic_rate}`

## Database Updates
- **beliefs table:** UPDATE previous_disagreement_entropy

## Edge Cases
- Belief not found → 404 "Belief not found"
- First epoch (previous_entropy = 0) → economic_rate = 0, no learning