The Geometry of Belief: Understanding the L2-Norm ICBS

1. Motivation: Markets as Instruments of Understanding

In the traditional world of markets, prices reflect supply and demand. In the world of information, however, truth and relevance are harder to price. Prediction markets tried to bridge this gap by incentivizing people to bet on outcomes. But when there's no clear ground truth — when we’re dealing with subjective relevance, early signals, or contested meaning — the standard tools fail.

We need something better than a price-taking mechanism. We need a way to dynamically allocate attention, belief, and capital — while still rewarding those who were "early and right."

The Inversely Coupled Bonding Surface (ICBS) is a new type of bonding curve that does just that.

This explainer walks you through a specific, elegant form of ICBS based on the L2 norm — the same mathematical structure that underlies Euclidean geometry. We’ll see how it supports speculative discovery, preserves economic intuitions, and ultimately anchors its outputs in epistemic ground truth via settlement.

2. The Core Idea: A Coupled Market for Competing Beliefs

In traditional bonding curves (like Uniswap or LMSR), tokens move independently. You can buy one without affecting the other. This is fine for trading currencies or assets — but it’s inadequate when we want to model belief competition.

With ICBS, the two tokens — say, LONG and SHORT — are inversely coupled:

Buying LONG pushes its price up but pushes SHORT’s price down.

Buying SHORT does the opposite.

This creates a speculative battleground. Instead of passive liquidity, we now have active epistemic tension.

To implement this idea, we use a cost function that binds the two tokens together mathematically. In the L2 version, this function is strikingly simple — and geometrically beautiful.

3. The Math: Simplicity with Structure
   3.1 Cost Function

At the heart of the L2-norm ICBS is the cost function:

𝐶
(
𝑠
𝐿
,
𝑠
𝑆
)
=
𝜆
⋅
𝑠
𝐿
2

- 𝑠
  𝑆
  2
  C(s
  L
  ​

,s
S
​

)=λ⋅
s
L
2
​

+s
S
2
​

    ​

𝑠
𝐿
,
𝑠
𝑆
s
L
​

,s
S
​

: quantities of LONG and SHORT tokens

𝜆
λ: fixed scaling constant that defines the price unit of the market

This function measures the “distance” from the origin in the (s_L, s_S) plane. You can think of it like this:

If the market starts at (0, 0), buying tokens moves us outward along a radial line.

The cost is proportional to how far we move — measured by the Euclidean norm.

📐 Geometric Insight: Every point on a circle centered at the origin has the same cost. These are iso-cost curves.

3.2 Marginal Prices

Prices emerge as partial derivatives of the cost function. In other words, they are the slopes of the cost landscape in each direction.

𝑝
𝐿
=
∂
𝐶
∂
𝑠
𝐿
=
𝜆
⋅
𝑠
𝐿
𝑠
𝐿
2

- 𝑠
  𝑆
  2

𝑝
𝑆
=
∂
𝐶
∂
𝑠
𝑆
=
𝜆
⋅
𝑠
𝑆
𝑠
𝐿
2

- 𝑠
  𝑆
  2
  p
  L
  ​

p
S
​

    ​

=
∂s
L
​

∂C
​

=λ⋅
s
L
2
​

+s
S
2
​

    ​

s
L
​

    ​

=
∂s
S
​

∂C
​

=λ⋅
s
L
2
​

+s
S
2
​

    ​

s
S
​

    ​

    ​

Each token’s price increases with its own supply — but is suppressed by the opposing side.

This is inverse coupling in action.

🎯 Economic Interpretation: As more people back LONG, it gets more expensive — and SHORT becomes cheaper. This expresses the “strength” of one belief over another.

3.3 Virtual Reserves

We define virtual reserves as:

𝑟
𝐿
=
𝑠
𝐿
⋅
𝑝
𝐿
=
𝜆
⋅
𝑠
𝐿
2
𝑠
𝐿
2

- 𝑠
  𝑆
  2

𝑟
𝑆
=
𝑠
𝑆
⋅
𝑝
𝑆
=
𝜆
⋅
𝑠
𝑆
2
𝑠
𝐿
2

- 𝑠
  𝑆
  2
  r
  L
  ​

r
S
​

    ​

=s
L
​

⋅p
L
​

=λ⋅
s
L
2
​

+s
S
2
​

    ​

s
L
2
​

    ​

=s
S
​

⋅p
S
​

=λ⋅
s
L
2
​

+s
S
2
​

    ​

s
S
2
​

    ​

    ​

And the total value locked (TVL) in the market becomes:

𝑇
𝑉
𝐿
=
𝑟
𝐿

- 𝑟
  𝑆
  =
  𝜆
  ⋅
  𝑠
  𝐿
  2
- 𝑠
  𝑆
  2
  TVL=r
  L
  ​

  +r
  S
  ​

=λ⋅
s
L
2
​

+s
S
2
​

    ​

Which, beautifully, matches the cost function. This makes economic accounting simple and clean.

4. Properties and Implications
   4.1 Inverse Coupling

Let’s look at the cross-derivatives:

∂
𝑝
𝐿
∂
𝑠
𝑆
=
−
𝜆
⋅
𝑠
𝐿
𝑠
𝑆
(
𝑠
𝐿
2

- 𝑠
  𝑆
  2
  )
  3
  /
  2
  <
  0
  ∂s
  S
  ​

