import { WebSocket } from "@fastify/websocket";
import { WebSocketMessage, OrderState } from "../types/order";

/**
 * WebSocket Manager for broadcasting order status updates
 * Handles client connections and message broadcasting
 */
export class WebSocketManager {
  private clients: Map<string, WebSocket> = new Map();
  private orderClients: Map<string, Set<string>> = new Map(); // orderId -> Set of clientIds

  /**
   * Register a new WebSocket client
   */
  registerClient(clientId: string, ws: WebSocket): void {
    this.clients.set(clientId, ws);
    console.log(`[WebSocket] Client ${clientId} connected. Total clients: ${this.clients.size}`);

    ws.on("close", () => {
      this.unregisterClient(clientId);
    });

    ws.on("error", (error) => {
      console.error(`[WebSocket] Error for client ${clientId}:`, error);
      this.unregisterClient(clientId);
    });
  }

  /**
   * Subscribe a client to order updates
   */
  subscribeToOrder(clientId: string, orderId: string): void {
    if (!this.orderClients.has(orderId)) {
      this.orderClients.set(orderId, new Set());
    }
    this.orderClients.get(orderId)!.add(clientId);
    console.log(`[WebSocket] Client ${clientId} subscribed to order ${orderId}`);
  }

  /**
   * Unregister a WebSocket client
   */
  unregisterClient(clientId: string): void {
    this.clients.delete(clientId);

    // Remove from all order subscriptions
    for (const [orderId, clientSet] of this.orderClients.entries()) {
      clientSet.delete(clientId);
      if (clientSet.size === 0) {
        this.orderClients.delete(orderId);
      }
    }

    console.log(`[WebSocket] Client ${clientId} disconnected. Total clients: ${this.clients.size}`);
  }

  /**
   * Broadcast order status update to subscribed clients
   */
  broadcastOrderUpdate(order: OrderState): void {
    const message: WebSocketMessage = {
      type: "status_update",
      orderId: order.id,
      status: order.status,
      order,
      timestamp: new Date().toISOString(),
    };

    const subscribedClients = this.orderClients.get(order.id) || new Set();
    let sentCount = 0;

    for (const clientId of subscribedClients) {
      const ws = this.clients.get(clientId);
      if (ws && ws.readyState === 1) {
        // WebSocket.OPEN = 1
        try {
          ws.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error(`[WebSocket] Failed to send to client ${clientId}:`, error);
          this.unregisterClient(clientId);
        }
      } else {
        // Clean up stale connections
        this.unregisterClient(clientId);
      }
    }

    console.log(`[WebSocket] Broadcasted status update for order ${order.id} to ${sentCount} client(s)`);
  }

  /**
   * Get number of active clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();

