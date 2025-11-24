# Quick Start Guide

## Prerequisites Check

```bash
# Check Node.js version (requires 18+)
node -v

# Check if PostgreSQL is running
psql --version

# Check if Redis is running
redis-cli ping
```

## 5-Minute Setup

### 1. Install Dependencies

```bash
pnpm install
# or
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/eterna_orders?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=3000
```

### 3. Setup Database

```bash
# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate dev
```

### 4. Start Services

**Terminal 1 - Redis:**
```bash
redis-server
```

**Terminal 2 - Server:**
```bash
pnpm dev
```

### 5. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Execute an order
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amountIn": "100",
    "orderType": "market"
  }'
```

## WebSocket Testing

### Using wscat

```bash
# Install wscat
npm install -g wscat

# Connect to order WebSocket (replace ORDER_ID)
wscat -c ws://localhost:3000/api/orders/ORDER_ID/ws
```

### Using Browser Console

```javascript
const ws = new WebSocket('ws://localhost:3000/api/orders/YOUR_ORDER_ID/ws');
ws.onmessage = (event) => {
  console.log('Status update:', JSON.parse(event.data));
};
```

## Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

## Common Issues

### Database Connection Error
- Verify PostgreSQL is running: `pg_isready`
- Check DATABASE_URL in `.env`
- Ensure database exists: `createdb eterna_orders`

### Redis Connection Error
- Verify Redis is running: `redis-cli ping`
- Check REDIS_URL in `.env`
- Start Redis: `redis-server`

### Port Already in Use
- Change PORT in `.env`
- Or kill process: `lsof -ti:3000 | xargs kill`

## Next Steps

1. Import Postman collection from `postman/eterna-orders.postman_collection.json`
2. Read `README.md` for detailed documentation
3. Check `ARCHITECTURE.md` for system design
4. Review test files in `src/tests/` for usage examples

