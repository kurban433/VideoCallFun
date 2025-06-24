#!/bin/bash

# Video Call App Deployment Script

set -e

echo "🚀 Starting deployment process..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Set environment variables
export NODE_ENV=production

# Check if ALLOWED_ORIGIN is set
if [ -z "$ALLOWED_ORIGIN" ]; then
    echo "⚠️  ALLOWED_ORIGIN not set. Using default '*'"
    export ALLOWED_ORIGIN="*"
fi

# Check if PORT is set
if [ -z "$PORT" ]; then
    echo "⚠️  PORT not set. Using default 3000"
    export PORT=3000
fi

echo "🔧 Environment configuration:"
echo "   NODE_ENV: $NODE_ENV"
echo "   PORT: $PORT"
echo "   ALLOWED_ORIGIN: $ALLOWED_ORIGIN"

# Start the application
echo "🚀 Starting the application..."
npm start 