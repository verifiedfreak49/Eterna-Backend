import { addOrderToQueue, orderQueue, getQueueMetrics } from "./orderQueue";
import { OrderJobData } from "../types/order";

// Mock Redis
jest.mock("../config/redis", () => ({
  getRedisClient: jest.fn(() => ({
    ping: jest.fn().mockResolvedValue("PONG"),
    quit: jest.fn().mockResolvedValue("OK"),
  })),
}));

describe("OrderQueue", () => {
  beforeEach(async () => {
    // Clear queue before each test
    await orderQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    await orderQueue.close();
  });

  describe("addOrderToQueue", () => {
    it("should add an order to the queue", async () => {
      const jobData: OrderJobData = {
        orderId: "test-order-1",
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
      };

      const job = await addOrderToQueue(jobData);

      expect(job).toBeDefined();
      expect(job.id).toBe("test-order-1");
      expect(job.data).toEqual(jobData);
    });

    it("should prevent duplicate orders with same orderId", async () => {
      const jobData: OrderJobData = {
        orderId: "test-order-2",
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
      };

      const job1 = await addOrderToQueue(jobData);
      const job2 = await addOrderToQueue(jobData);

      // Both should return the same job since orderId is used as jobId
      expect(job1.id).toBe(job2.id);
    });

    it("should handle multiple orders", async () => {
      const orders: OrderJobData[] = [
        { orderId: "order-1", tokenIn: "SOL", tokenOut: "USDC", amountIn: "100" },
        { orderId: "order-2", tokenIn: "USDC", tokenOut: "SOL", amountIn: "200" },
        { orderId: "order-3", tokenIn: "ETH", tokenOut: "USDC", amountIn: "50" },
      ];

      const jobs = await Promise.all(orders.map((order) => addOrderToQueue(order)));

      expect(jobs).toHaveLength(3);
      expect(jobs.map((j) => j.id)).toEqual(["order-1", "order-2", "order-3"]);
    });
  });

  describe("getQueueMetrics", () => {
    it("should return queue metrics", async () => {
      const metrics = await getQueueMetrics();

      expect(metrics).toHaveProperty("waiting");
      expect(metrics).toHaveProperty("active");
      expect(metrics).toHaveProperty("completed");
      expect(metrics).toHaveProperty("failed");
      expect(typeof metrics.waiting).toBe("number");
      expect(typeof metrics.active).toBe("number");
    });
  });
});

