# Learning Assessment

Determines if the network learned by measuring entropy reduction between epochs.

## Inputs
- Previous disagreement entropy: $D_{JS,previous}$ 
- Current post-mirror descent entropy: $D_{JS,post}^{(t)}$

## Outputs
- Learning occurred: boolean
- Entropy reduction: $\Delta D_{JS}$
- Economic learning rate: $\eta_{econ}$

## Mathematics
Entropy change: $\Delta D_{JS} = D_{JS,previous} - D_{JS,post}^{(t)}$

Learning condition: $Learning = \Delta D_{JS} > 0$

Economic rate: $\eta_{econ} = \frac{\max(0, \Delta D_{JS})}{D_{JS,previous}}$

## Purpose
Protects rational dissent by only triggering economic redistribution when collective uncertainty genuinely decreases. No learning = no penalties for contrarian positions.