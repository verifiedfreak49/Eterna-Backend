import { buildServer } from "../../index";
import { getPrismaClient } from "../../config/database";
import { orderQueue } from "../../queue/orderQueue";
import { OrderStatus } from "../../types/order";

// Integration test for complete order execution flow
describe("Order Execution Integration", () => {
  let server: any;
  let prisma: any;

  beforeAll(async () => {
    server = await buildServer();
    prisma = getPrismaClient();
  });

  afterAll(async () => {
    await orderQueue.obliterate({ force: true });
    await server.close();
  });

  beforeEach(async () => {
    // Clean up orders before each test
    await prisma.order.deleteMany({});
    await orderQueue.obliterate({ force: true });
  });

  it("should execute a complete order lifecycle", async () => {
    // Create order via API
    const response = await server.inject({
      method: "POST",
      url: "/api/orders/execute",
      payload: {
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
        orderType: "market",
      },
    });

    expect(response.statusCode).toBe(201);
    const { orderId } = JSON.parse(response.body);
    expect(orderId).toBeDefined();

    // Wait for order to be processed (with timeout)
    let order;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

    while (attempts < maxAttempts) {
      order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (order && (order.status === "confirmed" || order.status === "failed")) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    expect(order).toBeDefined();
    expect(["confirmed", "failed"]).toContain(order.status);

    // Verify status history
    const statusHistory = order.statusHistory as Array<{
      status: string;
      timestamp: string;
    }>;

    expect(statusHistory.length).toBeGreaterThan(0);
    expect(statusHistory[0].status).toBe("pending");

    // Verify final status transitions
    const statuses = statusHistory.map((h) => h.status);
    expect(statuses).toContain("pending");
    expect(statuses).toContain("routing");
  });

  it("should persist status transitions correctly", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/orders/execute",
      payload: {
        tokenIn: "ETH",
        tokenOut: "USDC",
        amountIn: "50",
      },
    });

    const { orderId } = JSON.parse(response.body);

    // Wait a bit for processing
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    expect(order).toBeDefined();
    expect(order.statusHistory).toBeDefined();

    const statusHistory = order.statusHistory as Array<{
      status: string;
      timestamp: string;
    }>;

    // Verify timestamps are in order
    for (let i = 1; i < statusHistory.length; i++) {
      const prevTime = new Date(statusHistory[i - 1].timestamp).getTime();
      const currTime = new Date(statusHistory[i].timestamp).getTime();
      expect(currTime).toBeGreaterThanOrEqual(prevTime);
    }
  });

  it("should handle multiple concurrent orders", async () => {
    const orders = Array.from({ length: 5 }, (_, i) => ({
      tokenIn: "SOL",
      tokenOut: "USDC",
      amountIn: (10 * (i + 1)).toString(),
    }));

    const responses = await Promise.all(
      orders.map((order) =>
        server.inject({
          method: "POST",
          url: "/api/orders/execute",
          payload: order,
        })
      )
    );

    expect(responses.every((r) => r.statusCode === 201)).toBe(true);

    const orderIds = responses.map((r) => JSON.parse(r.body).orderId);

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Verify all orders were created
    const dbOrders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
    });

    expect(dbOrders.length).toBe(5);
  });

  it("should return order by ID", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/api/orders/execute",
      payload: {
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
      },
    });

    const { orderId } = JSON.parse(createResponse.body);

    const getResponse = await server.inject({
      method: "GET",
      url: `/api/orders/${orderId}`,
    });

    expect(getResponse.statusCode).toBe(200);
    const order = JSON.parse(getResponse.body);
    expect(order.id).toBe(orderId);
    expect(order.tokenIn).toBe("SOL");
    expect(order.tokenOut).toBe("USDC");
  });
});

