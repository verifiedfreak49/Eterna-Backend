import { z } from "zod";

const orderRequestSchema = z.object({
  tokenIn: z.string().min(1, "tokenIn is required"),
  tokenOut: z.string().min(1, "tokenOut is required"),
  amountIn: z.string().regex(/^\d+(\.\d+)?$/, "amountIn must be a valid number"),
  orderType: z.enum(["market"]).optional().default("market"),
});

describe("Order Validation", () => {
  it("should validate a correct order request", () => {
    const validRequest = {
      tokenIn: "SOL",
      tokenOut: "USDC",
      amountIn: "100",
      orderType: "market",
    };

    const result = orderRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it("should reject empty tokenIn", () => {
    const invalidRequest = {
      tokenIn: "",
      tokenOut: "USDC",
      amountIn: "100",
    };

    const result = orderRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it("should reject invalid amountIn format", () => {
    const invalidRequest = {
      tokenIn: "SOL",
      tokenOut: "USDC",
      amountIn: "abc",
    };

    const result = orderRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it("should accept decimal amounts", () => {
    const validRequest = {
      tokenIn: "SOL",
      tokenOut: "USDC",
      amountIn: "100.5",
    };

    const result = orderRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it("should default orderType to market", () => {
    const request = {
      tokenIn: "SOL",
      tokenOut: "USDC",
      amountIn: "100",
    };

    const result = orderRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.orderType).toBe("market");
    }
  });

  it("should reject non-market order types", () => {
    const invalidRequest = {
      tokenIn: "SOL",
      tokenOut: "USDC",
      amountIn: "100",
      orderType: "limit",
    };

    const result = orderRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });
});

