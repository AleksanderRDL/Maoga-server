#!/bin/bash

echo "🚀 Setting up Maoga Backend - Sprint 1"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18 or higher."
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be 18 or higher. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p migrations

# Copy environment file
if [ ! -f .env ]; then
    echo "📋 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please update .env with your configuration"
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your configuration"
echo "2. Start MongoDB or use Docker Compose"
echo "3. Run 'npm run dev' to start backend and frontend together"
echo "   or 'npm run dev:backend' for backend only"
echo "4. Run 'npm test' to run backend tests"
