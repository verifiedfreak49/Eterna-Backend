import { MockDexRouter } from "./MockDexRouter";
import { DexQuote } from "../types/order";

describe("MockDexRouter", () => {
  let router: MockDexRouter;

  beforeEach(() => {
    router = new MockDexRouter();
  });

  describe("getRaydiumQuote", () => {
    it("should return a valid Raydium quote with price variance", async () => {
      const quote = await router.getRaydiumQuote("SOL", "USDC", "100");

      expect(quote).toHaveProperty("dex", "raydium");
      expect(quote).toHaveProperty("price");
      expect(quote).toHaveProperty("amountOut");
      expect(quote).toHaveProperty("estimatedGas", "50000");
      expect(parseFloat(quote.price)).toBeGreaterThan(0);
      expect(parseFloat(quote.amountOut)).toBeGreaterThan(0);
    });

    it("should include price variance between 2-5%", async () => {
      const quote = await router.getRaydiumQuote("SOL", "USDC", "100");
      const baseAmount = 100;
      const amountOut = parseFloat(quote.amountOut);
      const variance = Math.abs(amountOut - baseAmount) / baseAmount;

      // Variance should be between 0.02 and 0.05 (2-5%)
      expect(variance).toBeGreaterThanOrEqual(0.02);
      expect(variance).toBeLessThanOrEqual(0.05);
    });

    it("should simulate network delay (200-300ms)", async () => {
      const startTime = Date.now();
      await router.getRaydiumQuote("SOL", "USDC", "100");
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(200);
      expect(duration).toBeLessThan(400); // Allow some buffer
    });
  });

  describe("getMeteoraQuote", () => {
    it("should return a valid Meteora quote with price variance", async () => {
      const quote = await router.getMeteoraQuote("SOL", "USDC", "100");

      expect(quote).toHaveProperty("dex", "meteora");
      expect(quote).toHaveProperty("price");
      expect(quote).toHaveProperty("amountOut");
      expect(quote).toHaveProperty("estimatedGas", "45000");
      expect(parseFloat(quote.price)).toBeGreaterThan(0);
      expect(parseFloat(quote.amountOut)).toBeGreaterThan(0);
    });

    it("should include price variance between 2-5%", async () => {
      const quote = await router.getMeteoraQuote("SOL", "USDC", "100");
      const baseAmount = 100;
      const amountOut = parseFloat(quote.amountOut);
      const variance = Math.abs(amountOut - baseAmount) / baseAmount;

      expect(variance).toBeGreaterThanOrEqual(0.02);
      expect(variance).toBeLessThanOrEqual(0.05);
    });
  });

  describe("getBestQuote", () => {
    it("should return the best quote from all DEXes", async () => {
      const bestQuote = await router.getBestQuote("SOL", "USDC", "100");

      expect(bestQuote).toHaveProperty("dex");
      expect(["raydium", "meteora"]).toContain(bestQuote.dex);
      expect(bestQuote).toHaveProperty("price");
      expect(bestQuote).toHaveProperty("amountOut");
    });

    it("should select the quote with highest amountOut", async () => {
      // Mock the individual quote methods to return predictable values
      const raydiumSpy = jest.spyOn(router, "getRaydiumQuote").mockResolvedValue({
        dex: "raydium",
        price: "105",
        amountOut: "105",
        estimatedGas: "50000",
      });

      const meteoraSpy = jest.spyOn(router, "getMeteoraQuote").mockResolvedValue({
        dex: "meteora",
        price: "103",
        amountOut: "103",
        estimatedGas: "45000",
      });

      const bestQuote = await router.getBestQuote("SOL", "USDC", "100");

      expect(bestQuote.dex).toBe("raydium");
      expect(bestQuote.amountOut).toBe("105");

      raydiumSpy.mockRestore();
      meteoraSpy.mockRestore();
    });
  });

  describe("executeSwap", () => {
    it("should return a valid transaction hash", async () => {
      const txHash = await router.executeSwap("raydium", "SOL", "USDC", "100");

      expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("should simulate execution delay (2-3 seconds)", async () => {
      const startTime = Date.now();
      await router.executeSwap("raydium", "SOL", "USDC", "100");
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(2000);
      expect(duration).toBeLessThan(4000); // Allow buffer
    });

    it("should generate unique transaction hashes", async () => {
      const txHash1 = await router.executeSwap("raydium", "SOL", "USDC", "100");
      const txHash2 = await router.executeSwap("meteora", "SOL", "USDC", "100");

      expect(txHash1).not.toBe(txHash2);
    });
  });
});

