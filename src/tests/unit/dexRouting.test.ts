import { MockDexRouter } from "../../dex/MockDexRouter";

describe("DEX Routing Logic", () => {
  let router: MockDexRouter;

  beforeEach(() => {
    router = new MockDexRouter();
  });

  it("should fetch quotes from both DEXes in parallel", async () => {
    const startTime = Date.now();
    const quote = await router.getBestQuote("SOL", "USDC", "100");
    const duration = Date.now() - startTime;

    // Should complete in ~200-300ms (parallel execution)
    expect(duration).toBeLessThan(500);
    expect(quote).toBeDefined();
    expect(["raydium", "meteora"]).toContain(quote.dex);
  });

  it("should select the DEX with highest amountOut", async () => {
    // Mock to return predictable values
    const raydiumSpy = jest
      .spyOn(router, "getRaydiumQuote")
      .mockResolvedValue({
        dex: "raydium",
        price: "110",
        amountOut: "110",
        estimatedGas: "50000",
      });

    const meteoraSpy = jest
      .spyOn(router, "getMeteoraQuote")
      .mockResolvedValue({
        dex: "meteora",
        price: "105",
        amountOut: "105",
        estimatedGas: "45000",
      });

    const bestQuote = await router.getBestQuote("SOL", "USDC", "100");

    expect(bestQuote.dex).toBe("raydium");
    expect(bestQuote.amountOut).toBe("110");

    raydiumSpy.mockRestore();
    meteoraSpy.mockRestore();
  });

  it("should handle Meteora being better", async () => {
    const raydiumSpy = jest
      .spyOn(router, "getRaydiumQuote")
      .mockResolvedValue({
        dex: "raydium",
        price: "102",
        amountOut: "102",
        estimatedGas: "50000",
      });

    const meteoraSpy = jest
      .spyOn(router, "getMeteoraQuote")
      .mockResolvedValue({
        dex: "meteora",
        price: "108",
        amountOut: "108",
        estimatedGas: "45000",
      });

    const bestQuote = await router.getBestQuote("SOL", "USDC", "100");

    expect(bestQuote.dex).toBe("meteora");
    expect(bestQuote.amountOut).toBe("108");

    raydiumSpy.mockRestore();
    meteoraSpy.mockRestore();
  });

  it("should apply price variance within 2-5% range", async () => {
    const quotes = await Promise.all([
      router.getRaydiumQuote("SOL", "USDC", "100"),
      router.getRaydiumQuote("SOL", "USDC", "100"),
      router.getRaydiumQuote("SOL", "USDC", "100"),
    ]);

    quotes.forEach((quote) => {
      const amountOut = parseFloat(quote.amountOut);
      const variance = Math.abs(amountOut - 100) / 100;

      expect(variance).toBeGreaterThanOrEqual(0.02);
      expect(variance).toBeLessThanOrEqual(0.05);
    });
  });
});

