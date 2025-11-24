import { FastifyInstance } from "fastify";
import { executeOrder, getOrder, getOrders } from "../controllers/orderController";
import { wsManager } from "../websocket/WebSocketManager";
import { v4 as uuidv4 } from "uuid";

/**
 * Order routes
 * 
 * POST /api/orders/execute - Execute a new order
 * GET /api/orders/:orderId - Get order by ID
 * GET /api/orders - Get all orders (with optional filtering)
 * GET /api/orders/:orderId/ws - WebSocket connection for order updates
 */
export async function orderRoutes(fastify: FastifyInstance) {
  // Execute order endpoint
  fastify.post("/execute", executeOrder);

  // Get order by ID
  fastify.get("/:orderId", getOrder);

  // Get all orders
  fastify.get("/", getOrders);

  // WebSocket endpoint for order updates
  fastify.get("/:orderId/ws", { websocket: true }, (connection, req) => {
    const { orderId } = req.params as { orderId: string };
    const clientId = uuidv4();

    console.log(`[WebSocket] New connection for order ${orderId}, client ${clientId}`);

    // Register client
    wsManager.registerClient(clientId, connection.socket);

    // Subscribe to order updates
    wsManager.subscribeToOrder(clientId, orderId);

    // Send initial connection confirmation
    connection.socket.send(
      JSON.stringify({
        type: "connected",
        orderId,
        clientId,
        timestamp: new Date().toISOString(),
      })
    );

    // Handle incoming messages (optional - for ping/pong)
    connection.socket.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "ping") {
          connection.socket.send(
            JSON.stringify({
              type: "pong",
              timestamp: new Date().toISOString(),
            })
          );
        }
      } catch (error) {
        console.error("[WebSocket] Error parsing message:", error);
      }
    });
  });
}

