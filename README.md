# Order Execution Engine

A high-performance backend Order Execution Engine built with Node.js, TypeScript, Fastify, BullMQ, and PostgreSQL. This system handles market order execution with DEX routing, queue-based processing, and real-time WebSocket status updates.

## 🚀 Features

- **Market Order Execution**: Execute market orders with automatic DEX routing
- **DEX Router**: Mock router supporting Raydium and Meteora with intelligent quote comparison
- **Queue Processing**: BullMQ-based queue system handling 100+ orders/minute with 10+ concurrent workers
- **Real-time Updates**: WebSocket streaming of order lifecycle status
- **Status Persistence**: Complete audit trail of all order state transitions
- **Retry Logic**: Exponential backoff retry mechanism (max 3 attempts)
- **Comprehensive Testing**: 10+ unit and integration tests

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+
- pnpm or npm

## 🛠 Installation

1. **Clone the repository**
```bash
git clone https://github.com/projecthub12/eternabackend.git
cd eternabackend
```

2. **Install dependencies**
```bash
pnpm install
# or
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/eterna_orders?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=3000
NODE_ENV=development
```

4. **Set up database**
```bash
# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate
```

5. **Start Redis** (if not running)
```bash
redis-server
```

## 🏃 Running the Application

**Development mode:**
```bash
pnpm dev
```

**Production mode:**
```bash
pnpm build
pnpm start
```

The server will start on `http://localhost:3000`

## 📡 API Endpoints

### POST /api/orders/execute
Execute a new market order.

**Request:**
```json
{
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amountIn": "100",
  "orderType": "market"
}
```

**Response:**
```json
{
  "orderId": "uuid-here",
  "status": "pending",
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amountIn": "100",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### GET /api/orders/:orderId
Get order details by ID.

### GET /api/orders
Get all orders (supports `?status=pending` and `?limit=100` query params).

### GET /api/orders/:orderId/ws
WebSocket endpoint for real-time order status updates.

**WebSocket Message Format:**
```json
{
  "type": "status_update",
  "orderId": "uuid-here",
  "status": "routing",
  "order": {
    "id": "uuid-here",
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amountIn": "100",
    "status": "routing",
    "statusHistory": [...],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:01.000Z"
  },
  "timestamp": "2024-01-01T00:00:01.000Z"
}
```

### GET /health
Health check endpoint.

## 🔄 Order Lifecycle

Orders progress through the following statuses in sequence:

1. **pending** - Order created and queued
2. **routing** - Finding best DEX quote
3. **building** - Building transaction
4. **submitted** - Transaction submitted to DEX
5. **confirmed** - Transaction confirmed on-chain
6. **failed** - Order failed (with failure reason)

Each status transition is:
- Persisted to PostgreSQL with timestamp
- Broadcast via WebSocket to subscribed clients
- Stored in `statusHistory` JSONB field for audit trail

## 🏗 Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP POST
       ▼
┌─────────────────┐      ┌──────────────┐
│  Fastify API    │─────▶│  PostgreSQL │
│  /api/orders/   │      │   (Orders)  │
│     execute     │      └──────────────┘
└────────┬────────┘
         │
         │ Queue Job
         ▼
┌─────────────────┐      ┌──────────────┐
│   BullMQ Queue  │─────▶│    Redis     │
│   (Order Jobs)  │      │   (Queue)    │
└────────┬────────┘      └──────────────┘
         │
         │ Worker Processing
         ▼
┌─────────────────┐
│  Order Worker   │
│  (10+ workers)  │
└────────┬────────┘
         │
         ├─▶ MockDexRouter (Raydium/Meteora)
         │
         ├─▶ Status Updates → PostgreSQL
         │
         └─▶ WebSocket Broadcast
```

### Key Components

- **Controllers**: Handle HTTP requests and validation
- **Workers**: Process orders through lifecycle with BullMQ
- **DEX Router**: Mock router simulating Raydium and Meteora quotes
- **WebSocket Manager**: Manages client connections and broadcasts
- **Queue**: BullMQ queue with Redis backend
- **Database**: PostgreSQL with Prisma ORM

## 🧪 Testing

Run all tests:
```bash
pnpm test
```

Run tests in watch mode:
```bash
pnpm test:watch
```

Run tests with coverage:
```bash
pnpm test:coverage
```

