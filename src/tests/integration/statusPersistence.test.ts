import { getPrismaClient } from "../../config/database";
import { OrderStatus } from "../../types/order";

// Mock WebSocket manager
jest.mock("../../websocket/WebSocketManager", () => ({
  wsManager: {
    broadcastOrderUpdate: jest.fn(),
  },
}));

describe("Status Persistence", () => {
  let prisma: any;

  beforeAll(() => {
    prisma = getPrismaClient();
  });

  beforeEach(async () => {
    await prisma.order.deleteMany({});
  });

  it("should persist all status transitions", async () => {
    // Create initial order
    const order = await prisma.order.create({
      data: {
        id: "test-order-status",
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
        status: "pending",
        statusHistory: [
          {
            status: "pending",
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    // Simulate status transitions
    const statuses: OrderStatus[] = ["routing", "building", "submitted", "confirmed"];

    for (const status of statuses) {
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          status,
          statusHistory: {
            push: {
              status,
              timestamp: new Date().toISOString(),
            },
          },
        },
      });

      expect(updatedOrder.status).toBe(status);
    }

    // Verify final state
    const finalOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });

    const statusHistory = finalOrder.statusHistory as Array<{
      status: string;
      timestamp: string;
    }>;

    expect(statusHistory.length).toBe(5); // pending + 4 transitions
    expect(statusHistory.map((h) => h.status)).toEqual([
      "pending",
      "routing",
      "building",
      "submitted",
      "confirmed",
    ]);
  });

  it("should store failure reason on failed status", async () => {
    const order = await prisma.order.create({
      data: {
        id: "test-order-failed",
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
        status: "pending",
        statusHistory: [
          {
            status: "pending",
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "failed",
        failureReason: "DEX execution timeout",
        statusHistory: {
          push: {
            status: "failed",
            timestamp: new Date().toISOString(),
            metadata: {
              failureReason: "DEX execution timeout",
            },
          },
        },
      },
    });

    const failedOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });

    expect(failedOrder.status).toBe("failed");
    expect(failedOrder.failureReason).toBe("DEX execution timeout");
  });

  it("should update timestamps on status changes", async () => {
    const order = await prisma.order.create({
      data: {
        id: "test-order-timestamps",
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
        status: "pending",
        statusHistory: [
          {
            status: "pending",
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    const initialUpdatedAt = order.updatedAt;

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 100));

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "routing",
        statusHistory: {
          push: {
            status: "routing",
            timestamp: new Date().toISOString(),
          },
        },
      },
    });

    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });

    expect(new Date(updatedOrder.updatedAt).getTime()).toBeGreaterThan(
      new Date(initialUpdatedAt).getTime()
    );
  });
});