∂p
L
​

    ​

=−λ⋅
(s
L
2
​

+s
S
2
​

)
3/2
s
L
​

s
S
​

    ​

<0

This tells us that increasing supply of SHORT directly lowers the price of LONG — and vice versa.

Contrast this with LMSR or Uniswap, where each token’s price depends only on its own supply. ICBS binds them together.

4.2 Price Bounds and Scale

Prices range from 0 to λ.

As one token dominates, its price approaches λ, while the other approaches 0:

lim
⁡
𝑠
𝐿
→
∞
,
𝑠
𝑆
fixed
𝑝
𝐿
=
𝜆
s
L
​

→∞,s
S
​

fixed
lim
​

p
L
​

=λ

🧭 Interpretation: λ is the “price ceiling.” But since it’s defined by the initial deposit, it also sets the scale of belief intensity.

4.3 Fixed Unit of Account

Lambda (λ) is fixed at deployment, computed as:

# 𝜆

𝐷
𝑠
𝐿
2

- 𝑠
  𝑆
  2
  λ=
  s
  L
  2
  ​

  +s
  S
  2
  ​

      ​

D
​

This means:

You can grow the market without changing price dynamics.

Percentage-based price impact remains consistent over time.

Comparison between belief markets is meaningful.

4.4 Linear TVL Scaling
𝑇
𝑉
𝐿
=
𝜆
⋅
∣
∣
𝑠
∣
∣
2
TVL=λ⋅∣∣s∣∣
2
​

TVL grows linearly with the Euclidean norm of the supply vector. This gives smooth, predictable market depth.

4.5 Iso-Cost Geometry

Imagine the market as a 2D surface:

Circles around the origin = constant cost

Direction = price ratio

Distance = total value

This makes the market intuitively navigable. Traders are just exploring positions on a smooth geometric plane.

5. Comparison to Other Mechanisms
   Mechanism Inverse Coupling Price Bounds Curve Shape Math Cost Interpretation
   L2-ICBS ✅ Yes [0, λ] Circles (L2) √ only Relative belief strength
   General ICBS (F=3) ✅ Yes Higher Rounded square fractional exponents Similar, more aggressive dynamics
   LMSR ❌ No [0, 1] Softmax exp + log Probabilistic scoring
   Uniswap V2 ❌ No (0, ∞) Hyperbola multiplication only Price as exchange rate
6. Settlement: Anchoring Speculation in Truth

Markets are powerful for information aggregation, but they need resolution. Otherwise, they devolve into popularity contests or meme wars.

ICBS supports settlement anchoring via Veritas’ Belief Decomposition (BD) scores:

6.1 Epoch-Based Resolution

At the end of an epoch:

An external signal
𝑞
∗
∈
[
0
,
1
]
q
∗
∈[0,1] provides a relevance score.

Reserves are updated via a settlement function
𝑓
f, e.g.:

𝑟
𝐿
′
=
𝑟
𝐿
⋅
𝑓
(
𝑞
∗
)

𝑟
𝑆
′
=
𝑟
𝑆
⋅
𝑓
(
1
−
𝑞
∗
)
r
L
′
​

r
S
′
​

    ​

=r
L
​

⋅f(q
∗
)
=r
S
​

⋅f(1−q
∗
)
​

Virtualization absorbs the change without altering supply:

𝑠
𝑣
𝑖
𝑟
𝑡
𝑢
𝑎
𝑙
=
𝑠
𝑑
𝑖
𝑠
𝑝
𝑙
𝑎
𝑦
𝜎

𝑝
𝑑
𝑖
𝑠
𝑝
𝑙
𝑎
𝑦
=
𝑝
𝑣
𝑖
𝑟
𝑡
𝑢
𝑎
𝑙
𝜎
s
virtual
​

p
display
​

    ​

=
σ
s
display
​

    ​

=
σ
p
virtual
​

    ​

    ​

This preserves the invariant
𝑟
=
𝑠
⋅
𝑝
r=s⋅p, but allows the market to recalibrate around truth.

6.2 Virtualization Layer

The separation between virtual and displayed quantities means:

No minting/burning of tokens

Instant, clean reward redistribution

Settlement can occur without user intervention

🧠 Design Philosophy: Settlement is not an event. It’s a recalibration of belief weight.

6.3 Philosophical Impact

As Vitalik Buterin observed, bonding curves need grounding. Without external anchoring, markets reward only timing and hype — not insight.

Veritas’ ICBS, with settlement anchoring, creates a new dynamic:

Speculate early → Realize reward if you're right

Markets converge → Anchored to crowd-sourced relevance

This aligns incentives with epistemic value — turning speculation into structured discovery.

7. Conclusion: A New Primitive for Collective Epistemology

The L2-norm ICBS is not just a clever bonding curve. It’s a mechanism for turning belief into capital, and capital into signal.

It combines:

The smooth geometry of Euclidean cost

The tug-of-war dynamics of inverse coupling

The objectivity of external settlement

The flexibility of virtualized reserves

It’s fast, composable, intuitive, and grounded.

As a core primitive of Veritas, it forms the foundation for markets that don’t just predict outcomes — they evaluate meaning, allocate relevance, and reward truth.
