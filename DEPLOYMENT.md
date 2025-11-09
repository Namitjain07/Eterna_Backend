# Deployment Guide

This guide covers deploying the ETERNA Order Execution Engine to various platforms.

## Local Development with Docker

### Prerequisites
- Docker Desktop installed
- Docker Compose installed

### Steps

1. **Start services:**
```bash
docker-compose up -d postgres redis
```

2. **Run application in development mode:**
```bash
npm run dev
```

3. **Access the application:**
- API: http://localhost:3000
- Health: http://localhost:3000/health

## Production Deployment

### Option 1: Render (Recommended - Free Tier)

1. **Create account** at [render.com](https://render.com)

2. **Create PostgreSQL database:**
   - Click "New" → "PostgreSQL"
   - Choose free tier
   - Copy the "Internal Database URL"

3. **Create Redis instance:**
   - Click "New" → "Redis"
   - Choose free tier
   - Copy the "Internal Redis URL"

4. **Create Web Service:**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: eterna-order-engine
     - **Environment**: Node
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Plan**: Free

5. **Add Environment Variables:**
   ```
   NODE_ENV=production
   PORT=3000
   DB_HOST=<from postgres internal url>
   DB_PORT=5432
   DB_NAME=<from postgres internal url>
   DB_USER=<from postgres internal url>
   DB_PASSWORD=<from postgres internal url>
   REDIS_HOST=<from redis internal url>
   REDIS_PORT=6379
   ```

6. **Deploy** - Render will automatically build and deploy

### Option 2: Railway (Free Tier with Credit)

1. **Install Railway CLI:**
```bash
npm install -g @railway/cli
```

2. **Login:**
```bash
railway login
```

3. **Initialize project:**
```bash
railway init
```

4. **Add PostgreSQL:**
```bash
railway add postgresql
```

5. **Add Redis:**
```bash
railway add redis
```

6. **Deploy:**
```bash
railway up
```

7. **Set environment variables:**
```bash
railway variables set NODE_ENV=production
```

### Option 3: Fly.io (Free Tier)

1. **Install Fly CLI:**
```bash
curl -L https://fly.io/install.sh | sh
```

2. **Login:**
```bash
fly auth login
```

3. **Launch app:**
```bash
fly launch
```

4. **Add PostgreSQL:**
```bash
fly postgres create
fly postgres attach <postgres-name>
```

5. **Add Redis:**
```bash
fly redis create
fly redis attach <redis-name>
```

6. **Deploy:**
```bash
fly deploy
```

## Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| NODE_ENV | Environment mode | development | No |
| PORT | Server port | 3000 | No |
| HOST | Server host | 0.0.0.0 | No |
| DB_HOST | PostgreSQL host | localhost | Yes |
| DB_PORT | PostgreSQL port | 5432 | Yes |
| DB_NAME | Database name | eterna_orders | Yes |
| DB_USER | Database user | postgres | Yes |
| DB_PASSWORD | Database password | postgres | Yes |
| REDIS_HOST | Redis host | localhost | Yes |
| REDIS_PORT | Redis port | 6379 | Yes |

## Health Checks

All platforms should configure health checks pointing to:
```
GET /health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-08T10:30:00.000Z"
}
```

## Monitoring

### Key Metrics to Monitor

1. **Queue Metrics** - `/api/queue/metrics`
   - Active jobs
   - Waiting jobs
   - Failed jobs
   - Processing rate

2. **Order Success Rate**
   - Monitor failed vs confirmed orders
   - Track retry counts

3. **DEX Routing Decisions**
   - Raydium vs Meteora selection ratio
   - Average price difference

### Logging

Application logs include:
- Order submissions
- DEX quote comparisons
- Routing decisions
- Execution results
- Error details with stack traces

## Scaling Considerations

### Horizontal Scaling
- Use Redis for distributed queue (already configured)
- Scale web service replicas in Render/Railway
- Ensure all instances connect to same PostgreSQL and Redis

### Vertical Scaling
- Increase worker concurrency in `src/queue/processor.ts`
- Adjust `QUEUE_CONCURRENCY` environment variable
- Monitor CPU and memory usage

### Database Optimization
- Add indexes for frequently queried columns (already configured)
- Set up read replicas for analytics queries
- Archive old orders periodically

## Troubleshooting

### Connection Issues
```bash
# Test PostgreSQL connection
psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Test Redis connection
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping
```

### Application Not Starting
1. Check logs: `railway logs` or Render dashboard
2. Verify environment variables are set
3. Ensure database is initialized: `npm run db:init`

### WebSocket Connection Fails
1. Check firewall allows WebSocket connections
2. Verify HOST is set to 0.0.0.0
3. Test with wscat: `wscat -c ws://localhost:3000/ws/orders/test-id`

## Security Considerations

### Production Checklist
- [ ] Set strong database passwords
- [ ] Enable SSL for database connections
- [ ] Use environment variables for all secrets
- [ ] Set up rate limiting
- [ ] Enable CORS with specific origins
- [ ] Implement authentication for API endpoints
- [ ] Set up monitoring and alerting
- [ ] Regular security updates

## Backup and Recovery

### Database Backups
```bash
# Backup
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > backup.sql

# Restore
psql -h $DB_HOST -U $DB_USER $DB_NAME < backup.sql
```

### Redis Persistence
Redis is configured with AOF persistence. Data persists across restarts.

## Support

For issues or questions:
- GitHub Issues: https://github.com/Namitjain07/Eterna_Backend/issues
- Email: [your-email]
