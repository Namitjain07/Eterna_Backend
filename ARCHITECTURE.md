# System Architecture

## High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Postman  │  │  cURL    │  │  Web UI  │  │   API    │      │
│  │          │  │          │  │          │  │  Client  │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       │             │             │             │              │
└───────┼─────────────┼─────────────┼─────────────┼──────────────┘
        │             │             │             │
        └──────┬──────┴─────┬───────┴──────┬──────┘
               │            │              │
        ┌──────▼────────────▼──────────────▼──────┐
        │          HTTP/WebSocket                  │
        │       (Fastify Server)                   │
        └──────┬───────────────────────────────────┘
               │
        ┌──────▼───────────────────────────────────┐
        │          API LAYER                       │
        │  ┌────────────────────────────────────┐  │
        │  │  POST /api/orders/execute          │  │
        │  │  → Validate order                  │  │
        │  │  → Create in DB                    │  │
        │  │  → Enqueue for processing          │  │
        │  │  → Return orderId + wsPath         │  │
        │  └────────────────────────────────────┘  │
        │  ┌────────────────────────────────────┐  │
        │  │  GET /ws/orders/:orderId           │  │
        │  │  → Register status callback        │  │
        │  │  → Stream updates via WebSocket    │  │
        │  └────────────────────────────────────┘  │
        └──────┬───────────────────────────────────┘
               │
        ┌──────▼───────────────────────────────────┐
        │        BUSINESS LOGIC LAYER              │
        │  ┌────────────────────────────────────┐  │
        │  │      Order Service                 │  │
        │  │  • Create orders                   │  │
        │  │  • Manage callbacks                │  │
        │  │  • Coordinate execution            │  │
        │  └────────────────────────────────────┘  │
        └──────┬───────────────────────────────────┘
               │
        ┌──────▼───────────────────────────────────┐
        │         QUEUE LAYER                      │
        │  ┌────────────────────────────────────┐  │
        │  │      BullMQ Queue                  │  │
        │  │  • 10 concurrent workers           │  │
        │  │  • 100 orders/minute limit         │  │
        │  │  • Exponential backoff retry       │  │
        │  │  • Job deduplication               │  │
        │  └────────────────────────────────────┘  │
        └──────┬───────────────────────────────────┘
               │
        ┌──────▼───────────────────────────────────┐
        │       EXECUTION LAYER                    │
        │  ┌────────────────────────────────────┐  │
        │  │      DEX Router                    │  │
        │  │  ┌──────────┐    ┌──────────┐     │  │
        │  │  │ Raydium  │    │ Meteora  │     │  │
        │  │  │ Quote    │    │ Quote    │     │  │
        │  │  └────┬─────┘    └────┬─────┘     │  │
        │  │       │               │            │  │
        │  │       └───────┬───────┘            │  │
        │  │               │                    │  │
        │  │        ┌──────▼──────┐             │  │
        │  │        │  Compare &  │             │  │
        │  │        │  Select Best│             │  │
        │  │        └──────┬──────┘             │  │
        │  │               │                    │  │
        │  │        ┌──────▼──────┐             │  │
        │  │        │   Execute   │             │  │
        │  │        │     Swap    │             │  │
        │  │        └─────────────┘             │  │
        │  └────────────────────────────────────┘  │
        └──────┬───────────────────────────────────┘
               │
        ┌──────▼───────────────────────────────────┐
        │        PERSISTENCE LAYER                 │
        │  ┌────────────────┐  ┌───────────────┐  │
        │  │  PostgreSQL    │  │     Redis     │  │
        │  │  • Orders      │  │  • Queue      │  │
        │  │  • History     │  │  • Cache      │  │
        │  └────────────────┘  └───────────────┘  │
        └──────────────────────────────────────────┘
