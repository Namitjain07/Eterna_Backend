import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { orderService } from '../services/orderService';

/**
 * Queue processor for concurrent order execution with retry logic
 * Implements:
 * - Up to 10 concurrent orders
 * - 100 orders/minute throughput
 * - Exponential back-off retry (≤3 attempts)
 */

// Redis connection configuration
const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Order execution queue
export const orderQueue = new Queue('order-execution', {
  connection,
  defaultJobOptions: {
    attempts: 3, // Maximum 3 retry attempts
    backoff: {
      type: 'exponential',
      delay: 1000, // Start with 1 second, doubles each retry (1s, 2s, 4s)
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours for post-mortem
    },
  },
});

// Worker to process orders
export const orderWorker = new Worker(
  'order-execution',
  async (job: Job) => {
    const { orderId } = job.data;
    const attemptNumber = job.attemptsMade;

    console.log(`\n[Queue] Processing order ${orderId} (attempt ${attemptNumber + 1}/${job.opts.attempts})`);

    try {
      // Execute the order
      await orderService.executeOrder(orderId, attemptNumber);

      console.log(`[Queue] Order ${orderId} completed successfully`);

      return {
        success: true,
        orderId,
        attemptNumber: attemptNumber + 1,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`[Queue] Order ${orderId} failed on attempt ${attemptNumber + 1}:`, errorMessage);

      // Check if this is the final attempt
      if (attemptNumber + 1 >= (job.opts.attempts || 3)) {
        console.error(`[Queue] Order ${orderId} failed after ${attemptNumber + 1} attempts. Giving up.`);
        
        // Log failure reason for post-mortem analysis
        await logFailurePostMortem(orderId, errorMessage, attemptNumber + 1);
      }

      // Re-throw to trigger retry
      throw error;
    }
  },
  {
    connection,
    concurrency: 10, // Process up to 10 orders concurrently
    limiter: {
      max: 100, // Maximum 100 jobs
      duration: 60000, // Per 60 seconds (1 minute)
    },
  }
);

/**
 * Log failure details for post-mortem analysis
 */
async function logFailurePostMortem(
  orderId: string,
  error: string,
  totalAttempts: number
): Promise<void> {
  console.error(`\n=== POST-MORTEM: Order ${orderId} ===`);
  console.error(`Total Attempts: ${totalAttempts}`);
  console.error(`Final Error: ${error}`);
  console.error(`Timestamp: ${new Date().toISOString()}`);
  console.error(`=====================================\n`);
  
  // Could also log to external monitoring service here
}

/**
 * Add order to queue for processing
 */
export async function enqueueOrder(orderId: string): Promise<void> {
  await orderQueue.add('execute-order', { orderId }, {
    jobId: orderId, // Use orderId as jobId to prevent duplicates
  });

  console.log(`[Queue] Order ${orderId} enqueued for processing`);
}

/**
 * Get queue metrics
 */
export async function getQueueMetrics() {
  const [waiting, active, completed, failed] = await Promise.all([
    orderQueue.getWaitingCount(),
    orderQueue.getActiveCount(),
    orderQueue.getCompletedCount(),
    orderQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    total: waiting + active + completed + failed,
  };
}

// Worker event handlers
orderWorker.on('completed', (job) => {
  console.log(`[Queue] ✅ Job ${job.id} completed`);
});

orderWorker.on('failed', (job, err) => {
  console.error(`[Queue] ❌ Job ${job?.id} failed:`, err.message);
});

orderWorker.on('error', (err) => {
  console.error('[Queue] Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...');
  await orderWorker.close();
  await connection.quit();
});
