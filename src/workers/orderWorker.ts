import { Worker, Job } from "bullmq";
import { getRedisClient } from "../config/redis";
import { ORDER_QUEUE_NAME } from "../queue/orderQueue";
import { OrderJobData, OrderStatus } from "../types/order";
import { MockDexRouter } from "../dex/MockDexRouter";
import { getPrismaClient } from "../config/database";
import { wsManager } from "../websocket/WebSocketManager";

const prisma = getPrismaClient();
const dexRouter = new MockDexRouter();

/**
 * Order Execution Worker
 * Processes orders through the complete lifecycle:
 * pending → routing → building → submitted → confirmed → failed
 */
export const orderWorker = new Worker<OrderJobData>(
  ORDER_QUEUE_NAME,
  async (job: Job<OrderJobData>) => {
    const { orderId, tokenIn, tokenOut, amountIn } = job.data;

    console.log(`[Worker] Processing order ${orderId}`);

    try {
      // Update status: pending → routing
      await updateOrderStatus(orderId, "routing", {});

      // Demo-friendly delay: allow time to open WebSocket
      await delay(3000);

      // Step 1: Route to best DEX (200-300ms delay)
      const bestQuote = await dexRouter.getBestQuote(tokenIn, tokenOut, amountIn);
      console.log(
        `[Worker] Best quote selected: ${bestQuote.dex} at price ${bestQuote.price}`
      );

      // Update status: routing → building
      await updateOrderStatus(orderId, "building", {
        dexUsed: bestQuote.dex,
        executedPrice: bestQuote.price,
      });

      // Step 2: Build transaction (simulated delay)
      await delay(4000); // making delay enough to notice status change

      // Update status: building → submitted
      await updateOrderStatus(orderId, "submitted", {
        dexUsed: bestQuote.dex,
        executedPrice: bestQuote.price,
      });

      // Step 3: Execute swap on DEX (2-3s delay)
      const txHash = await dexRouter.executeSwap(
        bestQuote.dex,
        tokenIn,
        tokenOut,
        amountIn
      );

      // Update status: submitted → confirmed
      await updateOrderStatus(orderId, "confirmed", {
        dexUsed: bestQuote.dex,
        executedPrice: bestQuote.price,
        txHash,
      });

      console.log(
        `[Worker] Order ${orderId} completed successfully with txHash ${txHash}`
      );
      return { success: true, txHash };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Worker] Order ${orderId} failed:`, errorMessage);

      // Update status: any → failed
      await updateOrderStatus(orderId, "failed", {
        failureReason: errorMessage,
      });

      throw error; // Re-throw to trigger retry mechanism
    }
  },
  {
    connection: getRedisClient(),
    concurrency: 10, // Process 10 orders concurrently
    limiter: {
      max: 100, // Max 100 jobs
      duration: 60000, // Per minute
    },
  }
);

/**
 * Update order status in database and broadcast via WebSocket
 */
async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  updates: {
    dexUsed?: string;
    executedPrice?: string;
    txHash?: string;
    failureReason?: string;
  }
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  // Parse current status history (stored as STRING in SQLite)
  let statusHistoryArray: Array<{
    status: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }> = [];

  try {
    if (order.statusHistory) {
      statusHistoryArray = JSON.parse(order.statusHistory as unknown as string);
      if (!Array.isArray(statusHistoryArray)) {
        statusHistoryArray = [];
      }
    }
  } catch {
    // If anything goes wrong parsing, reset to empty array
    statusHistoryArray = [];
  }

  // Add new status transition
  const newTransition = {
    status,
    timestamp: new Date().toISOString(),
    metadata: updates,
  };

  statusHistoryArray.push(newTransition);

  // Update order in database
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      statusHistory: JSON.stringify(statusHistoryArray), // 👈 store as string
      dexUsed: updates.dexUsed ?? order.dexUsed,
      executedPrice: updates.executedPrice ?? order.executedPrice,
      txHash: updates.txHash ?? order.txHash,
      failureReason: updates.failureReason ?? order.failureReason,
      updatedAt: new Date(),
    },
  });

  // Broadcast status update via WebSocket
  wsManager.broadcastOrderUpdate({
    id: updatedOrder.id,
    tokenIn: updatedOrder.tokenIn,
    tokenOut: updatedOrder.tokenOut,
    amountIn: updatedOrder.amountIn,
    dexUsed: updatedOrder.dexUsed ?? undefined,
    executedPrice: updatedOrder.executedPrice ?? undefined,
    txHash: updatedOrder.txHash ?? undefined,
    status: updatedOrder.status as OrderStatus,
    statusHistory: statusHistoryArray as any, // send parsed array to clients
    failureReason: updatedOrder.failureReason ?? undefined,
    createdAt: updatedOrder.createdAt.toISOString(),
    updatedAt: updatedOrder.updatedAt.toISOString(),
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Worker event handlers
orderWorker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

orderWorker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

orderWorker.on("error", (err) => {
  console.error("[Worker] Worker error:", err);
});
