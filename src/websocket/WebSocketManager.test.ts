import { WebSocketManager } from "./WebSocketManager";
import { OrderState, OrderStatus } from "../types/order";

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

  triggerError(error: Error) {
    if (this.onerror) {
      this.onerror(error);
    }
  }
}

describe("WebSocketManager", () => {
  let manager: WebSocketManager;
  let mockWs1: MockWebSocket;
  let mockWs2: MockWebSocket;

  beforeEach(() => {
    manager = new WebSocketManager();
    mockWs1 = new MockWebSocket();
    mockWs2 = new MockWebSocket();
  });

  afterEach(() => {
    // Clean up
    manager = new WebSocketManager();
  });

  describe("registerClient", () => {
    it("should register a new client", () => {
      manager.registerClient("client-1", mockWs1 as any);

      expect(manager.getClientCount()).toBe(1);
    });

    it("should handle client disconnect", () => {
      manager.registerClient("client-1", mockWs1 as any);
      expect(manager.getClientCount()).toBe(1);

      mockWs1.close();
      expect(manager.getClientCount()).toBe(0);
    });

    it("should handle multiple clients", () => {
      manager.registerClient("client-1", mockWs1 as any);
      manager.registerClient("client-2", mockWs2 as any);

      expect(manager.getClientCount()).toBe(2);
    });
  });

  describe("subscribeToOrder", () => {
    it("should subscribe a client to order updates", () => {
      manager.registerClient("client-1", mockWs1 as any);
      manager.subscribeToOrder("client-1", "order-1");

      const order: OrderState = {
        id: "order-1",
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
        status: "pending",
        statusHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      manager.broadcastOrderUpdate(order);

      expect(mockWs1.messages.length).toBe(1);
      const message = JSON.parse(mockWs1.messages[0]);
      expect(message.type).toBe("status_update");
      expect(message.orderId).toBe("order-1");
    });

    it("should allow multiple clients to subscribe to same order", () => {
      manager.registerClient("client-1", mockWs1 as any);
      manager.registerClient("client-2", mockWs2 as any);
      manager.subscribeToOrder("client-1", "order-1");
      manager.subscribeToOrder("client-2", "order-1");

      const order: OrderState = {
        id: "order-1",
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
        status: "pending",
        statusHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      manager.broadcastOrderUpdate(order);

      expect(mockWs1.messages.length).toBe(1);
      expect(mockWs2.messages.length).toBe(1);
    });
  });

  describe("broadcastOrderUpdate", () => {
    it("should broadcast status updates to subscribed clients", () => {
      manager.registerClient("client-1", mockWs1 as any);
      manager.subscribeToOrder("client-1", "order-1");

      const order: OrderState = {
        id: "order-1",
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
        status: "routing",
        statusHistory: [
          {
            status: "pending",
            timestamp: new Date().toISOString(),
          },
          {
            status: "routing",
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      manager.broadcastOrderUpdate(order);

      expect(mockWs1.messages.length).toBe(1);
      const message = JSON.parse(mockWs1.messages[0]);
      expect(message.type).toBe("status_update");
      expect(message.status).toBe("routing");
      expect(message.order).toBeDefined();
      expect(message.order.status).toBe("routing");
    });

    it("should not send to unsubscribed clients", () => {
      manager.registerClient("client-1", mockWs1 as any);
      manager.registerClient("client-2", mockWs2 as any);
      manager.subscribeToOrder("client-1", "order-1");
      // client-2 is not subscribed

      const order: OrderState = {
        id: "order-1",
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
        status: "pending",
        statusHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      manager.broadcastOrderUpdate(order);

      expect(mockWs1.messages.length).toBe(1);
      expect(mockWs2.messages.length).toBe(0);
    });

    it("should handle closed connections gracefully", () => {
      manager.registerClient("client-1", mockWs1 as any);
      manager.subscribeToOrder("client-1", "order-1");

      mockWs1.readyState = 3; // CLOSED

      const order: OrderState = {
        id: "order-1",
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
        status: "pending",
        statusHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      manager.broadcastOrderUpdate(order);

      // Should not send to closed connection
      expect(mockWs1.messages.length).toBe(0);
    });
  });

  describe("status lifecycle", () => {
    it("should broadcast all status transitions in order", () => {
      const statuses: OrderStatus[] = ["pending", "routing", "building", "submitted", "confirmed"];
      const receivedStatuses: OrderStatus[] = [];

      manager.registerClient("client-1", mockWs1 as any);
      manager.subscribeToOrder("client-1", "order-1");

      statuses.forEach((status) => {
        const order: OrderState = {
          id: "order-1",
          tokenIn: "SOL",
          tokenOut: "USDC",
          amountIn: "100",
          status,
          statusHistory: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        manager.broadcastOrderUpdate(order);
      });

      mockWs1.messages.forEach((msg) => {
        const message = JSON.parse(msg);
        receivedStatuses.push(message.status);
      });

      expect(receivedStatuses).toEqual(statuses);
    });
  });
});

