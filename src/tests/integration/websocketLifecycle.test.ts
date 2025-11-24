import { WebSocketManager } from "../../websocket/WebSocketManager";
import { OrderState, OrderStatus } from "../../types/order";

// Mock WebSocket
class MockWebSocket {
  readyState = 1; // OPEN
  messages: string[] = [];
  onclose: ((() => void) | null) = null;
  onerror: ((error: Error) => void) | null = null;

  send(message: string) {
    this.messages.push(message);
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose();
    }
  }
}

describe("WebSocket Lifecycle", () => {
  let manager: WebSocketManager;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    manager = new WebSocketManager();
    mockWs = new MockWebSocket();
  });

  it("should stream all status transitions in correct order", () => {
    manager.registerClient("client-1", mockWs as any);
    manager.subscribeToOrder("client-1", "order-1");

    const statuses: OrderStatus[] = [
      "pending",
      "routing",
      "building",
      "submitted",
      "confirmed",
    ];

    statuses.forEach((status, index) => {
      const order: OrderState = {
        id: "order-1",
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
        status,
        statusHistory: statuses.slice(0, index + 1).map((s) => ({
          status: s,
          timestamp: new Date().toISOString(),
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      manager.broadcastOrderUpdate(order);
    });

    expect(mockWs.messages.length).toBe(5);

    // Verify order of statuses
    const receivedStatuses = mockWs.messages.map((msg) => {
      const parsed = JSON.parse(msg);
      return parsed.status;
    });

    expect(receivedStatuses).toEqual(statuses);
  });

  it("should include full order state in each message", () => {
    manager.registerClient("client-1", mockWs as any);
    manager.subscribeToOrder("client-1", "order-1");

    const order: OrderState = {
      id: "order-1",
      tokenIn: "SOL",
      tokenOut: "USDC",
      amountIn: "100",
      dexUsed: "raydium",
      executedPrice: "105.5",
      txHash: "0x123456",
      status: "confirmed",
      statusHistory: [
        {
          status: "pending",
          timestamp: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    manager.broadcastOrderUpdate(order);

    expect(mockWs.messages.length).toBe(1);
    const message = JSON.parse(mockWs.messages[0]);

    expect(message.type).toBe("status_update");
    expect(message.orderId).toBe("order-1");
    expect(message.order).toBeDefined();
    expect(message.order.id).toBe("order-1");
    expect(message.order.dexUsed).toBe("raydium");
    expect(message.order.executedPrice).toBe("105.5");
    expect(message.order.txHash).toBe("0x123456");
    expect(message.timestamp).toBeDefined();
  });

  it("should handle failed status with failure reason", () => {
    manager.registerClient("client-1", mockWs as any);
    manager.subscribeToOrder("client-1", "order-1");

    const order: OrderState = {
      id: "order-1",
      tokenIn: "SOL",
      tokenOut: "USDC",
      amountIn: "100",
      status: "failed",
      failureReason: "DEX timeout",
      statusHistory: [
        {
          status: "pending",
          timestamp: new Date().toISOString(),
        },
        {
          status: "failed",
          timestamp: new Date().toISOString(),
          metadata: { failureReason: "DEX timeout" },
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    manager.broadcastOrderUpdate(order);

    const message = JSON.parse(mockWs.messages[0]);
    expect(message.status).toBe("failed");
    expect(message.order.failureReason).toBe("DEX timeout");
  });
});

