import { FastifyRequest, FastifyReply } from "fastify";
import { executeOrder, getOrder, getOrders } from "./orderController";
import { getPrismaClient } from "../config/database";
import { addOrderToQueue } from "../queue/orderQueue";

// Mock dependencies
jest.mock("../config/database");
jest.mock("../queue/orderQueue");

const mockPrisma = {
  order: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockAddOrderToQueue = addOrderToQueue as jest.MockedFunction<typeof addOrderToQueue>;

describe("OrderController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getPrismaClient as jest.Mock).mockReturnValue(mockPrisma);
  });

  describe("executeOrder", () => {
    const mockRequest = {
      body: {
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
        orderType: "market",
      },
    } as FastifyRequest<{ Body: any }>;

    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as unknown as FastifyReply;

    it("should create and execute a valid order", async () => {
      const mockOrder = {
        id: "test-order-id",
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
        status: "pending",
        createdAt: new Date(),
      };

      mockPrisma.order.create.mockResolvedValue(mockOrder);
      mockAddOrderToQueue.mockResolvedValue({} as any);

      await executeOrder(mockRequest, mockReply);

      expect(mockPrisma.order.create).toHaveBeenCalled();
      expect(mockAddOrderToQueue).toHaveBeenCalledWith({
        orderId: "test-order-id",
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
      });
      expect(mockReply.code).toHaveBeenCalledWith(201);
    });

    it("should reject invalid request body", async () => {
      const invalidRequest = {
        body: {
          tokenIn: "",
          tokenOut: "USDC",
          amountIn: "100",
        },
      } as FastifyRequest<{ Body: any }>;

      await executeOrder(invalidRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
    });

    it("should reject non-market order types", async () => {
      const limitOrderRequest = {
        body: {
          tokenIn: "SOL",
          tokenOut: "USDC",
          amountIn: "100",
          orderType: "limit",
        },
      } as FastifyRequest<{ Body: any }>;

      await executeOrder(limitOrderRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Only market orders are currently supported",
        })
      );
    });

    it("should handle database errors", async () => {
      mockPrisma.order.create.mockRejectedValue(new Error("Database error"));

      await executeOrder(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
    });
  });

  describe("getOrder", () => {
    const mockRequest = {
      params: { orderId: "test-order-id" },
    } as FastifyRequest<{ Params: { orderId: string } }>;

    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as unknown as FastifyReply;

    it("should return an order by ID", async () => {
      const mockOrder = {
        id: "test-order-id",
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: "100",
        status: "pending",
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      await getOrder(mockRequest, mockReply);

      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: "test-order-id" },
      });
      expect(mockReply.send).toHaveBeenCalledWith(mockOrder);
    });

    it("should return 404 for non-existent order", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await getOrder(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(404);
    });
  });

  describe("getOrders", () => {
    const mockRequest = {
      query: {},
    } as FastifyRequest<{ Querystring: { status?: string; limit?: string } }>;

    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as unknown as FastifyReply;

    it("should return all orders", async () => {
      const mockOrders = [
        { id: "order-1", status: "pending" },
        { id: "order-2", status: "confirmed" },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);

      await getOrders(mockRequest, mockReply);

      expect(mockPrisma.order.findMany).toHaveBeenCalled();
      expect(mockReply.send).toHaveBeenCalledWith(mockOrders);
    });

    it("should filter by status", async () => {
      const mockRequestWithStatus = {
        query: { status: "pending" },
      } as FastifyRequest<{ Querystring: { status?: string; limit?: string } }>;

      mockPrisma.order.findMany.mockResolvedValue([]);

      await getOrders(mockRequestWithStatus, mockReply);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        where: { status: "pending" },
        take: 100,
        orderBy: { createdAt: "desc" },
      });
    });
  });
});