```

## Order Execution Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    ORDER LIFECYCLE                              │
└────────────────────────────────────────────────────────────────┘

1. SUBMISSION
   Client                    Server                   Database
     │                         │                         │
     ├──POST /api/orders/─────>│                         │
     │   execute               │                         │
     │                         ├──Validate Order────────>│
     │                         │   (Zod Schema)          │
     │                         │                         │
     │                         ├──Create Order──────────>│
     │                         │   INSERT INTO orders    │
     │                         │<────Order Created───────┤
     │                         │                         │
     │                         ├──Enqueue────────>       │
     │<────Return orderId──────┤                   Redis │
     │     + wsPath            │                  Queue  │
     │                         │                         │

2. WEBSOCKET CONNECTION
   Client                    Server
     │                         │
     ├──Connect WS────────────>│
     │   /ws/orders/:id        │
     │                         ├──Register Callback
     │<────Connected───────────┤
     │                         │
     │<────Status: pending─────┤
     │                         │

3. QUEUE PROCESSING
   Queue Worker              Order Service           DEX Router
     │                         │                         │
     ├──Pick Job──────────────>│                         │
     │   from Queue            │                         │
     │                         │                         │
     │                         ├──Update: routing───────>│
     │                         │                         │
     │                         │<───Fetch Quotes────────┤
     │                         │   (Raydium + Meteora)  │
     │                         │                         │

4. DEX ROUTING
   DEX Router                                Status Updates
     │                                            │
     ├──getRaydiumQuote()                         │
     │  (200-250ms)                               │
     │                                            │
     ├──getMeteorQuote()                          │
     │  (200-250ms)                               │
     │                                            │
     ├──Compare Quotes                            │
     │  • Raydium: 9.971                          │
     │  • Meteora: 9.823                          │
     │  ✅ Select: Raydium                        │
     │                                            │
     ├──Update: building────────────────────────>│
     │                                            │
     ├──Update: submitted───────────────────────>│
     │                                            │
     ├──executeSwap()                             │
     │  (2-3 seconds)                             │
     │  • Build transaction                       │
     │  • Apply slippage check                    │
     │  • Generate txHash                         │
     │                                            │
     ├──Update: confirmed───────────────────────>│
     │  • txHash: abc123...                       │
     │  • executedPrice: 0.9971                   │
     │  • dexUsed: raydium                        │
     │                                            │

5. COMPLETION
   Order Service          Database              Client
     │                      │                      │
     ├──Update DB──────────>│                      │
     │  • status=confirmed  │                      │
     │  • txHash            │                      │
     │  • executedPrice     │                      │
     │<────Updated──────────┤                      │
     │                      │                      │
     ├──Send Final Status──────────────────────────>│
     │  {                                          │
     │    status: "confirmed",                     │
     │    txHash: "abc123...",                     │
     │    executedPrice: 0.9971,                   │
     │    dexUsed: "raydium"                       │
     │  }                                          │
     │                      │                      │
     ├──Close WebSocket────────────────────────────>│
     │                      │                      │
```

## Retry Logic Flow

```
┌────────────────────────────────────────────────────────────────┐
│                      RETRY MECHANISM                            │
└────────────────────────────────────────────────────────────────┘

Attempt 1 (Initial)
   ├──Execute Order
   │  └──❌ Failed (Network Error)
   │
   ├──Wait 1 second (2^0 * 1000ms)
   │
   └──Mark: retryCount = 1
       └──Update Status: failed (with retryCount)

Attempt 2 (First Retry)
   ├──Execute Order
   │  └──❌ Failed (Slippage Error)
   │
   ├──Wait 2 seconds (2^1 * 1000ms)
   │
   └──Mark: retryCount = 2
       └──Update Status: failed (with retryCount)

Attempt 3 (Second Retry)
   ├──Execute Order
   │  └──❌ Failed (DEX Unavailable)
   │
   ├──Wait 4 seconds (2^2 * 1000ms)
   │
   └──Mark: retryCount = 3
       └──Update Status: failed (with retryCount)

Final Failure
   ├──Max Retries Reached (3)
   │
   ├──Log Post-Mortem:
   │  • orderId
   │  • Total attempts: 3
   │  • Final error message
   │  • Timestamp
   │
   ├──Persist to Database:
   │  • status = 'failed'
   │  • error = 'DEX Unavailable'
   │  • retryCount = 3
   │
   └──Notify Client via WebSocket:
      {
        status: "failed",
        error: "DEX Unavailable",
        retryCount: 3
      }
```

## Concurrent Processing

```
┌────────────────────────────────────────────────────────────────┐
│              10 CONCURRENT WORKERS                              │
└────────────────────────────────────────────────────────────────┘

Redis Queue                Worker Pool
┌──────────┐              ┌─────────────────────────────────────┐
│ Order 1  │──────────────>│ Worker 1: Processing Order 1       │
│ Order 2  │──────────────>│ Worker 2: Processing Order 2       │
│ Order 3  │──────────────>│ Worker 3: Processing Order 3       │
│ Order 4  │──────────────>│ Worker 4: Processing Order 4       │
│ Order 5  │──────────────>│ Worker 5: Processing Order 5       │
│ Order 6  │──────────────>│ Worker 6: Processing Order 6       │
│ Order 7  │──────────────>│ Worker 7: Processing Order 7       │
│ Order 8  │──────────────>│ Worker 8: Processing Order 8       │
│ Order 9  │──────────────>│ Worker 9: Processing Order 9       │
│ Order 10 │──────────────>│ Worker 10: Processing Order 10     │
│ Order 11 │ ⏸ Waiting     └─────────────────────────────────────┘
│ Order 12 │ ⏸ Waiting
│ Order 13 │ ⏸ Waiting
│ ...      │
└──────────┘

Rate Limiting: 100 orders/minute
• Each worker processes 1 order at a time
• New orders wait in queue if all workers busy
• Workers pick next job as soon as they're free
• Failed jobs go back to queue with backoff delay
```

