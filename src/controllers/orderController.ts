import { FastifyRequest, FastifyReply } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { OrderRequest, OrderResponse } from "../types/order";
import { getPrismaClient } from "../config/database";
import { addOrderToQueue } from "../queue/orderQueue";
import { wsManager } from "../websocket/WebSocketManager";

const prisma = getPrismaClient();

// Validation schema for order request
const orderRequestSchema = z.object({
  tokenIn: z.string().min(1, "tokenIn is required"),
  tokenOut: z.string().min(1, "tokenOut is required"),
  amountIn: z.string().regex(/^\d+(\.\d+)?$/, "amountIn must be a valid number"),
  orderType: z.enum(["market"]).optional().default("market"),
});

/**
 * Execute a market order
 * 
 * POST /api/orders/execute
 * 
 * This endpoint:
 * 1. Validates the request
 * 2. Creates and persists the order in PostgreSQL
 * 3. Adds the order to the BullMQ queue for processing
 * 4. Returns the orderId
 * 
 * The order will be processed asynchronously through the queue worker,
 * and status updates will be streamed via WebSocket.
 */
export async function executeOrder(
  request: FastifyRequest<{ Body: OrderRequest }>,
  reply: FastifyReply
): Promise<OrderResponse> {
  try {
    // Validate request body
    const validationResult = orderRequestSchema.safeParse(request.body);
    if (!validationResult.success) {
      return reply.code(400).send({
        error: "Validation error",
        details: validationResult.error.errors,
      });
    }

    const { tokenIn, tokenOut, amountIn, orderType = "market" } = validationResult.data;

    // Currently only market orders are supported
    // Future extension: Add limit and sniper order types
    if (orderType !== "market") {
      return reply.code(400).send({
        error: "Only market orders are currently supported",
      });
    }

    // Generate order ID
    const orderId = uuidv4();

    // Create order in database with initial "pending" status

    const initialStatusHistory = [
      {
        status : "pending",
        timestamp: new Date().toISOString(),
        metadata: {},
      },
    ];

    const order = await prisma.order.create({
      data: {
        id: orderId,
        tokenIn,
        tokenOut,
        amountIn,
        status: "pending",
        statusHistory: JSON.stringify(initialStatusHistory),
      },
    });

    console.log(`[Controller] Created order ${orderId} for ${amountIn} ${tokenIn} -> ${tokenOut}`);

    // Add order to execution queue
    await addOrderToQueue({
      orderId,
      tokenIn,
      tokenOut,
      amountIn,
    });

    // Return order response
    const response: OrderResponse = {
      orderId: order.id,
      status: order.status as any,
      tokenIn: order.tokenIn,
      tokenOut: order.tokenOut,
      amountIn: order.amountIn,
      createdAt: order.createdAt.toISOString(),
    };

    return reply.code(201).send(response);
  } catch (error) {
    console.error("[Controller] Error executing order:", error);
    return reply.code(500).send({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Get order by ID
 */
export async function getOrder(
  request: FastifyRequest<{ Params: { orderId: string } }>,
  reply: FastifyReply
) {
  try {
    const { orderId } = request.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return reply.code(404).send({
        error: "Order not found",
      });
    }

    return reply.send(order);
  } catch (error) {
    console.error("[Controller] Error fetching order:", error);
    return reply.code(500).send({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Get all orders with optional filtering
 */
export async function getOrders(
  request: FastifyRequest<{ Querystring: { status?: string; limit?: string } }>,
  reply: FastifyReply
) {
  try {
    const { status, limit } = request.query;
    const limitNum = limit ? parseInt(limit, 10) : 100;

    const orders = await prisma.order.findMany({
      where: status ? { status } : undefined,
      take: limitNum,
      orderBy: { createdAt: "desc" },
    });

    return reply.send(orders);
  } catch (error) {
    console.error("[Controller] Error fetching orders:", error);
    return reply.code(500).send({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

