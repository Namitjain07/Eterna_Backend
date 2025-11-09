import { DexQuote, DexType, ExecutionResult, Order } from '../types/order';
import { sleep } from '../utils/sleep';

/**
 * MockDexRouter simulates DEX routing with realistic network delays and price variance
 * Implements price comparison between Raydium and Meteora
 */
export class MockDexRouter {
  private basePrice: number = 1.0;
  
  /**
   * Get quote from Raydium pool
   * Simulates network delay and price variance
   */
  async getRaydiumQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: number
  ): Promise<DexQuote> {
    // Simulate network delay (150-250ms)
    await sleep(150 + Math.random() * 100);
    
    // Calculate base price with some variance (98-102% of base)
    const priceVariance = 0.98 + Math.random() * 0.04;
    const price = this.basePrice * priceVariance;
    const fee = 0.003; // 0.3% fee
    
    // Calculate estimated output
    const estimatedOutput = amountIn * price * (1 - fee);
    
    // Simulate liquidity (affects execution quality)
    const liquidity = 50000 + Math.random() * 200000;
    
    return {
      dex: 'raydium',
      price,
      fee,
      estimatedOutput,
      liquidity,
    };
  }

  /**
   * Get quote from Meteora pool
   * Simulates network delay and price variance (slightly different from Raydium)
   */
  async getMeteorQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: number
  ): Promise<DexQuote> {
    // Simulate network delay (150-250ms)
    await sleep(150 + Math.random() * 100);
    
    // Calculate base price with different variance (97-102% of base)
    const priceVariance = 0.97 + Math.random() * 0.05;
    const price = this.basePrice * priceVariance;
    const fee = 0.002; // 0.2% fee (lower than Raydium)
    
    // Calculate estimated output
    const estimatedOutput = amountIn * price * (1 - fee);
    
    // Simulate liquidity
    const liquidity = 40000 + Math.random() * 180000;
    
    return {
      dex: 'meteora',
      price,
      fee,
      estimatedOutput,
      liquidity,
    };
  }

  /**
   * Compare quotes from both DEXs and select the best one
   * Best quote = highest estimated output (after fees)
   */
  async getBestQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: number
  ): Promise<DexQuote> {
    // Fetch quotes from both DEXs in parallel
    const [raydiumQuote, meteoraQuote] = await Promise.all([
      this.getRaydiumQuote(tokenIn, tokenOut, amountIn),
      this.getMeteorQuote(tokenIn, tokenOut, amountIn),
    ]);

    console.log('🔍 DEX Quote Comparison:');
    console.log(`  Raydium: ${raydiumQuote.estimatedOutput.toFixed(4)} (price: ${raydiumQuote.price.toFixed(4)}, fee: ${raydiumQuote.fee * 100}%)`);
    console.log(`  Meteora: ${meteoraQuote.estimatedOutput.toFixed(4)} (price: ${meteoraQuote.price.toFixed(4)}, fee: ${meteoraQuote.fee * 100}%)`);

    // Select DEX with best estimated output
    const bestQuote = raydiumQuote.estimatedOutput > meteoraQuote.estimatedOutput
      ? raydiumQuote
      : meteoraQuote;

    console.log(`  ✅ Selected: ${bestQuote.dex.toUpperCase()} (better by ${Math.abs(raydiumQuote.estimatedOutput - meteoraQuote.estimatedOutput).toFixed(4)})`);

    return bestQuote;
  }

  /**
   * Execute swap on the selected DEX
   * Simulates transaction building, submission, and confirmation
   */
  async executeSwap(
    dex: DexType,
    order: Order,
    quote: DexQuote
  ): Promise<ExecutionResult> {
    // Simulate transaction execution (2-3 seconds)
    const executionDelay = 2000 + Math.random() * 1000;
    await sleep(executionDelay);

    // Simulate small price slippage during execution (0-2%)
    const slippageImpact = 1 - (Math.random() * 0.02);
    const executedPrice = quote.price * slippageImpact;
    const amountOut = order.amountIn * executedPrice * (1 - quote.fee);

    // Check if slippage exceeds user tolerance
    const actualSlippage = Math.abs(executedPrice - quote.price) / quote.price;
    if (actualSlippage > order.slippage) {
      throw new Error(
        `Slippage tolerance exceeded: ${(actualSlippage * 100).toFixed(2)}% > ${(order.slippage * 100).toFixed(2)}%`
      );
    }

    // Generate mock transaction hash
    const txHash = this.generateMockTxHash();

    console.log(`✅ Swap executed on ${dex.toUpperCase()}`);
    console.log(`   TX Hash: ${txHash}`);
    console.log(`   Executed Price: ${executedPrice.toFixed(4)}`);
    console.log(`   Amount Out: ${amountOut.toFixed(4)}`);

    return {
      txHash,
      executedPrice,
      amountOut,
      fee: quote.fee,
      timestamp: new Date(),
    };
  }

  /**
   * Generate a realistic-looking mock transaction hash
   */
  private generateMockTxHash(): string {
    const chars = '0123456789abcdef';
    let hash = '';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  }

  /**
   * Set base price for testing
   */
  setBasePrice(price: number): void {
    this.basePrice = price;
  }
}