## Data Flow

```
┌────────────────────────────────────────────────────────────────┐
│                      DATA PERSISTENCE                           │
└────────────────────────────────────────────────────────────────┘

PostgreSQL (Long-term Storage)
┌─────────────────────────────────────────────────────────────┐
│ orders Table                                                 │
├──────────────┬──────────────┬──────────┬────────────────────┤
│ id           │ type         │ status   │ created_at         │
│ abc-123      │ market       │ confirmed│ 2025-11-08 10:30  │
│ def-456      │ market       │ pending  │ 2025-11-08 10:31  │
│ ghi-789      │ market       │ failed   │ 2025-11-08 10:32  │
├──────────────┴──────────────┴──────────┴────────────────────┤
│ • Order details (token pairs, amounts, slippage)             │
│ • Execution results (dex used, price, txHash)               │
│ • Error messages and retry counts                           │
│ • Timestamps for audit trail                                │
└─────────────────────────────────────────────────────────────┘

Redis (Temporary Queue & Cache)
┌─────────────────────────────────────────────────────────────┐
│ BullMQ Job Queue                                             │
├──────────────┬──────────────┬──────────┬────────────────────┤
│ Job ID       │ Order ID     │ Status   │ Attempts           │
│ job-1        │ abc-123      │ active   │ 1/3                │
│ job-2        │ def-456      │ waiting  │ 0/3                │
│ job-3        │ ghi-789      │ failed   │ 3/3                │
├──────────────┴──────────────┴──────────┴────────────────────┤
│ • Job metadata (timestamps, delays)                         │
│ • Processing state                                          │
│ • Retry information                                         │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack Layers

```
┌────────────────────────────────────────────────────────────────┐
│                    APPLICATION STACK                            │
└────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ CLIENT LAYER                                             │
│ • Postman Collection                                     │
│ • WebSocket Client (wscat, browser)                     │
│ • Test Client (Node.js script)                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ API LAYER                                                │
│ • Fastify (HTTP Server)                                  │
│ • @fastify/websocket (WebSocket Support)                │
│ • Zod (Request Validation)                              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ BUSINESS LOGIC LAYER                                     │
│ • Order Service (Order Management)                       │
│ • DEX Router (Quote Comparison & Execution)             │
│ • Validation Layer (Input Sanitization)                 │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ QUEUE LAYER                                              │
│ • BullMQ (Job Processing)                               │
│ • IORedis (Redis Client)                                │
│ • Worker Pool (10 Concurrent Workers)                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ PERSISTENCE LAYER                                        │
│ • PostgreSQL (Order History)                            │
│ • Redis (Queue State)                                   │
│ • pg (PostgreSQL Client)                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ INFRASTRUCTURE LAYER                                     │
│ • Docker (Containerization)                             │
│ • Docker Compose (Local Development)                    │
│ • Node.js 18 (Runtime)                                  │
│ • TypeScript (Type Safety)                              │
└─────────────────────────────────────────────────────────┘
```

## Scalability Architecture

```
┌────────────────────────────────────────────────────────────────┐
│              HORIZONTAL SCALING (Future)                        │
└────────────────────────────────────────────────────────────────┘

Load Balancer (Nginx/Traefik)
         │
    ┌────┴────┬────────┬────────┐
    │         │        │        │
┌───▼───┐ ┌──▼───┐ ┌──▼───┐ ┌──▼───┐
│ App 1 │ │ App 2│ │ App 3│ │ App N│  ← Multiple instances
└───┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
    │        │        │        │
    └────┬───┴────┬───┴────┬───┘
         │        │        │
    ┌────▼────────▼────────▼────┐
    │      Redis Cluster         │  ← Shared queue
    │   (Distributed Queue)      │
    └────────────┬───────────────┘
                 │
    ┌────────────▼───────────────┐
    │  PostgreSQL Primary        │
    │  ┌─────────────────────┐   │
    │  │ Read Replicas (N)   │   │  ← Read scaling
    │  └─────────────────────┘   │
    └────────────────────────────┘
```

---

**This architecture provides:**
- ✅ High availability through queue-based processing
- ✅ Scalability through worker concurrency
- ✅ Resilience through retry logic
- ✅ Real-time updates through WebSocket
- ✅ Data persistence through PostgreSQL
- ✅ Observability through comprehensive logging
