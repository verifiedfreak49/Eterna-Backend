# Architecture Documentation

## System Overview

The Order Execution Engine is a microservices-style backend system designed to handle high-throughput order processing with real-time status updates. It follows an event-driven architecture with clear separation of concerns.

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                           │
│  (HTTP REST API + WebSocket Connections)                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   Fastify HTTP Server                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Routes Layer                                         │  │
│  │  - POST /api/orders/execute                          │  │
│  │  - GET /api/orders/:orderId                          │  │
│  │  - GET /api/orders/:orderId/ws (WebSocket)          │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Controllers Layer                                    │  │
│  │  - Request validation (Zod)                          │  │
│  │  - Order creation                                    │  │
│  │  - Database persistence                             │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Persistence Layer                           │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │   PostgreSQL     │         │      Redis       │         │
│  │   (Prisma ORM)  │         │   (BullMQ Queue)│         │
│  │                  │         │                  │         │
│  │  - Orders table │         │  - Job queue     │         │
│  │  - Status       │         │  - Job state     │         │
│  │    history      │         │  - Retry logic   │         │
│  └──────────────────┘         └──────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Processing Layer                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  BullMQ Workers (10+ concurrent)                    │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │  Order Worker                                 │   │  │
│  │  │  1. Update status: pending → routing          │   │  │
│  │  │  2. Call DEX Router                           │   │  │
│  │  │  3. Update status: routing → building        │   │  │
│  │  │  4. Build transaction                         │   │  │
│  │  │  5. Update status: building → submitted       │   │  │
│  │  │  6. Execute swap                              │   │  │
│  │  │  7. Update status: submitted → confirmed      │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  DEX Router (Mock)                                    │  │
│  │  - Raydium quote fetching                            │  │
│  │  - Meteora quote fetching                            │  │
│  │  - Best quote selection                              │  │
│  │  - Swap execution simulation                         │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Notification Layer                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  WebSocket Manager                                   │  │
│  │  - Client connection management                      │  │
│  │  - Order subscription tracking                       │  │
│  │  - Status update broadcasting                       │  │
│  │  - Graceful disconnect handling                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Order Execution Flow

1. **Client Request**
   - POST `/api/orders/execute` with order details
   - Controller validates request using Zod schema
   - Creates order record in PostgreSQL with `pending` status

2. **Queue Enqueue**
   - Order job added to BullMQ queue
   - Job ID matches order ID (prevents duplicates)
   - Returns orderId to client

3. **Worker Processing**
   - Worker picks up job from queue
   - Updates status: `pending → routing`
   - Calls DEX Router to get best quote
   - Updates status: `routing → building`
   - Simulates transaction building
   - Updates status: `building → submitted`
   - Executes swap on selected DEX
   - Updates status: `submitted → confirmed`
   - Stores transaction hash

4. **Status Updates**
   - Each status change:
     - Persisted to PostgreSQL with timestamp
     - Added to `statusHistory` JSONB array
     - Broadcast via WebSocket to subscribed clients

### WebSocket Flow

1. **Connection**
   - Client connects to `/api/orders/:orderId/ws`
   - WebSocketManager registers client
   - Client subscribed to order updates

2. **Status Broadcasting**
   - Worker updates order status
   - WebSocketManager broadcasts to all subscribed clients
   - Message includes full order state and timestamp

3. **Disconnection**
   - Client disconnect detected
   - Client unregistered from all subscriptions
   - Cleanup performed

## Database Schema

### Orders Table

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  tokenIn VARCHAR(255) NOT NULL,
  tokenOut VARCHAR(255) NOT NULL,
  amountIn VARCHAR(255) NOT NULL,
  dexUsed VARCHAR(100),
  executedPrice VARCHAR(255),
  txHash VARCHAR(255),
  status VARCHAR(50) NOT NULL,
  statusHistory JSONB DEFAULT '[]',
  failureReason TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(createdAt);
```

### Status History Structure

```json
[
  {
    "status": "pending",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "metadata": {}
  },
  {
    "status": "routing",
    "timestamp": "2024-01-01T00:00:00.200Z",
    "metadata": {}
  },
  {
    "status": "building",
    "timestamp": "2024-01-01T00:00:00.500Z",
    "metadata": {
      "dexUsed": "raydium",
      "executedPrice": "105.5"
    }
  }
]
```

## Queue Configuration

### BullMQ Settings

- **Queue Name**: `order-execution`
- **Concurrency**: 10 workers
- **Rate Limit**: 100 jobs/minute
- **Retry Strategy**: Exponential backoff
  - Attempts: 3
  - Initial delay: 2s
  - Multiplier: 2x (2s, 4s, 8s)
- **Job Retention**:
  - Completed: 1 hour or 1000 jobs
  - Failed: 24 hours

### Worker Behavior

- Processes jobs concurrently (up to 10)
- Each job goes through complete lifecycle
- On failure: stores reason, updates status to `failed`, triggers retry
- After max retries: job marked as failed, no further processing

## DEX Router Logic

### Quote Fetching

1. **Parallel Requests**
   - Fetch quotes from Raydium and Meteora simultaneously
   - Each quote includes: price, amountOut, estimatedGas

2. **Price Variance**
   - Random variance: 2-5%
   - Applied independently to each DEX quote
   - Simulates real market conditions

3. **Best Quote Selection**
   - Compare `amountOut` from all quotes
   - Select DEX with highest output
   - Log decision for audit

4. **Execution**
   - Simulate 2-3s execution delay
   - Generate mock transaction hash
   - Return hash for persistence

## Error Handling

### Retry Strategy

- **Transient Errors**: Retried with exponential backoff
- **Permanent Errors**: Marked as failed after max retries
- **Failure Reason**: Stored in database and broadcast via WebSocket

### Error Types

1. **Validation Errors**: Returned immediately (400)
2. **Database Errors**: Logged, returned 500
3. **DEX Errors**: Retried, eventually failed if persistent
4. **WebSocket Errors**: Logged, connection cleaned up

## Scalability Considerations

### Horizontal Scaling

- **Stateless Workers**: Can run multiple instances
- **Redis Queue**: Shared across all workers
- **Database**: PostgreSQL handles concurrent writes
- **WebSocket**: Each server instance manages its own connections

### Performance Optimizations

- **Parallel DEX Queries**: Reduces routing latency
- **Connection Pooling**: Prisma manages database connections
- **Redis Connection Pooling**: ioredis handles connection reuse
- **Efficient Status Updates**: Batch database writes when possible

## Security Considerations

- **Input Validation**: Zod schemas validate all inputs
- **SQL Injection**: Prisma ORM prevents SQL injection
- **WebSocket**: Validate orderId on connection
- **Rate Limiting**: BullMQ rate limiter prevents queue flooding
- **Error Messages**: Don't expose internal details to clients

## Monitoring & Observability

### Logging

- Structured logging with Pino
- Log levels: debug (dev), info (prod)
- Key events logged:
  - Order creation
  - Status transitions
  - DEX routing decisions
  - Queue operations
  - WebSocket connections

### Metrics (Future)

- Orders processed per minute
- Average execution time
- Success/failure rates
- Queue depth
- WebSocket connection count

## Future Extensions

### Limit Orders

- Add `limitPrice` field to schema
- Modify routing logic to check price
- Use delayed jobs or watcher service

### Sniper Orders

- Add `sniperConditions` JSONB field
- Create background watcher service
- Trigger execution on condition match

### Real DEX Integration

- Replace MockDexRouter with real DEX SDKs
- Implement actual transaction signing
- Handle real transaction confirmations

