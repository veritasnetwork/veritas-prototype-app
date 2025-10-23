# Understanding the ICBS Market: A Technical Deep Dive

## Table of Contents

1. [Current Design vs. ICBS Design](#current-design-vs-icbs-design)
2. [How Original ICBS Works](#how-original-icbs-works)
3. [Adapting ICBS for Two-Sided Reserves](#adapting-icbs-for-two-sided-reserves)
4. [Reserve Reshuffling and Price Effects](#reserve-reshuffling-and-price-effects)
5. [Game Theory and Discovery Mechanics](#game-theory-and-discovery-mechanics)

---

## Current Design vs. ICBS Design

### Current System: Single-Sided Bonding Curve with Elastic-K

In our current implementation, each content pool has:

- **One SPL token** representing speculation on content quality
- **One reserve** holding USDC that backs the token
- **A cube root bonding curve** that determines price: `s(R) = cbrt(3R/k) × 100`
- **Elastic-k mechanism** where `k` scales proportionally with reserve changes

**Flow:**
1. Users buy tokens when they think content will gain relevance
2. Every epoch, the protocol measures relevance changes via BTS scoring
3. High-relevance pools receive USDC from low-relevance pools
4. The `k` parameter scales with reserve changes, affecting all holders proportionally
5. Token holders gain/lose value based on the reserve delta

**Key limitation:** This is effectively a **popularity contest**. There's no mechanism for users to explicitly bet against content or express negative predictions. The market can only move in one direction - buying tokens pushes price up. The only way to express skepticism is by not buying or by selling, but selling requires you to first own tokens.

**Cross-pool dependency:** Pools compete for relative share of total protocol value. Your pool's performance depends on how all other pools perform. This creates coordination overhead and requires global redistribution logic.

### ICBS Design: Two-Sided Prediction Market

In the ICBS design, each content pool has:

- **Two SPL tokens** (LONG and SHORT)
- **One unified reserve** split virtually between the two sides
- **Inversely coupled bonding surface** where buying one side makes the other cheaper
- **Settlement against absolute truth** (BTS score) rather than relative rankings

**Flow:**
1. Users buy LONG tokens if they predict high relevance, SHORT tokens if they predict low relevance
2. Trading activity organically encodes a market prediction `q` via the reserve ratio
3. Every epoch, settlement compares `q` to actual BTS score `x`
4. Reserves rebalance proportionally: LONG side scales by `x/q`, SHORT side scales by `(1-x)/(1-q)`
5. Token holders profit or lose based on prediction accuracy

**Key advantages:**
- **Two-sided expression:** Can explicitly bet for or against content
- **Self-contained pools:** Each pool settles independently against its own BTS score
- **Manipulation resistance:** Inverse coupling prevents pumping one side without cost
- **Local incentives:** No need to predict what other pools will do

---

## How Original ICBS Works

### The Core Mathematical Structure

The inversely coupled bonding surface uses a cost function:

```
C(s_L, s_S) = (s_L^(F/β) + s_S^(F/β))^β
```

Where:
- `s_L` = supply of LONG tokens
- `s_S` = supply of SHORT tokens
- `F` = exponent controlling growth rate (default: 3)
- `β` = coupling coefficient (default: 0.5)

**Marginal prices** are the partial derivatives:

```
p_L = ∂C/∂s_L = F × s_L^(F/β - 1) × (s_L^(F/β) + s_S^(F/β))^(β - 1)
p_S = ∂C/∂s_S = F × s_S^(F/β - 1) × (s_L^(F/β) + s_S^(F/β))^(β - 1)
```

**Critical observation:** The denominator `(s_L^(F/β) + s_S^(F/β))^(β - 1)` is shared. When `β < 1`, this term has a **negative exponent**, meaning:

- As `s_L` increases → denominator increases → `p_S` **decreases**
- As `s_S` increases → denominator increases → `p_L` **decreases**

This is **inverse coupling**. Buying LONG makes SHORT cheaper, and vice versa.

### Why Inverse Coupling Matters

Consider a pump attack:

1. Attacker buys 1000 LONG tokens to artificially inflate predicted relevance
2. This pushes `p_L` up (normal bonding curve behavior)
3. **But it also pushes `p_S` down** (inverse coupling)
4. Now SHORT tokens are cheap for arbitrageurs
5. If the attacker's prediction is wrong, arbitrageurs profit by buying SHORT
6. At settlement, SHORT holders gain value from LONG holders

The inverse coupling creates a **built-in correction mechanism**. You can't pump one side without creating arbitrage opportunities on the other side.

### Virtual Reserves and Market Prediction

The total reserve is split virtually:

```
R_L = p_L × s_L  (closed-form, not integral)
R_S = p_S × s_S  (closed-form, not integral)
```

**Important clarification:** While virtual reserves are conceptually defined as "the integral of marginal price from 0 to current supply," we **never compute integrals on-chain**. The simple multiplication `R_L = s_L × p_L` gives the **exact** result because the cost function is 1-homogeneous.

**Why the closed form equals the integral:**

In a 1-homogeneous system, marginal price is constant along any ray `(λs_L, λs_S)`. This means:

```
∫[0 to s_L] p_L(u, s_S) du = s_L × p_L(s_L, s_S)
```

This is NOT true for arbitrary bonding curves (like our current cube root curve), where you'd need to actually integrate to account for slippage. But in ICBS, the homogeneity property makes the simple product exact.

The **reserve ratio** automatically encodes market prediction:

```
q = R_L / (R_L + R_S)
```

This `q` value is the market's implied probability that the content is highly relevant.

**Why this works:**
- If traders believe content will score high (x ≈ 1), they buy LONG tokens
- This increases `s_L`, which increases `R_L`
- Therefore `q` increases toward 1
- Conversely, buying SHORT increases `R_S` and pushes `q` toward 0

The reserve ratio naturally aggregates all trading activity into a single prediction value.

### Homogeneity Property

The cost function has a special mathematical property called **homogeneity of degree 1**:

```
C(λ × s_L, λ × s_S) = λ × C(s_L, s_S)
```

**Euler's theorem** for homogeneous functions states that if `C` is 1-homogeneous, then:

```
s_L × (∂C/∂s_L) + s_S × (∂C/∂s_S) = C
```

Since we define:
- `R_L = s_L × p_L = s_L × (∂C/∂s_L)`
- `R_S = s_S × p_S = s_S × (∂C/∂s_S)`

We get:
```
R_L + R_S = C = total reserve
```

**This is exact, not approximate.** The virtual reserves always sum to the actual USDC in the pool. This is a mathematical identity that holds due to homogeneity.

**Computational implication:** On-chain, we calculate `R_L` and `R_S` using simple multiplication `s × p`, not by computing integrals. The homogeneity property guarantees this closed-form calculation is identical to integrating the marginal price curve.

---

## Adapting ICBS for Two-Sided Reserves

### The Challenge: Representing Uncertainty vs. Directional Bets

The original ICBS paper assumes a binary prediction market for events with ground truth (e.g., "Will it rain tomorrow?"). Veritas poses a different challenge:

**Content relevance is not binary.**

A post might score:
- `x = 0.9` (highly relevant)
- `x = 0.5` (neutral)
- `x = 0.1` (low relevance)

We need the market to encode continuous predictions across this spectrum, not just "yes/no."

### The Adaptation: Reinterpreting LONG and SHORT

In our adaptation:

- **LONG tokens** represent a bet that content relevance will be **higher than current market prediction**
- **SHORT tokens** represent a bet that content relevance will be **lower than current market prediction**

The reserve ratio `q = R_L / (R_L + R_S)` represents:
- The market's predicted relevance score (continuous from 0 to 1)
- The uncovered probability that content will score high

**Example scenario:**

1. Post is created, no trades yet → `q = 0.5` (neutral)
2. Early users find it compelling → buy LONG → `q = 0.75`
3. Later skeptics notice quality issues → buy SHORT → `q = 0.60`
4. Final market prediction: `q = 0.60` (60% confidence in relevance)

At settlement:
- If BTS score `x = 0.80` → LONG holders were correct (predicted 0.60, actual 0.80)
- If BTS score `x = 0.40` → SHORT holders were correct (predicted 0.60, actual 0.40)

### Virtual Reserve Dynamics

Unlike traditional prediction markets where reserves are literal USDC allocations, our virtual reserves are **accounting constructs**:

```
R_L = ∫[0 to s_L] p_L(s', s_S) ds'
R_S = ∫[0 to s_S] p_S(s_L, s'') ds''
```

These integrals represent the cumulative cost to mint current supplies at current prices.

**Key insight:** Virtual reserves don't represent actual token ownership claims. Instead, they represent the **weighted voting power** of each side in determining the market prediction `q`.

When you buy LONG tokens:
- You pay USDC that goes into the single reserve
- Your purchase increases `R_L` (your side's virtual weight)
- This shifts `q` upward
- All existing tokens on both sides experience price changes

The total reserve `R_tot = R_L + R_S` is real USDC. The split `R_L` vs `R_S` is virtual accounting.

### Why Two Sides Instead of One?

You might ask: why not just have one token where price going up = bullish and price going down = bearish?

**Answer:** Price can only go up with buys. You need existing holders to sell for price to drop. This creates:

1. **Liquidity asymmetry:** Hard to express bearish views without existing holders
2. **No neutral baseline:** What's the "starting price"? Any choice is arbitrary
3. **Path dependence:** Early buyers set the reference point for everyone else

Two-sided markets solve this by providing:

1. **Symmetric expression:** Bullish and bearish views have equal accessibility
2. **Natural baseline:** `q = 0.5` when `s_L = s_S` (starting neutral)
3. **Price discovery from zero:** No need to seed liquidity or set initial price
4. **Continuous correction:** Arbitrage works in both directions simultaneously

---

## Reserve Reshuffling and Price Effects

### Settlement Mechanism

Every epoch, settlement occurs in three steps:

**1. Read market prediction from reserve ratio:**

```
q = R_L / (R_L + R_S)
```

This is the market's implied probability before settlement.

**2. Receive BTS relevance score:**

```
x ∈ [0, 1]
```

This is the validated ground truth.

**3. Calculate settlement factors:**

```
f_L = x / q       (LONG factor)
f_S = (1-x) / (1-q) (SHORT factor)
```

These factors represent how much each side was correct.

**Example:**
- Market predicted `q = 0.60`
- Actual score was `x = 0.80`
- LONG factor: `f_L = 0.80 / 0.60 = 1.33` (33% gain)
- SHORT factor: `f_S = 0.20 / 0.40 = 0.50` (50% loss)

### Reserve Rebalancing

Reserves scale by settlement factors:

```
R_L' = R_L × f_L = R_L × (x / q)
R_S' = R_S × f_S = R_S × ((1-x) / (1-q))
```

**Proof that total reserve is preserved:**

```
R_L' + R_S'
= R_L × (x/q) + R_S × ((1-x)/(1-q))
= (R_L/q) × x + (R_S/(1-q)) × (1-x)

Since R_L = q × R_tot and R_S = (1-q) × R_tot:
= (R_tot) × x + (R_tot) × (1-x)
= R_tot × (x + 1 - x)
= R_tot
```

The total USDC in the pool stays constant. The reserves just get reassigned between the two sides based on accuracy.

### How Prices Adjust After Settlement

Raw token supplies `s_L` and `s_S` **do not change** during settlement. Your wallet still shows the same number of tokens.

But virtual reserves change, which **automatically scales the marginal price**:

```
Before settlement:
- R_L = 10 USDC
- s_L = 100 tokens
- p_L = R_L / s_L = $0.10 per token

After settlement (f_L = 1.5):
- R_L' = R_L × f_L = 15 USDC
- s_L = 100 tokens (unchanged)
- p_L' = R_L' / s_L = $0.15 per token
```

**The marginal price scales by the settlement factor!** This is how winners gain value and losers lose value.

**Why this works:** The cost function is homogeneous of degree 1, which means:

```
R_L = s_L × p_L (always true)

If R_L scales by f_L and s_L stays constant:
R_L' = s_L × p_L'
R_L × f_L = s_L × p_L'
p_L' = p_L × f_L ✓
```

**No additional adjustments needed.** The bonding curve naturally reflects the new value because the homogeneity property guarantees that the integral of marginal price equals the reserve.

### Effect on Existing Holders

Consider an example with actual numbers:

**Pre-settlement:**
- Alice holds 100 LONG tokens
- Bob holds 100 SHORT tokens
- Pool: `R_L = 10 USDC`, `R_S = 10 USDC`, `q = 0.5`
- Value per token: LONG = $0.10, SHORT = $0.10

**Settlement with `x = 0.75`:**
- Factors: `f_L = 0.75/0.5 = 1.5`, `f_S = 0.25/0.5 = 0.5`
- New reserves: `R_L' = 15 USDC`, `R_S' = 5 USDC`

**Post-settlement:**
- Alice: Still holds 100 raw LONG tokens, but value per token = 15/100 = $0.15
- Bob: Still holds 100 raw SHORT tokens, but value per token = 5/100 = $0.05
- Alice gained 50% value (from $0.10/token to $0.15/token)
- Bob lost 50% value (from $0.10/token to $0.05/token)

**Exiting via `sell`:**
- Alice sells all 100 tokens back to curve → receives 15 USDC (exactly R_L')
- Bob sells all 100 tokens back to curve → receives 5 USDC (exactly R_S')
- Total: 20 USDC (preserved)

Due to homogeneity, selling all tokens along the bonding curve extracts exactly the virtual reserve. No orphaned liquidity.

The settlement redistributed value from incorrect predictions (SHORT) to correct predictions (LONG) without moving any tokens or requiring any user action.

### UI Display Considerations

**Critical:** Raw token balances never change on-chain. UIs should display:

```
✅ CORRECT:
100 LONG tokens @ $0.15 each
Total Value: $15.00

❌ WRONG:
150 LONG tokens @ $0.10 each
Total Value: $15.00
```

**Reasoning:**
- Token balances in wallets and explorers show raw amounts (100 tokens)
- Showing different amounts in your UI creates confusion
- "Token value changed" is more intuitive than "token count changed"
- Matches how traditional assets work (price changes, not quantity changes)

### Price Impact on Marginal Trading

After settlement, marginal prices scale directly with the settlement factor:

```
Before settlement:
p_L = R_L / s_L = $0.10

After settlement (f_L = 1.5):
p_L' = R_L' / s_L = (R_L × 1.5) / s_L = $0.15

The marginal price increased by 50%!
```

**For the next marginal buy:**
- Buying the 101st LONG token now costs 50% more than it would have pre-settlement
- The winning side became more expensive to buy into
- The losing side became cheaper (SHORT prices scaled down by f_S < 1)

**Intuition:** Settlement validates market predictions and adjusts prices accordingly:
- Correct predictions → more expensive (winners cashing out creates scarcity)
- Incorrect predictions → cheaper (losers exiting creates opportunity)

The price surface tilts to reflect the validated information, with the new reserve ratio `q'` matching the BTS score `x`.

---

## Game Theory and Discovery Mechanics

### Implied Relevance Score

The reserve ratio `q` is not just an accounting artifact. It's the market's **consensus forecast** of the BTS score `x`.

To see why, consider a rational trader deciding whether to buy LONG:

**Expected utility of buying 1 LONG token:**

```
EU = E[value after settlement] - cost
   = E[p_L × f_L] - p_L
   = E[p_L × (x/q)] - p_L
   = p_L × (E[x]/q - 1)
```

If `E[x] > q`, then `EU > 0` → rational trader buys LONG.
If `E[x] < q`, then `EU < 0` → rational trader buys SHORT (or sells LONG if they hold it).

**Nash equilibrium occurs when:**

```
E[x] = q
```

At this point, no trader can profitably deviate. The reserve ratio perfectly encodes the aggregated belief about expected relevance.

### Proper Scoring Rule: Ratio-Based Settlement

The settlement mechanism implements a **ratio-based proper scoring rule** (not Brier or logarithmic).

**Settlement factors:**
```
f_L = x / q
f_S = (1-x) / (1-q)
```

These are simple multiplicative ratios, not quadratic or logarithmic functions.

**Why this is a proper scoring rule:**

For a marginal LONG trade, the expected profit is:
```
E[profit] = p_L × (E[x]/q - 1)
```

This is zero when `q = E[x]` and negative otherwise. Therefore, traders maximize expected profit by pushing `q` to their true belief `E[x]`.

**Key properties:**
- **Strictly proper:** Truth-telling maximizes expected value
- **Linear in ratio:** Payoffs scale with `x/q`, not `(x-q)²` (Brier) or `log(x/q)` (logarithmic)
- **Simple on-chain:** Just multiplication and division, no logs or exponents

**This creates incentive alignment:** You maximize profit by revealing your true belief about `x`, not by manipulating `q` for short-term gain.

### Comparison to Other Proper Scoring Rules

Our ratio-based rule sits between standard scoring rules in terms of mathematical properties:

| Scoring Rule | Settlement Factor | Expected Gain | Information Property | Gas Cost |
|-------------|------------------|---------------|---------------------|----------|
| **Ratio-based (ours)** | `f = x/q` | Linear in `x/q - 1` | Fractional error | ✅ Low (multiply) |
| **Brier (quadratic)** | `f = 1 + (x-q) - (x-q)²/2` | Minimizes MSE | Mean squared error | ✅ Low (squares) |
| **Logarithmic (LMSR)** | `f = exp(ln(x/q))` | Maximizes log wealth | KL divergence | ❌ High (logs, exp) |

**Why not logarithmic scoring?**
While logarithmic scoring has the elegant property that expected surplus equals information gain (KL divergence), it requires:
- 256-bit precision for logs and exponentials on-chain
- More complex implementation and higher gas costs
- Unbounded potential losses

**Why not Brier scoring?**
Brier is simple but creates quadratic payoffs that may not match trader intuition about linear returns on prediction accuracy.

**Our choice: Ratio-based**
The ratio-based rule `f = x/q` provides:
1. **Intuitive payoffs:** Linear in prediction accuracy
2. **Gas efficiency:** Just multiplication and division
3. **Strict properness:** Incentivizes truthful reporting

While it doesn't have the direct information-theoretic interpretation of LMSR, it achieves the core goal: the market price `q` becomes an unbiased aggregator of trader beliefs about `x`.

### Arbitraging Reality

Consider three types of traders:

**1. Informed traders (discoverers):**
- Have early signal that content quality is high
- See `q = 0.3` (market undervaluing)
- Know `E[x] ≈ 0.7`
- Buy LONG tokens, pushing `q` upward
- Profit at settlement when `x ≈ 0.7` validates their signal

**2. Noise traders (speculators):**
- Trade based on momentum, social signals, or misunderstanding
- Might buy LONG after `q = 0.7` because "number go up"
- If content actually scores `x = 0.5`, they lose to SHORT holders
- Their losses pay informed traders

**3. Arbitrageurs (correctors):**
- Monitor for mispricing
- If `q` deviates too far from their estimate of `E[x]`, they trade to correct
- Provide liquidity and stabilize prices

**Key dynamic:** Informed traders profit by moving `q` toward truth early. Noise traders provide liquidity but pay for incorrect guesses. Arbitrageurs ensure `q` doesn't deviate too far from consensus.

This is similar to traditional prediction markets, but with continuous settlement against a continuous relevance scale rather than binary events.

### How Coupling Enables Discovery

Without inverse coupling (i.e., with two independent pools), manipulation is easy:

1. Attacker buys 10,000 LONG tokens with intent to pump
2. LONG price goes up
3. No immediate counterforce
4. Attacker exits before settlement

With inverse coupling:

1. Attacker buys 10,000 LONG tokens
2. LONG price goes up
3. **SHORT price goes down** (inverse coupling)
4. Arbitrageurs notice cheap SHORT
5. If content quality doesn't support high `q`, arbitrageurs buy SHORT
6. Buying SHORT pushes `q` back down
7. Attacker is now underwater on LONG position

The inverse coupling creates a **self-balancing mechanism**. Every pump action creates a discounted counteraction. The market naturally resists manipulation.

### Real-Time Discovery Process

Here's a realistic scenario:

**T=0 (Post created):**
- Pool initializes with `s_L = s_S = 0`, `q = 0.5` (neutral)
- No trading yet

**T=1 hour (Early discovery):**
- Alice reads post, finds it insightful
- Alice buys 50 LONG → `q = 0.65`
- Price signals to others: "someone thinks this is good"

**T=2 hours (Broader attention):**
- Bob sees high `q`, reads post, agrees
- Bob buys 30 LONG → `q = 0.72`
- Carol sees high `q`, reads post, skeptical of claims
- Carol buys 40 SHORT → `q = 0.68`

**T=3 hours (Momentum vs. Correction):**
- Dave sees rising activity, FOMOs in
- Dave buys 100 LONG → `q = 0.78`
- Eve (informed expert) knows content has factual errors
- Eve buys 150 SHORT → `q = 0.60`

**T=epoch end:**
- Final market prediction: `q = 0.60`
- BTS validation runs
- Actual relevance: `x = 0.55`
- Settlement: SHORT holders (Carol, Eve) gain slightly
- LONG holders (Alice, Bob, Dave) lose slightly

**Key observations:**
1. Early discoverer (Alice) still profits if she sells before Dave pumps
2. Late speculator (Dave) loses because he ignored correction signals
3. Expert corrector (Eve) profits from superior information
4. Market prediction `q = 0.60` was close to truth `x = 0.55`

The continuous adjustment of `q` through trading aggregates distributed information. The inverse coupling ensures that both bullish and bearish information can be expressed and priced in.

### Long-Term Incentive Structure

Over many epochs, traders learn:

**Profitable strategies:**
- Find undervalued content early → buy LONG
- Find overvalued content early → buy SHORT
- Trade based on actual quality signals, not hype
- Hold positions through settlement if confident

**Unprofitable strategies:**
- Chasing momentum without analysis
- Pumping without substance
- Ignoring SHORT side price signals
- Manipulating via wash trading (inverse coupling makes this expensive)

The market rewards **information discovery** and punishes **noise**. This is exactly what we want for content curation: surface the best content via economic incentives that align with actual quality.

### Coupling to Reality

The final piece is how BTS scoring "couples" the market to reality:

**Without BTS settlement:**
- `q` is just a popularity contest
- No ground truth to validate against
- Markets can drift arbitrarily based on social dynamics

**With BTS settlement:**
- `q` must predict actual relevance `x`
- Traders know settlement is coming
- Can't just hype indefinitely
- Must actually evaluate quality

The BTS mechanism (Bayesian Truth Serum) extracts relevance from user ratings by comparing individual responses to population distributions. It's designed to be manipulation-resistant.

**The coupling works like this:**

```
Trading activity → q (market prediction)
User ratings → x (BTS validation)
Settlement: q vs x → redistribution
```

This creates a feedback loop:
1. Markets predict relevance
2. Users rate content
3. BTS validates predictions
4. Traders adjust beliefs
5. Better predictions next round

Over time, the market learns to predict what users will actually find relevant, not what's merely popular or hyped.

### Why This Enables Discovery

**Discovery requires:**
1. **Incentive to find early:** Bonding curve rewards early buyers
2. **Ability to signal:** Buying LONG increases `q` (price signal to others)
3. **Cost to noise:** Incorrect predictions lose value at settlement
4. **Correction mechanism:** SHORT side can challenge overvaluation
5. **Truth anchor:** BTS settlement ties `q` to actual quality

**All five conditions are met:**

1. ✅ Bonding curve: early LONG buyers pay low price, later buyers pay higher price
2. ✅ Reserve ratio: `q` is public, everyone can see market sentiment
3. ✅ Settlement: losses from `|q - x|` error penalize noise traders
4. ✅ Inverse coupling: SHORT tokens let skeptics profitably challenge
5. ✅ BTS validation: relevance isn't just popularity, it's validated quality

The result is a **discovery engine**: economic incentives guide attention toward genuinely relevant content, penalize hype without substance, and reward early identification of quality.

---

## Summary

### What Changes from Current Design

**Current (single-sided bonding curve):**
- One token per pool
- Elastic-k scales token value with reserve
- Relative competition between pools
- Limited expression (only buy or sell)

**ICBS (two-sided bonding surface):**
- Two tokens per pool (LONG/SHORT)
- Reserve rebalancing scales prices naturally
- Independent settlement per pool
- Full expression (bullish or bearish)
- Token counts stay fixed, prices/values scale

### Core Insight

The ICBS market is fundamentally a **continuous prediction market** where:

- The reserve ratio `q` encodes market consensus
- Inverse coupling provides manipulation resistance
- Settlement against BTS creates truth anchor
- Homogeneity property ensures full liquidation is always possible
- Proper scoring rule incentives reveal true beliefs

### Why It Works

**Game-theoretically:**
- Rational traders push `q → E[x]` to maximize profit
- Inverse coupling makes manipulation unprofitable
- Settlement rewards accuracy, punishes error
- Information aggregates through price discovery

**Economically:**
- Early discoverers profit from undervaluation
- Correctors profit from challenging overvaluation
- Noise traders provide liquidity but lose over time
- Value flows from incorrect to correct predictions

**Technically:**
- Homogeneity preserves reserve invariants (R_L = s_L × p_L always)
- Virtual reserves sum exactly to total USDC (R_L + R_S = R_tot)
- Token balances stay constant on-chain (s_L unchanged)
- Prices scale naturally with reserves (p_new = p_old × f)
- Fixed-point math avoids floating-point errors

The design creates a **real-time discovery mechanism** where distributed traders collectively evaluate content quality, express their beliefs through trading, and get rewarded based on accuracy. The coupling to BTS validation ensures the market tracks actual relevance, not just hype.
