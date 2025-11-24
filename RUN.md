# How to Run the Backend

## Quick Start (5 Steps)

### 1. Install Dependencies
```bash
pnpm install
# or
npm install
```

### 2. Setup Environment
```bash
cp .env.example .env
```
Edit `.env` and add your PostgreSQL and Redis connection strings.

### 3. Setup Database
```bash
pnpm prisma:generate
pnpm prisma:migrate dev
```

### 4. Start Redis
```bash
redis-server
```
Or if Redis is already running, skip this step.

### 5. Run the Server
```bash
pnpm dev
```

The server will start on **http://localhost:3000**

---

## Detailed Steps

### Prerequisites
- **Node.js 18+** - Check with `node -v`
- **PostgreSQL 14+** - Check with `psql --version`
- **Redis 6+** - Check with `redis-cli ping`

### Step-by-Step

#### 1. Install Dependencies
```bash
pnpm install
```

#### 2. Configure Environment Variables
```bash
cp .env.example .env
```

Edit `.env` file:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/eterna_orders?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=3000
NODE_ENV=development
```

**Important:** Replace `username` and `password` with your PostgreSQL credentials.

#### 3. Create Database (if needed)
```bash
createdb eterna_orders
```

#### 4. Generate Prisma Client
```bash
pnpm prisma:generate
```

#### 5. Run Database Migrations
```bash
pnpm prisma:migrate dev
```

#### 6. Start Redis Server
Open a new terminal window:
```bash
redis-server
```

Or verify Redis is running:
```bash
redis-cli ping
# Should return: PONG
```

#### 7. Start the Backend Server

**Development mode (recommended):**
```bash
pnpm dev
```

**Production mode:**
```bash
pnpm build
pnpm start
```

---

## Verify It's Running

### Health Check
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### Test Order Execution
```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amountIn": "100",
    "orderType": "market"
  }'
```

---

## Common Commands

```bash
# Development
pnpm dev              # Start with hot reload

# Production
pnpm build            # Build TypeScript
pnpm start            # Start production server

# Database
pnpm prisma:generate  # Generate Prisma client
pnpm prisma:migrate   # Run migrations
pnpm prisma:studio    # Open database GUI

# Testing
pnpm test             # Run tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report
```

---

## Troubleshooting

### ❌ Database Connection Error
```bash
# Check PostgreSQL is running
pg_isready

# Verify DATABASE_URL in .env
# Create database if missing
createdb eterna_orders
```

### ❌ Redis Connection Error
```bash
# Check Redis is running
redis-cli ping

# Start Redis if not running
redis-server
```

### ❌ Port 3000 Already in Use
```bash
# Option 1: Change PORT in .env
PORT=3001

# Option 2: Kill process on port 3000
lsof -ti:3000 | xargs kill
```

### ❌ Module Not Found Errors
```bash
# Reinstall dependencies
rm -rf node_modules
pnpm install
```

---

## WebSocket Testing

After creating an order, connect to WebSocket:

```bash
# Install wscat
npm install -g wscat

# Connect (replace ORDER_ID with actual order ID)
wscat -c ws://localhost:3000/api/orders/ORDER_ID/ws
```

You'll see real-time status updates:
- `pending`
- `routing`
- `building`
- `submitted`
- `confirmed`

---

## API Endpoints

- **POST** `/api/orders/execute` - Execute a new order
- **GET** `/api/orders/:orderId` - Get order details
- **GET** `/api/orders` - List all orders
- **GET** `/api/orders/:orderId/ws` - WebSocket connection
- **GET** `/health` - Health check

---

## Need More Help?

- See `README.md` for detailed documentation
- See `QUICKSTART.md` for quick reference
- See `ARCHITECTURE.md` for system design

