import { Queue, Worker, Job } from "bullmq";
import { getRedisClient } from "../config/redis";
import { OrderJobData } from "../types/order";

export const ORDER_QUEUE_NAME = "order-execution";

/**
 * Order Execution Queue
 * Handles order processing with BullMQ
 * Configuration:
 * - Concurrency: 10+ workers
 * - Max retries: 3 with exponential backoff
 * - Can handle 100+ orders/minute
 */
export const orderQueue = new Queue<OrderJobData>(ORDER_QUEUE_NAME, {
  connection: getRedisClient(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000, // Start with 2s delay, then 4s, then 8s
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
});

/**
 * Add order to execution queue
 */
export async function addOrderToQueue(jobData: OrderJobData): Promise<Job<OrderJobData>> {
  const job = await orderQueue.add("execute-order", jobData, {
    jobId: jobData.orderId, // Use orderId as jobId to prevent duplicates
  });

  console.log(`[Queue] Added order ${jobData.orderId} to execution queue`);
  return job;
}

/**
 * Get queue metrics
 */
export async function getQueueMetrics() {
  const [waiting, active, completed, failed] = await Promise.all([
    orderQueue.getWaitingCount(),
    orderQueue.getActiveCount(),
    orderQueue.getCompletedCount(),
    orderQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
  };
}

