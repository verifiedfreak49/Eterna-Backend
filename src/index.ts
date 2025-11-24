import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { orderRoutes } from "./routes/orderRoutes";
import { getPrismaClient } from "./config/database";
import { getRedisClient } from "./config/redis";
import { orderWorker } from "./workers/orderWorker";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      transport:
        process.env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: {
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
              },
            }
          : undefined,
    },
  });

  // Register WebSocket plugin
  await fastify.register(websocket);

  // Health check endpoint
  fastify.get("/health", async () => {
    const prisma = getPrismaClient();
    const redis = getRedisClient();

    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`;

      // Check Redis connection
      await redis.ping();

      return {
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
          database: "connected",
          redis: "connected",
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  // Register order routes
  await fastify.register(orderRoutes, { prefix: "/api/orders" });

  return fastify;
}

async function start() {
  try {
    // Initialize database connection
    const prisma = getPrismaClient();
    await prisma.$connect();
    console.log("[Server] Database connected");

    // Initialize Redis connection
    const redis = getRedisClient();
    await redis.ping();
    console.log("[Server] Redis connected");

    // Build and start Fastify server
    const server = await buildServer();

    await server.listen({ port: PORT, host: HOST });
    console.log(`[Server] Order Execution Engine running on http://${HOST}:${PORT}`);
    console.log(`[Server] Health check: http://${HOST}:${PORT}/health`);
    console.log(`[Server] Order execution: POST http://${HOST}:${PORT}/api/orders/execute`);
    console.log(`[Server] WebSocket: ws://${HOST}:${PORT}/api/orders/:orderId/ws`);

    // Graceful shutdown
    const shutdown = async () => {
      console.log("[Server] Shutting down gracefully...");

      // Close server
      await server.close();

      // Close database connection
      await prisma.$disconnect();

      // Close Redis connection
      await redis.quit();

      // Close worker
      await orderWorker.close();

      console.log("[Server] Shutdown complete");
      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("[Server] Error starting server:", error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  start();
}

export { buildServer };

