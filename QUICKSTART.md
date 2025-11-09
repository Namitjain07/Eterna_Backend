# Quick Start Guide

Get the ETERNA Order Execution Engine running in 5 minutes!

## 🚀 Option 1: Docker (Easiest)

### Prerequisites
- Docker Desktop installed
- 5 minutes of your time

### Steps

```bash
# 1. Clone repository
git clone https://github.com/Namitjain07/Eterna_Backend.git
cd Eterna_Backend

# 2. Start services
docker-compose up -d

# 3. Check if everything is running
docker-compose ps

# 4. Test the server
curl http://localhost:3000/health
```

That's it! The API is now running at `http://localhost:3000`

### Test with a sample order

```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "market",
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amountIn": 10,
    "slippage": 0.01
  }'
```

## 🛠️ Option 2: Local Development

### Prerequisites
- Node.js 18+ installed
- PostgreSQL 15+ running
- Redis 7+ running

### Steps

```bash
# 1. Clone repository
git clone https://github.com/Namitjain07/Eterna_Backend.git
cd Eterna_Backend

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your database and Redis credentials

# 4. Initialize database
npm run db:init

# 5. Start development server
npm run dev
```

Server will start at `http://localhost:3000`

## 🧪 Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run with coverage
npm run test:coverage
```

## 📡 Testing the API

### Method 1: Using the test client

```bash
node test-client.js
```

This will:
1. Submit a test order
2. Connect to WebSocket
3. Display all status updates
4. Show final order details

### Method 2: Using Postman

1. Import the collection: `postman_collection.json`
2. Run "Submit Market Order - SOL to USDC"
3. Copy the `orderId` from response
4. Use a WebSocket client to connect to: `ws://localhost:3000/ws/orders/{orderId}`

### Method 3: Manual cURL + wscat

```bash
# 1. Submit order
ORDER_RESPONSE=$(curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "market",
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amountIn": 10,
    "slippage": 0.01
  }')

echo $ORDER_RESPONSE

# 2. Extract order ID (manually from above response)
ORDER_ID="<paste-order-id-here>"

# 3. Connect to WebSocket
npm install -g wscat
wscat -c "ws://localhost:3000/ws/orders/$ORDER_ID"
```

## 🎯 Testing Concurrent Orders

### Using Postman Runner

1. Open Postman collection
2. Select "Submit Multiple Orders (Batch Test)"
3. Click "Run"
4. Set iterations to 5-10
5. Watch queue metrics: `http://localhost:3000/api/queue/metrics`

### Using bash script

```bash
# Submit 5 orders concurrently
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/orders/execute \
    -H "Content-Type: application/json" \
    -d '{
      "type": "market",
      "tokenIn": "SOL",
      "tokenOut": "USDC",
      "amountIn": '$i',
      "slippage": 0.01
    }' &
done
wait

# Check queue metrics
curl http://localhost:3000/api/queue/metrics
```

## 📊 Monitoring

### View Logs
```bash
# Docker
docker-compose logs -f app

# Local
# Logs will appear in your terminal running npm run dev
```

### Check Queue Status
```bash
curl http://localhost:3000/api/queue/metrics
```

### Database Queries
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d eterna_orders

# Check recent orders
SELECT id, type, status, dex_used, created_at 
FROM orders 
ORDER BY created_at DESC 
LIMIT 10;

# Check order statistics
SELECT status, COUNT(*) as count 
FROM orders 
GROUP BY status;
```

## 🔧 Troubleshooting

### "Connection refused" error

**Problem**: Can't connect to server

**Solution**:
```bash
# Check if services are running
docker-compose ps

# Restart services
docker-compose restart

# Check logs
docker-compose logs app
```

### "Database connection failed"

**Problem**: Can't connect to PostgreSQL

**Solution**:
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U postgres -d eterna_orders -c "SELECT 1;"

# Reinitialize database
npm run db:init
```

### "Redis connection failed"

**Problem**: Can't connect to Redis

**Solution**:
```bash
# Check Redis is running
docker-compose ps redis

# Test connection
docker-compose exec redis redis-cli ping
```

### Tests failing

**Problem**: Some tests are failing

**Solution**:
```bash
# Make sure services are running
docker-compose up -d postgres redis

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Run tests with verbose output
npm test -- --reporter=verbose
```

## 🎉 Next Steps

1. **Read the full README**: [README.md](./README.md)
2. **Check deployment guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
3. **Explore the code**: Start with `src/server.ts`
4. **Try the Postman collection**: Import `postman_collection.json`
5. **Deploy to production**: Follow deployment guide for Render/Railway/Fly.io

## 💡 Tips

- Use `npm run test:watch` during development for instant feedback
- Check queue metrics regularly to monitor system health
- Use tight slippage (0.001) to test error handling
- Submit multiple orders to see concurrent processing
- Monitor console logs to see DEX routing decisions

## 🆘 Need Help?

- Check the [README](./README.md) for detailed documentation
- Review the [tests](./tests/order.test.ts) for usage examples
- Open an issue on GitHub: https://github.com/Namitjain07/Eterna_Backend/issues

---

Happy trading! 🚀
