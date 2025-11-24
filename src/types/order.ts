export type OrderStatus =
  | "pending"
  | "routing"
  | "building"
  | "submitted"
  | "confirmed"
  | "failed";

export interface OrderRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  orderType?: "market"; // Currently only market orders supported
}

export interface OrderResponse {
  orderId: string;
  status: OrderStatus;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  createdAt: string;
}

export interface OrderState {
  id: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  dexUsed?: string;
  executedPrice?: string;
  txHash?: string;
  status: OrderStatus;
  statusHistory: StatusTransition[];
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatusTransition {
  status: OrderStatus;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface WebSocketMessage {
  type: "status_update";
  orderId: string;
  status: OrderStatus;
  order: OrderState;
  timestamp: string;
}

export interface DexQuote {
  dex: string;
  price: string;
  amountOut: string;
  estimatedGas?: string;
}

export interface OrderJobData {
  orderId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  wsClientId?: string;
}

