/**
 * UnifiedSwapComponent
 * Compact trading interface with buy/sell toggle
 * Refactored to use ICBS (Inversely Coupled Bonding Surface) pricing
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowDownUp, AlertCircle, ChevronDown, Wallet } from 'lucide-react';
import { Connection } from '@solana/web3.js';
import { useBuyTokens } from '@/hooks/useBuyTokens';
import { useSellTokens } from '@/hooks/useSellTokens';
import { useSwapBalances } from '@/hooks/useSwapBalances';
import { useFundWallet } from '@privy-io/react-auth/solana';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { FundingPromptModal } from '@/components/wallet/FundingPromptModal';
import { FundWalletButton } from '@/components/wallet/FundWalletButton';
import { TradeCompletedModal } from '@/components/trading/TradeCompletedModal';
import { ExcessiveSkimModal } from '@/components/trading/ExcessiveSkimModal';
import { getRpcEndpoint } from '@/lib/solana/network-config';
import { usdcToMicro, displayToAtomic, asDisplay, DisplayUnits, AtomicUnits, MicroUSDC } from '@/lib/units';
import {
  estimateTokensOut,
  estimateUsdcOut,
  TokenSide as ICBSTokenSide,
  calculateICBSPrice
} from '@/lib/solana/icbs-pricing';
import { cn } from '@/lib/utils';

interface UnifiedSwapComponentProps {
  poolAddress: string;
  postId: string;
  priceLong: number;        // Current LONG price from on-chain
  priceShort: number;       // Current SHORT price from on-chain
  supplyLong: number;       // LONG supply (atomic units)
  supplyShort: number;      // SHORT supply (atomic units)
  f: number;                // ICBS parameter (default 2)
  betaNum: number;          // ICBS parameter (default 1)
  betaDen: number;          // ICBS parameter (default 2)
  selectedSide?: TokenSide; // Controlled side state (optional)
  onSideChange?: (side: TokenSide) => void; // Callback when side changes
  onTradeSuccess?: () => void; // Callback to refresh data after successful trade
}

type SwapMode = 'buy' | 'sell';
type TokenSide = 'LONG' | 'SHORT';

export function UnifiedSwapComponent({
  poolAddress,
  postId,
  priceLong,
  priceShort,
  supplyLong,
  supplyShort,
  f,
  betaNum,
  betaDen,
  selectedSide,
  onSideChange,
  onTradeSuccess
}: UnifiedSwapComponentProps) {
  // State - use controlled side if provided, otherwise use internal state
  const [mode, setMode] = useState<SwapMode>('buy');
  const [internalSide, setInternalSide] = useState<TokenSide>('LONG');

  // Determine which side state to use
  const side = selectedSide !== undefined ? selectedSide : internalSide;
  const setSide = (newSide: TokenSide) => {
    if (onSideChange) {
      onSideChange(newSide); // Use controlled state
    } else {
      setInternalSide(newSide); // Use internal state
    }
  };
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [outputAmountRaw, setOutputAmountRaw] = useState<number>(0); // Store raw value for rotation
  const [slippage, setSlippage] = useState('0.5'); // 0.5% default
  const [showPreview, setShowPreview] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [showFundingPrompt, setShowFundingPrompt] = useState(false);
  const [fundingType, setFundingType] = useState<'SOL' | 'USDC' | 'BOTH'>('USDC');
  const [solBalance, setSolBalance] = useState<number>(0);
  const [completedTrade, setCompletedTrade] = useState<any>(null);
  const [excessiveSkimData, setExcessiveSkimData] = useState<any>(null);

  // Belief submission state
  const [initialBelief, setInitialBelief] = useState<number>(0.5);
  const [metaBelief, setMetaBelief] = useState<number>(0.5);

  // Hooks
  const { usdcBalance, longBalance, shortBalance, loading: balancesLoading, refresh: refreshBalances } = useSwapBalances(poolAddress, postId);
  const { fundWallet } = useFundWallet();
  const { address, wallet } = useSolanaWallet();
  const { getAccessToken } = usePrivy();

  // Create wrapped callback that refreshes balances after trade
  const handleTradeSuccess = () => {
    setTradeError(null); // Clear any previous errors
    refreshBalances();

    if (onTradeSuccess) {
      try {
        onTradeSuccess();
      } catch (error) {
        console.error('[UnifiedSwap] Error calling parent callback:', error);
      }
    }
  };

  const { buyTokens, isLoading: buyLoading, error: buyError } = useBuyTokens();
  const { sellTokens, isLoading: sellLoading, error: sellError } = useSellTokens();
  const { requireAuth } = useRequireAuth();

  // Get the relevant balance based on mode and side
  const currentBalance = mode === 'buy'
    ? usdcBalance
    : (side === 'LONG' ? longBalance : shortBalance);

  // Calculate values based on input amount
  useEffect(() => {
    if (!inputAmount) {
      setOutputAmount('');
      return;
    }

    const input = parseFloat(inputAmount);
    if (input <= 0) {
      setOutputAmount('');
      return;
    }


    try {
      // Map UI side to ICBS TokenSide
      const icbsSide = side === 'LONG' ? ICBSTokenSide.Long : ICBSTokenSide.Short;

      // Determine current and other supply based on selected side
      const currentSupply = side === 'LONG' ? supplyLong : supplyShort;
      const otherSupply = side === 'LONG' ? supplyShort : supplyLong;

      // Calculate lambda from current price and supply
      // For ICBS F=1, β=0.5: p = λ × s / ||s||, so λ = p × ||s|| / s
      const norm = Math.sqrt(supplyLong * supplyLong + supplyShort * supplyShort);
      const currentPrice = side === 'LONG' ? priceLong : priceShort;
      const currentSupplyForLambda = side === 'LONG' ? supplyLong : supplyShort;
      const lambdaScale = currentSupplyForLambda > 0
        ? (currentPrice * norm) / currentSupplyForLambda
        : 1.0;


      if (mode === 'buy') {
        // Calculate tokens received for USDC input
        const tokensOut = estimateTokensOut(
          currentSupply,
          otherSupply,
          input,
          icbsSide,
          lambdaScale,
          f,
          betaNum,
          betaDen
        );


        setOutputAmountRaw(tokensOut);
        setOutputAmount(tokensOut.toFixed(2));
      } else {
        // Calculate USDC received for token input
        const usdcOut = estimateUsdcOut(
          currentSupply,
          otherSupply,
          input,
          icbsSide,
          lambdaScale,
          f,
          betaNum,
          betaDen
        );


        setOutputAmountRaw(usdcOut);
        setOutputAmount(usdcOut.toFixed(2));
      }
    } catch (error) {
      console.error('Error calculating amounts:', error);
    }
  }, [inputAmount, mode, side, supplyLong, supplyShort, priceLong, priceShort, f, betaNum, betaDen]);

  // Handle input field change
  const handleInputChange = (value: string) => {
    setInputAmount(value);
  };

  // Calculate price impact
  const priceImpact = useMemo(() => {
    const input = parseFloat(inputAmount);
    const output = parseFloat(outputAmount);

    if (!input || !output || input <= 0 || output <= 0) return 0;

    // Get current price based on side
    const currentPrice = side === 'LONG' ? priceLong : priceShort;

    // Map UI side to ICBS TokenSide
    const icbsSide = side === 'LONG' ? ICBSTokenSide.Long : ICBSTokenSide.Short;

    // Determine current and other supply
    const currentSupply = side === 'LONG' ? supplyLong : supplyShort;
    const otherSupply = side === 'LONG' ? supplyShort : supplyLong;

    if (mode === 'buy') {
      // Calculate the price after buying
      const newSupply = currentSupply + output * 1_000_000; // Convert to atomic units

      const priceAfter = calculateICBSPrice(
        side === 'LONG' ? newSupply : otherSupply,
        side === 'LONG' ? otherSupply : newSupply,
        icbsSide,
        1.0, // lambdaScale
        f,
        betaNum,
        betaDen
      );

      // Average price paid
      const avgPrice = input / output;

      return ((avgPrice - currentPrice) / currentPrice * 100);
    } else {
      // Calculate the price after selling
      const newSupply = Math.max(0, currentSupply - input * 1_000_000);

      const priceAfter = calculateICBSPrice(
        side === 'LONG' ? newSupply : otherSupply,
        side === 'LONG' ? otherSupply : newSupply,
        icbsSide,
        1.0, // lambdaScale
        f,
        betaNum,
        betaDen
      );

      // Average price received
      const avgPrice = output / input;

      return ((currentPrice - avgPrice) / currentPrice * 100);
    }
  }, [inputAmount, outputAmount, mode, side, priceLong, priceShort, supplyLong, supplyShort, f, betaNum, betaDen]);

  // Toggle between buy and sell - swap the input/output amounts
  const toggleMode = () => {

    setMode(prev => prev === 'buy' ? 'sell' : 'buy');
    // Use the raw value if available to avoid rounding loss
    const newInput = outputAmountRaw > 0 ? outputAmountRaw.toString() : outputAmount;


    setInputAmount(newInput);
    setOutputAmount(''); // Clear output, it will be recalculated
    setOutputAmountRaw(0); // Clear raw value
    setShowPreview(false);
  };

  // Handle MAX button click
  const handleMaxClick = () => {
    if (currentBalance > 0) {
      // For sells, use full precision to ensure we sell ALL tokens
      // For buys, use 2 decimals for USDC amounts
      setInputAmount(currentBalance.toFixed(mode === 'buy' ? 2 : 6));
    }
  };

  // Handle funding wallet
  const handleFundWallet = async () => {
    if (!address) return;
    try {
      await fundWallet(address, {
        cluster: { name: 'mainnet-beta' },
      });
    } catch (error) {
      console.error('Funding error:', error);
    }
  };

  // Handle protocol deposit
  const handleProtocolDeposit = async (amount: number) => {
    if (!address) return;

    try {
      const jwt = await getAccessToken();

      if (!jwt) {
        throw new Error('Authentication required');
      }

      // Step 1: Build deposit transaction
      const response = await fetch('/api/users/protocol_deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          amount,
          walletAddress: address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to prepare deposit');
      }

      const { transaction: serializedTx } = await response.json();

      // Step 2: Deserialize and sign
      const { Transaction } = await import('@solana/web3.js');
      const txBuffer = Buffer.from(serializedTx, 'base64');
      const transaction = Transaction.from(txBuffer);

      if (!wallet || !('signTransaction' in wallet)) {
        throw new Error('Wallet not connected');
      }

      // @ts-ignore - Privy wallet has signTransaction
      const signedTx = await wallet.signTransaction(transaction);

      // Step 3: Send signed transaction to backend for execution
      const executeResponse = await fetch('/api/users/protocol_deposit/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          signedTransaction: Buffer.from(signedTx.serialize()).toString('base64'),
          amount: Math.floor(amount * 1_000_000),
          walletAddress: address,
        }),
      });

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        throw new Error(errorData.error || 'Failed to execute deposit');
      }

      const { signature } = await executeResponse.json();

      // Step 4: Record deposit and update agent stake immediately
      const amountMicro = Math.floor(amount * 1_000_000);
      const recordResponse = await fetch('/api/users/protocol_deposit/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          txSignature: signature,
          walletAddress: address,
          amountMicro,
        }),
      });

      if (!recordResponse.ok) {
        const errorText = await recordResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        console.error('[DEPOSIT] Failed to record deposit:', errorData);
        // Don't fail - indexer will pick it up later
      }

      // Close the excessive skim modal
      setExcessiveSkimData(null);

      // Show success message and refresh balances
      handleTradeSuccess();

      // After deposit, automatically retry the trade
      await handleSwap();
    } catch (error) {
      console.error('[DEPOSIT] Deposit failed:', error);
      if (error instanceof Error) {
        setTradeError(error.message);
      }
    }
  };

  // Check balances before showing preview
  const handleShowPreview = async () => {
    const amount = parseFloat(inputAmount);
    if (!amount || amount <= 0) return;

    // Check auth FIRST - before checking balances
    const isAuthed = await requireAuth();
    if (!isAuthed) {
      // Privy login modal already shown
      // If authenticated but no profile, OnboardingModal shows automatically
      return;
    }

    let needsUSDC = false;
    let needsSOL = false;

    // Check USDC balance for buy trades
    if (mode === 'buy' && amount > usdcBalance) {
      needsUSDC = true;
    }

    // Check token balance for sell trades
    if (mode === 'sell') {
      const tokenBalance = side === 'LONG' ? longBalance : shortBalance;
      if (amount > tokenBalance) {
        setTradeError(`Insufficient ${side} tokens`);
        return;
      }
    }

    // Check SOL balance for transaction fees
    if (address) {
      try {
        const rpcEndpoint = getRpcEndpoint();
        const connection = new Connection(rpcEndpoint, 'confirmed');
        const { PublicKey } = await import('@solana/web3.js');
        const pubkey = new PublicKey(address);
        const balance = await connection.getBalance(pubkey);
        const currentSolBalance = balance / 1e9;
        setSolBalance(currentSolBalance);

        // Need at least 0.01 SOL for transaction fees
        if (currentSolBalance < 0.01) {
          needsSOL = true;
        }
      } catch (error) {
        console.error('Error checking SOL balance:', error);
        // Continue anyway, let the transaction fail with proper error
      }
    }

    // Show funding prompt if either is needed
    if (needsUSDC || needsSOL) {
      const fundType = needsUSDC && needsSOL ? 'BOTH' : needsUSDC ? 'USDC' : 'SOL';
      setFundingType(fundType);
      setShowFundingPrompt(true);
      return;
    }

    // All checks passed, show preview
    setShowPreview(true);
  };

  // Handle swap execution with type-safe units
  const handleSwap = async () => {
    const amount = parseFloat(inputAmount);
    if (!amount || amount <= 0) return;

    // Check auth first
    const isAuthed = await requireAuth();
    if (!isAuthed) {
      // Privy login modal already shown
      // If authenticated but no profile, OnboardingModal shows automatically
      return;
    }

    setTradeError(null); // Clear previous errors

    try {
      let result;
      if (mode === 'buy') {
        // Convert USDC to micro-USDC with type safety
        const microUsdc = usdcToMicro(amount);
        result = await buyTokens(postId, poolAddress, microUsdc, side, initialBelief, metaBelief);

        // Check if trade is blocked due to excessive skim
        if (result && 'requiresDeposit' in result && result.requiresDeposit) {
          setExcessiveSkimData(result.excessiveSkimData);
          return; // Don't reset form - user may deposit and retry
        }
      } else {
        // Convert display tokens to atomic units with type safety
        const displayUnits = asDisplay(amount);
        const tokensAtomic = displayToAtomic(displayUnits);
        // Note: Belief submissions are NOT sent on sell - they only update on buy
        result = await sellTokens(postId, poolAddress, tokensAtomic, side);
      }

      // Check if trade completed successfully (has tradeDetails)
      if (result && 'tradeDetails' in result) {
        setCompletedTrade(result.tradeDetails);

        // Call the trade success handler (if provided by parent)
        // This handles any additional UI updates the parent needs
        handleTradeSuccess();
      }

      // Reset after successful transaction
      setInputAmount('');
      setOutputAmount('');
      setOutputAmountRaw(0);
      setShowPreview(false);
      setInitialBelief(0.5);
      setMetaBelief(0.5);
    } catch (error) {
      console.error('[SWAP] Swap error:', error);
      if (error instanceof Error) {
        setTradeError(error.message);
      }
    }
  };

  // Detect if error is insufficient funds
  const currentError = buyError || sellError || tradeError;
  const errorMessage = currentError
    ? currentError instanceof Error
      ? currentError.message
      : currentError
    : null;
  const isInsufficientFunds = errorMessage?.toLowerCase().includes('insufficient') ?? false;

  const isLoading = buyLoading || sellLoading;
  const canSwap = inputAmount && parseFloat(inputAmount) > 0 && !isLoading;

  return (
    <div className="space-y-2">
      {/* Side Toggle - LONG/SHORT */}
      <div className="relative flex gap-2 p-1 bg-[#0f0f0f] rounded-lg border border-[#2a2a2a]">
        {/* Animated background slider */}
        <div
          className={cn(
            "absolute top-1 bottom-1 rounded-md transition-all duration-300 ease-in-out",
            side === 'LONG' ? "left-1 right-[calc(50%+4px)] bg-[#B9D9EB]" : "left-[calc(50%+4px)] right-1 bg-orange-500"
          )}
        />
        <button
          onClick={() => setSide('LONG')}
          className={cn(
            "flex-1 py-2 px-4 rounded-md font-medium transition-colors duration-300 text-sm relative z-10",
            side === 'LONG'
              ? "text-black"
              : "text-gray-400 hover:text-white"
          )}
        >
          LONG
        </button>
        <button
          onClick={() => setSide('SHORT')}
          className={cn(
            "flex-1 py-2 px-4 rounded-md font-medium transition-colors duration-300 text-sm relative z-10",
            side === 'SHORT'
              ? "text-white"
              : "text-gray-400 hover:text-white"
          )}
        >
          SHORT
        </button>
      </div>

      {/* Input */}
      <div className="bg-[#0f0f0f] rounded-lg p-4 md:p-3 border border-[#2a2a2a]">
        <div className="flex items-center gap-2 mb-2 md:mb-1.5">
          <input
            type="number"
            value={inputAmount}
            onChange={(e) => handleInputChange(e.target.value)}
            className="flex-1 bg-transparent text-xl md:text-xl font-medium outline-none text-white placeholder-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-h-[44px] md:min-h-0"
            placeholder="0"
            min="0"
            step={mode === 'buy' ? '0.01' : '1'}
          />
          <div className={cn(
            "px-3 py-2 md:px-2 md:py-1 rounded text-sm md:text-xs font-medium",
            mode === 'buy'
              ? "bg-[#2a2a2a] text-white"
              : side === 'LONG'
              ? "bg-[#B9D9EB]/20 text-[#B9D9EB]"
              : "bg-orange-500/20 text-orange-400"
          )}>
            {mode === 'buy' ? 'USDC' : `${side}`}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={handleMaxClick}
            className="px-3 py-2 md:px-1.5 md:py-0.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded text-sm md:text-xs font-medium text-[#B9D9EB] hover:text-white transition-colors disabled:opacity-50 cursor-pointer min-h-[44px] md:min-h-0"
            disabled={balancesLoading || currentBalance === 0}
          >
            MAX
          </button>
          <span className="text-sm md:text-xs text-gray-300">
            {balancesLoading ? '...' : currentBalance.toFixed(mode === 'buy' ? 2 : 0)} <span className="text-gray-400">{mode === 'buy' ? 'USDC' : side}</span>
          </span>
        </div>
      </div>

      {/* Swap Direction Button */}
      <div className="flex justify-center -my-1 relative z-10">
        <button
          onClick={toggleMode}
          className="p-3 md:p-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-full transition-all hover:rotate-180 text-white min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
          aria-label="Switch swap direction"
        >
          <ArrowDownUp className="w-5 h-5 md:w-4 md:h-4" />
        </button>
      </div>

      {/* Output */}
      <div className="bg-[#0f0f0f] rounded-lg p-4 md:p-3 border border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={outputAmount}
            readOnly
            className="flex-1 bg-transparent text-xl md:text-xl font-medium outline-none text-white placeholder-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-h-[44px] md:min-h-0 cursor-default"
            placeholder="0"
          />
          <div className={cn(
            "px-3 py-2 md:px-2 md:py-1 rounded text-sm md:text-xs font-medium",
            mode === 'buy'
              ? side === 'LONG'
                ? "bg-[#B9D9EB]/20 text-[#B9D9EB]"
                : "bg-orange-500/20 text-orange-400"
              : "bg-[#2a2a2a] text-white"
          )}>
            {mode === 'buy' ? side : 'USDC'}
          </div>
        </div>
      </div>

      {/* Swap Button */}
      <button
        onClick={handleShowPreview}
        disabled={!canSwap}
        className={cn(
          "w-full py-3 md:py-2.5 font-medium rounded-lg transition-all text-base md:text-sm min-h-[44px] md:min-h-0 disabled:opacity-50 disabled:cursor-default",
          mode === 'buy'
            ? side === 'LONG'
              ? "bg-[#B9D9EB] hover:bg-[#a3cfe3] text-black"
              : "bg-orange-500 hover:bg-orange-600 text-white"
            : side === 'LONG'
              ? "bg-[#B9D9EB] hover:bg-[#a3cfe3] text-black"
              : "bg-orange-500 hover:bg-orange-600 text-white"
        )}
      >
        {isLoading ? 'Processing...' : `${mode === 'buy' ? 'Buy' : 'Sell'} ${side}`}
      </button>

      {/* Error Message with Fund Wallet Buttons */}
      {errorMessage && (
        <div className="space-y-2">
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-orange-400">
                {errorMessage}
              </p>
            </div>
          </div>
          {/* Only show fund wallet button for USDC/SOL issues, not token balance issues */}
          {(errorMessage.toLowerCase().includes('usdc') ||
            errorMessage.toLowerCase().includes('sol')) && (
            <FundWalletButton variant="full" />
          )}
        </div>
      )}

      {/* Compact Preview Modal with Belief Submission */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-xl p-4 max-w-sm w-full border border-[#2a2a2a] max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold mb-3 text-white">
              Confirm {mode === 'buy' ? 'Buy' : 'Sell'} {side}
            </h3>

            <div className="space-y-2 mb-3">
              <div className="bg-[#0f0f0f] rounded p-2 border border-[#2a2a2a]">
                <p className="text-xs text-gray-400 mb-0.5">You {mode === 'buy' ? 'pay' : 'sell'}</p>
                <p className="text-lg font-medium text-white">
                  {inputAmount} {mode === 'buy' ? 'USDC' : side}
                </p>
              </div>

              <div className="flex justify-center">
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>

              <div className="bg-[#0f0f0f] rounded p-2 border border-[#2a2a2a]">
                <p className="text-xs text-gray-400 mb-0.5">You receive</p>
                <p className="text-lg font-medium text-white">
                  ~{outputAmount} {mode === 'buy' ? side : 'USDC'}
                </p>
              </div>
            </div>

            {/* Belief Submission - Only show on BUY mode */}
            {mode === 'buy' && (
              <div className="space-y-3 mb-4 border-t border-gray-800 pt-4">
                <p className="text-sm font-medium text-gray-300">Record your belief</p>

                <div>
                  <label htmlFor="initial-belief-trade" className="block text-xs text-gray-400 mb-1.5">
                    How relevant is this post?
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="initial-belief-trade"
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={initialBelief}
                      onChange={(e) => setInitialBelief(Number(e.target.value))}
                      className="flex-1 accent-[#B9D9EB] h-1"
                    />
                    <span className="text-xs font-mono text-gray-300 w-10 text-right">
                      {Math.round(initialBelief * 100)}%
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="meta-belief-trade" className="block text-xs text-gray-400 mb-1.5">
                    How relevant will others think it is?
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="meta-belief-trade"
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={metaBelief}
                      onChange={(e) => setMetaBelief(Number(e.target.value))}
                      className="flex-1 accent-[#B9D9EB] h-1"
                    />
                    <span className="text-xs font-mono text-gray-300 w-10 text-right">
                      {Math.round(metaBelief * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 py-3 md:py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg transition-colors text-base md:text-sm min-h-[44px] md:min-h-0"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleSwap();
                  setShowPreview(false);
                }}
                disabled={isLoading}
                className={cn(
                  "flex-1 py-3 md:py-2 font-medium rounded-lg transition-colors text-base md:text-sm min-h-[44px] md:min-h-0",
                  mode === 'buy'
                    ? side === 'LONG'
                      ? "bg-[#B9D9EB] hover:bg-[#a3cfe3] text-black"
                      : "bg-orange-500 hover:bg-orange-600 text-white"
                    : side === 'LONG'
                      ? "bg-[#B9D9EB] hover:bg-[#a3cfe3] text-black"
                      : "bg-orange-500 hover:bg-orange-600 text-white"
                )}
              >
                {isLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Funding Prompt Modal */}
      <FundingPromptModal
        isOpen={showFundingPrompt}
        onClose={() => setShowFundingPrompt(false)}
        type={fundingType}
        requiredAmount={mode === 'buy' ? parseFloat(inputAmount) || 0 : 0}
        currentBalance={usdcBalance}
        currentSolBalance={solBalance}
      />

      {/* Trade Completed Modal */}
      <TradeCompletedModal
        isOpen={!!completedTrade}
        onClose={() => setCompletedTrade(null)}
        details={completedTrade}
      />

      {/* Excessive Skim Modal */}
      {excessiveSkimData && (
        <ExcessiveSkimModal
          isOpen={!!excessiveSkimData}
          onClose={() => setExcessiveSkimData(null)}
          onDeposit={handleProtocolDeposit}
          skimAmount={excessiveSkimData.skimAmount / 1_000_000}
          skimPercentage={excessiveSkimData.skimPercentage}
          tradeAmount={excessiveSkimData.tradeAmount}
          recommendedDeposit={excessiveSkimData.recommendedDeposit}
          underwaterInfo={excessiveSkimData.underwaterInfo}
        />
      )}
    </div>
  );
}
