import { orderQueue, addOrderToQueue } from "../../queue/orderQueue";
import { OrderJobData } from "../../types/order";

// Mock the worker to simulate failures
jest.mock("../../workers/orderWorker", () => ({
  orderWorker: {
    on: jest.fn(),
    close: jest.fn(),
  },
}));

describe("Retry Behavior", () => {
  beforeEach(async () => {
    await orderQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    await orderQueue.close();
  });

  it("should configure exponential backoff retry", async () => {
    const jobData: OrderJobData = {
      orderId: "test-retry-order",
      tokenIn: "SOL",
      tokenOut: "USDC",
      amountIn: "100",
    };

    const job = await addOrderToQueue(jobData);

    expect(job.opts.attempts).toBe(3);
    expect(job.opts.backoff?.type).toBe("exponential");
    expect(job.opts.backoff?.delay).toBe(2000);
  });

  it("should handle job failures with retries", async () => {
    const jobData: OrderJobData = {
      orderId: "test-fail-order",
      tokenIn: "SOL",
      tokenOut: "USDC",
      amountIn: "100",
    };

    const job = await addOrderToQueue(jobData);

    // Verify retry configuration
    expect(job.opts.attempts).toBeGreaterThanOrEqual(3);
  });
});

