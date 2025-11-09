import 'dotenv/config';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { validateOrderExecute } from './validation/orderValidator';
import { orderService } from './services/orderService';
import { enqueueOrder, getQueueMetrics } from './queue/processor';
import { database } from './db/database';
import { OrderStatusUpdate } from './types/order';

const fastify = Fastify({ 
  logger: true,
  requestTimeout: 30000,
});

/**
 * POST /api/orders/execute
 * Submit order for execution
 * Returns orderId and wsPath for WebSocket connection
 */
fastify.post('/api/orders/execute', async (request, reply) => {
  try {
    // Validate request body
    const input = validateOrderExecute(request.body);

    fastify.log.info(`Received order: ${JSON.stringify(input)}`);

    // Create order
    const order = await orderService.createOrder(input);

    // Enqueue order for processing
    await enqueueOrder(order.id);

    // Return order info with WebSocket path
    return {
      success: true,
      orderId: order.id,
      wsPath: `/ws/orders/${order.id}`,
      message: 'Order submitted successfully. Connect to WebSocket for live updates.',
    };
  } catch (error) {
    // Handle Zod validation errors
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      fastify.log.warn(error, 'Order validation failed');
      
      // Parse Zod error issues for user-friendly messages
      const issues = (error as any).issues || [];
      const errors = issues.map((issue: any) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      reply.code(400);
      return {
        success: false,
        error: 'Validation failed',
        message: 'Please check the following fields and try again',
        errors,
      };
    }

    fastify.log.error(error, 'Order submission error');
    reply.code(500);
    return {
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing your order',
    };
  }
});

/**
 * GET /ws/orders/:orderId
 * WebSocket endpoint for order status updates
 * Streams status updates: pending → routing → building → submitted → confirmed/failed
 */
fastify.get('/ws/orders/:orderId', { websocket: true }, (connection, req) => {
  const { orderId } = req.params as { orderId: string };

  fastify.log.info(`WebSocket connected for order ${orderId}`);

  // Register callback for status updates
  orderService.registerStatusCallback(orderId, (update: OrderStatusUpdate) => {
    try {
      const message = JSON.stringify({
        orderId: update.orderId,
        status: update.status,
        timestamp: update.timestamp.toISOString(),
        dexUsed: update.dexUsed,
        executedPrice: update.executedPrice,
        txHash: update.txHash,
        error: update.error,
        retryCount: update.retryCount,
      });

      connection.socket.send(message);

      fastify.log.info(`[WS] Sent update to ${orderId}: ${update.status}`);

      // Close connection after final status
      if (update.status === 'confirmed' || update.status === 'failed') {
        setTimeout(() => {
          connection.socket.close();
          fastify.log.info(`[WS] Closed connection for ${orderId}`);
        }, 1000);
      }
    } catch (error) {
      fastify.log.error(error, `[WS] Error sending update for ${orderId}`);
    }
  });

  // Handle connection close
  connection.socket.on('close', () => {
    fastify.log.info(`[WS] Client disconnected from ${orderId}`);
    orderService.unregisterStatusCallback(orderId);
  });

  // Handle errors
  connection.socket.on('error', (error: Error) => {
    fastify.log.error(error, `[WS] Error on connection ${orderId}`);
    orderService.unregisterStatusCallback(orderId);
  });
});

/**
 * GET /api/orders/:orderId
 * Get order details by ID
 */
fastify.get('/api/orders/:orderId', async (request, reply) => {
  try {
    const { orderId } = request.params as { orderId: string };
    const order = await orderService.getOrder(orderId);

    if (!order) {
      reply.code(404);
      return {
        success: false,
        error: 'Order not found',
      };
    }

    return {
      success: true,
      order,
    };
  } catch (error) {
    fastify.log.error(error, 'Get order error');
    reply.code(500);
    return {
      success: false,
      error: 'Internal server error',
    };
  }
});

/**
 * GET /api/queue/metrics
 * Get queue processing metrics
 */
fastify.get('/api/queue/metrics', async (request, reply) => {
  try {
    const metrics = await getQueueMetrics();
    return {
      success: true,
      metrics,
    };
  } catch (error) {
    fastify.log.error(error, 'Get metrics error');
    reply.code(500);
    return {
      success: false,
      error: 'Internal server error',
    };
  }
});

/**
 * GET /health
 * Health check endpoint
 */
fastify.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
});

/**
 * Start server
 */
const start = async () => {
  try {
    // Initialize database
    await database.initialize();
    console.log('✅ Database ready');

    // Register WebSocket support
    await fastify.register(websocket);
    console.log('✅ WebSocket support registered');

    // Start listening
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    
    console.log('\n🚀 ========================================');
    console.log(`   ETERNA Order Execution Engine`);
    console.log('   ========================================');
    console.log(`   Server:     http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    console.log(`   Health:     http://localhost:${port}/health`);
    console.log(`   Metrics:    http://localhost:${port}/api/queue/metrics`);
    console.log('   ========================================\n');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nSIGTERM received, shutting down gracefully...');
  await fastify.close();
  await database.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  await fastify.close();
  await database.close();
  process.exit(0);
});

start();

