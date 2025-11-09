import { v4 as uuidv4 } from 'uuid';
import { Order, OrderStatus, OrderStatusUpdate, DexType } from '../types/order';
import { OrderExecuteInput } from '../validation/orderValidator';
import { MockDexRouter } from '../dex/mockDexRouter';
import { database } from '../db/database';

/**
 * OrderService handles order execution logic with DEX routing
 * Manages order lifecycle and status updates
 */
export class OrderService {
  private dexRouter: MockDexRouter;
  private statusCallbacks: Map<string, (update: OrderStatusUpdate) => void>;

  constructor() {
    this.dexRouter = new MockDexRouter();
    this.statusCallbacks = new Map();
  }

  /**
   * Create a new order
   */
  async createOrder(input: OrderExecuteInput): Promise<Order> {
    const order: Order = {
      id: uuidv4(),
      type: input.type,
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      amountIn: input.amountIn,
      slippage: input.slippage,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
    };

    // Persist to database
    await database.createOrder(order);

    // Send initial status update
    this.emitStatusUpdate(order.id, {
      orderId: order.id,
      status: 'pending',
      timestamp: new Date(),
    });

    return order;
  }

  /**
   * Execute order with DEX routing
   * Implements the full order lifecycle with status updates
   */
  async executeOrder(orderId: string, retryCount: number = 0): Promise<void> {
    try {
      const order = await database.getOrder(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      console.log(`\n🚀 Executing order ${orderId} (attempt ${retryCount + 1})`);

      // Update retry count
      order.retryCount = retryCount;
      await database.updateOrder(orderId, { retryCount });

      // Step 1: Routing - Compare DEX prices
      await this.updateOrderStatus(order, 'routing');
      console.log(`📊 Fetching quotes from DEXs...`);

      const bestQuote = await this.dexRouter.getBestQuote(
        order.tokenIn,
        order.tokenOut,
        order.amountIn
      );

      // Step 2: Building - Create transaction
      await this.updateOrderStatus(order, 'building');
      console.log(`🔨 Building transaction on ${bestQuote.dex.toUpperCase()}...`);

      // Step 3: Submitted - Transaction sent to network
      await this.updateOrderStatus(order, 'submitted');
      console.log(`📤 Submitting transaction to ${bestQuote.dex.toUpperCase()}...`);

      // Execute the swap
      const result = await this.dexRouter.executeSwap(bestQuote.dex, order, bestQuote);

      // Step 4: Confirmed - Transaction successful
      await this.updateOrderStatus(order, 'confirmed', {
        dexUsed: bestQuote.dex,
        executedPrice: result.executedPrice,
        txHash: result.txHash,
      });

      console.log(`✅ Order ${orderId} completed successfully`);
      console.log(`   DEX: ${bestQuote.dex.toUpperCase()}`);
      console.log(`   TX: ${result.txHash}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Order ${orderId} failed:`, errorMessage);

      // Update order status to failed
      await this.updateOrderStatus(
        await database.getOrder(orderId) as Order,
        'failed',
        {
          error: errorMessage,
        }
      );

      // Throw error for retry logic
      throw error;
    }
  }

  /**
   * Update order status and emit WebSocket update
   */
  private async updateOrderStatus(
    order: Order,
    status: OrderStatus,
    additionalData?: {
      dexUsed?: DexType;
      executedPrice?: number;
      txHash?: string;
      error?: string;
    }
  ): Promise<void> {
    // Update in database
    await database.updateOrder(order.id, {
      status,
      ...additionalData,
    });

    // Emit WebSocket update
    this.emitStatusUpdate(order.id, {
      orderId: order.id,
      status,
      timestamp: new Date(),
      retryCount: order.retryCount,
      ...additionalData,
    });
  }

  /**
   * Register callback for status updates (WebSocket)
   */
  registerStatusCallback(
    orderId: string,
    callback: (update: OrderStatusUpdate) => void
  ): void {
    this.statusCallbacks.set(orderId, callback);
  }

  /**
   * Unregister callback for status updates
   */
  unregisterStatusCallback(orderId: string): void {
    this.statusCallbacks.delete(orderId);
  }

  /**
   * Emit status update to registered callback
   */
  private emitStatusUpdate(orderId: string, update: OrderStatusUpdate): void {
    const callback = this.statusCallbacks.get(orderId);
    if (callback) {
      callback(update);
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    return database.getOrder(orderId);
  }
}

// Singleton instance
export const orderService = new OrderService();
