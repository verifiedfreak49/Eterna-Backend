import { DexQuote } from "../types/order";

/**
 * Mock DEX Router for simulating DEX quote operations
 * 
 * This router simulates:
 * - Raydium DEX quotes
 * - Meteora DEX quotes
 * - Random price variance (2-5%)
 * - Routing delays (200-300ms)
 * 
 * Future Extension Notes:
 * - For Limit Orders: Add price comparison logic to only execute when market price
 *   reaches the limit price. Store limit price in order and check during routing phase.
 * - For Sniper Orders: Add monitoring logic to watch for specific conditions (price,
 *   volume, etc.) and trigger execution when conditions are met. This would require
 *   a separate background watcher service.
 */
export class MockDexRouter {
  /**
   * Get quote from Raydium DEX
   * Simulates 200-300ms delay and adds 2-5% price variance
   */
  async getRaydiumQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<DexQuote> {
    // Simulate network delay
    await this.delay(200 + Math.random() * 100);

    // Calculate base price (mock: 1:1 ratio with variance)
    const basePrice = parseFloat(amountIn);
    const variance = 0.02 + Math.random() * 0.03; // 2-5% variance
    const priceMultiplier = 1 + (Math.random() < 0.5 ? -1 : 1) * variance;
    const price = (basePrice * priceMultiplier).toFixed(8);
    const amountOut = (parseFloat(amountIn) * priceMultiplier).toFixed(8);

    return {
      dex: "raydium",
      price,
      amountOut,
      estimatedGas: "50000",
    };
  }

  /**
   * Get quote from Meteora DEX
   * Simulates 200-300ms delay and adds 2-5% price variance
   */
  async getMeteoraQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<DexQuote> {
    // Simulate network delay
    await this.delay(200 + Math.random() * 100);

    // Calculate base price (mock: 1:1 ratio with variance)
    const basePrice = parseFloat(amountIn);
    const variance = 0.02 + Math.random() * 0.03; // 2-5% variance
    const priceMultiplier = 1 + (Math.random() < 0.5 ? -1 : 1) * variance;
    const price = (basePrice * priceMultiplier).toFixed(8);
    const amountOut = (parseFloat(amountIn) * priceMultiplier).toFixed(8);

    return {
      dex: "meteora",
      price,
      amountOut,
      estimatedGas: "45000",
    };
  }

  /**
   * Get quotes from all DEXes and return the best rate
   */
  async getBestQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<DexQuote> {
    console.log(`[DEX Router] Fetching quotes for ${amountIn} ${tokenIn} -> ${tokenOut}`);

    // Fetch quotes from all DEXes in parallel
    const [raydiumQuote, meteoraQuote] = await Promise.all([
      this.getRaydiumQuote(tokenIn, tokenOut, amountIn),
      this.getMeteoraQuote(tokenIn, tokenOut, amountIn),
    ]);

    console.log(`[DEX Router] Raydium quote: ${raydiumQuote.amountOut} ${tokenOut} (price: ${raydiumQuote.price})`);
    console.log(`[DEX Router] Meteora quote: ${meteoraQuote.amountOut} ${tokenOut} (price: ${meteoraQuote.price})`);

    // Compare quotes and return the best one (highest amountOut)
    const bestQuote =
      parseFloat(raydiumQuote.amountOut) > parseFloat(meteoraQuote.amountOut)
        ? raydiumQuote
        : meteoraQuote;

    console.log(`[DEX Router] Selected best quote: ${bestQuote.dex} with ${bestQuote.amountOut} ${tokenOut}`);

    return bestQuote;
  }

  /**
   * Simulate transaction execution
   * Returns a mock transaction hash after 2-3s delay
   */
  async executeSwap(
    dex: string,
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<string> {
    // Simulate execution delay (2-3 seconds)
    await this.delay(2000 + Math.random() * 1000);

    // Generate mock transaction hash
    const txHash = "0x" + this.randomHex(64);
    console.log(`[DEX Router] Executed swap on ${dex}, txHash: ${txHash}`);

    return txHash;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private randomHex(length: number): string {
    const chars = "0123456789abcdef";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
}

