#!/bin/bash

# Setup script for Order Execution Engine

echo "🚀 Setting up Order Execution Engine..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if pnpm is installed, otherwise use npm
if command -v pnpm &> /dev/null; then
    PACKAGE_MANAGER="pnpm"
    echo "✅ Using pnpm"
else
    PACKAGE_MANAGER="npm"
    echo "✅ Using npm"
fi

# Install dependencies
echo "📦 Installing dependencies..."
$PACKAGE_MANAGER install

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your database and Redis configuration"
else
    echo "✅ .env file exists"
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
$PACKAGE_MANAGER run prisma:generate

# Check if database is configured
if grep -q "postgresql://user:password@localhost" .env 2>/dev/null; then
    echo "⚠️  Please update DATABASE_URL in .env before running migrations"
else
    echo "📊 Running database migrations..."
    $PACKAGE_MANAGER run prisma:migrate
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your PostgreSQL and Redis connection strings"
echo "2. Run migrations: $PACKAGE_MANAGER run prisma:migrate"
echo "3. Start Redis: redis-server"
echo "4. Start the server: $PACKAGE_MANAGER run dev"
echo ""