### Test Coverage

- ✅ DEX routing logic correctness
- ✅ Queue processing & retry behavior
- ✅ WebSocket lifecycle (mocked)
- ✅ Status persistence updates
- ✅ Order validation
- ✅ Integration tests for complete flow

## 📊 Why Market Orders?

Market orders were chosen as the default order type because:

1. **Simplicity**: Immediate execution at current market price simplifies the routing and execution logic
2. **User Experience**: Users get instant execution without waiting for price conditions
3. **DEX Compatibility**: Most DEXes handle market orders natively with better liquidity
4. **Foundation**: Provides a solid base for extending to limit and sniper orders

## 🔮 Extending to Limit and Sniper Orders

### Limit Orders

To add limit order support:

1. **Schema Extension**: Add `limitPrice` field to Order model
2. **Validation**: Check if `orderType === "limit"` and validate `limitPrice`
3. **Routing Logic**: In `MockDexRouter.getBestQuote()`, compare market price with `limitPrice`
4. **Execution**: Only proceed if market price reaches or exceeds limit price
5. **Queue Strategy**: Use delayed jobs or a watcher service to monitor price

Example extension point in `MockDexRouter.ts`:
```typescript
async getBestQuote(tokenIn, tokenOut, amountIn, limitPrice?) {
  const quote = await this.fetchQuotes(...);
  if (limitPrice && parseFloat(quote.price) < parseFloat(limitPrice)) {
    throw new Error("Market price below limit price");
  }
  return quote;
}
```

### Sniper Orders

To add sniper order support:

1. **Schema Extension**: Add `sniperConditions` JSONB field (price, volume, time windows)
2. **Watcher Service**: Create a background service monitoring blockchain events
3. **Trigger Logic**: When conditions match, automatically execute the order
4. **Queue Integration**: Use BullMQ scheduled jobs to check conditions periodically
5. **Execution**: Once triggered, process like a market order

Example architecture:
```typescript
// New service: src/services/sniperWatcher.ts
class SniperWatcher {
  async watchOrder(orderId: string, conditions: SniperConditions) {
    // Monitor blockchain for matching conditions
    // When matched, trigger order execution
  }
}
```

## 📁 Project Structure

```
src/
├── config/          # Database and Redis configuration
├── controllers/     # HTTP request handlers
├── dex/            # DEX router implementation
├── queue/          # BullMQ queue setup
├── routes/         # Fastify route definitions
├── tests/          # Test files
│   ├── integration/
│   └── unit/
├── types/          # TypeScript type definitions
├── websocket/      # WebSocket manager
├── workers/        # BullMQ workers
└── index.ts        # Application entry point
```

## 🔧 Configuration

### Queue Settings

- **Concurrency**: 10 workers (configurable in `orderWorker.ts`)
- **Rate Limit**: 100 orders/minute
- **Retry**: 3 attempts with exponential backoff (2s, 4s, 8s)

### DEX Router Settings

- **Price Variance**: 2-5% random variance
- **Routing Delay**: 200-300ms per DEX quote
- **Execution Delay**: 2-3 seconds (simulated)

## 🚢 Deployment

### Environment Variables for Production

```env
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
PORT=3000
NODE_ENV=production
```

### Recommended Platforms

- **Render**: Easy PostgreSQL + Redis setup
- **Fly.io**: Good for containerized deployments
- **Railway**: Simple database + app deployment
- **Vercel**: For serverless (with adjustments)

### Deployment Steps

1. Set up PostgreSQL database
2. Set up Redis instance
3. Configure environment variables
4. Run migrations: `pnpm prisma:migrate deploy`
5. Build: `pnpm build`
6. Start: `pnpm start`

## 📝 API Collection

A Postman/Insomnia collection is available in `postman/` directory (to be created).

## 🐛 Troubleshooting

**Database connection issues:**
- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check network connectivity

**Redis connection issues:**
- Verify `REDIS_URL` is correct
- Ensure Redis is running
- Check Redis authentication if configured

**Queue not processing:**
- Verify Redis connection
- Check worker logs for errors
- Ensure worker is started (auto-started with server)

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please ensure:
- All tests pass
- Code follows TypeScript best practices
- New features include tests

## 📧 Support

For issues and questions, please open an issue on GitHub.

