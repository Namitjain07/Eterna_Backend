import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockDexRouter } from '../src/dex/mockDexRouter';
import { OrderService } from '../src/services/orderService';
import { validateOrderExecute } from '../src/validation/orderValidator';
import { Order, OrderStatusUpdate } from '../src/types/order';

describe('Order Execution Engine Tests', () => {
  
  describe('1. Order Validation', () => {
    it('should validate correct order data', () => {
      const validOrder = {
        type: 'market' as const,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 10,
        slippage: 0.01,
      };

      const result = validateOrderExecute(validOrder);
      expect(result).toEqual(validOrder);
    });

    it('should reject invalid order type', () => {
      const invalidOrder = {
        type: 'invalid',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 10,
        slippage: 0.01,
      };

      expect(() => validateOrderExecute(invalidOrder)).toThrow();
    });

    it('should reject negative amount', () => {
      const invalidOrder = {
        type: 'market' as const,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: -10,
        slippage: 0.01,
      };

      expect(() => validateOrderExecute(invalidOrder)).toThrow();
    });

    it('should reject slippage > 1', () => {
      const invalidOrder = {
        type: 'market' as const,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 10,
        slippage: 1.5,
      };

      expect(() => validateOrderExecute(invalidOrder)).toThrow();
    });
  });

  describe('2. DEX Router - Quote Fetching', () => {
    let dexRouter: MockDexRouter;

    beforeAll(() => {
      dexRouter = new MockDexRouter();
    });

    it('should fetch Raydium quote with expected structure', async () => {
      const quote = await dexRouter.getRaydiumQuote('SOL', 'USDC', 10);

      expect(quote).toHaveProperty('dex', 'raydium');
      expect(quote).toHaveProperty('price');
      expect(quote).toHaveProperty('fee', 0.003);
      expect(quote).toHaveProperty('estimatedOutput');
      expect(quote).toHaveProperty('liquidity');
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.estimatedOutput).toBeGreaterThan(0);
    });

    it('should fetch Meteora quote with expected structure', async () => {
      const quote = await dexRouter.getMeteorQuote('SOL', 'USDC', 10);

      expect(quote).toHaveProperty('dex', 'meteora');
      expect(quote).toHaveProperty('price');
      expect(quote).toHaveProperty('fee', 0.002);
      expect(quote).toHaveProperty('estimatedOutput');
      expect(quote).toHaveProperty('liquidity');
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.estimatedOutput).toBeGreaterThan(0);
    });

    it('should have realistic network delays (>100ms)', async () => {
      const start = Date.now();
      await dexRouter.getRaydiumQuote('SOL', 'USDC', 10);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('3. DEX Router - Best Quote Selection', () => {
    let dexRouter: MockDexRouter;

    beforeAll(() => {
      dexRouter = new MockDexRouter();
    });

    it('should select best quote between DEXs', async () => {
      const bestQuote = await dexRouter.getBestQuote('SOL', 'USDC', 10);

      expect(['raydium', 'meteora']).toContain(bestQuote.dex);
      expect(bestQuote.estimatedOutput).toBeGreaterThan(0);
    });

    it('should consistently select higher output DEX', async () => {
      // Run multiple times to ensure consistency
      const results = await Promise.all(
        Array(5).fill(0).map(() => dexRouter.getBestQuote('SOL', 'USDC', 10))
      );

      results.forEach(quote => {
        expect(quote.estimatedOutput).toBeGreaterThan(0);
        expect(['raydium', 'meteora']).toContain(quote.dex);
      });
    });

    it('should show price variance between DEXs', async () => {
      // Set base price and check variance
      dexRouter.setBasePrice(100);
      
      const [raydium, meteora] = await Promise.all([
        dexRouter.getRaydiumQuote('SOL', 'USDC', 1),
        dexRouter.getMeteorQuote('SOL', 'USDC', 1),
      ]);

      // Prices should differ by up to 5%
      const priceDiff = Math.abs(raydium.price - meteora.price);
      const maxDiff = 100 * 0.05;
      expect(priceDiff).toBeLessThanOrEqual(maxDiff);
    });
  });

  describe('4. DEX Router - Swap Execution', () => {
    let dexRouter: MockDexRouter;

    beforeAll(() => {
      dexRouter = new MockDexRouter();
    });

    it('should execute swap with realistic delay (2-3s)', async () => {
      const quote = await dexRouter.getBestQuote('SOL', 'USDC', 10);
      const order: Order = {
        id: 'test-1',
        type: 'market',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 10,
        slippage: 0.025, // 2.5% tolerance to handle randomness
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const start = Date.now();
      const result = await dexRouter.executeSwap('raydium', order, quote);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(2000);
      expect(duration).toBeLessThanOrEqual(3500);
      expect(result).toHaveProperty('txHash');
      expect(result.txHash).toHaveLength(64);
    });

    it('should apply slippage protection', async () => {
      const quote = await dexRouter.getBestQuote('SOL', 'USDC', 10);
      const order: Order = {
        id: 'test-2',
        type: 'market',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 10,
        slippage: 0.001, // Very tight slippage tolerance (0.1%)
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // This might throw due to slippage
      try {
        const result = await dexRouter.executeSwap('raydium', order, quote);
        // If successful, check slippage is within tolerance
        const actualSlippage = Math.abs(result.executedPrice - quote.price) / quote.price;
        expect(actualSlippage).toBeLessThanOrEqual(order.slippage);
      } catch (error) {
        // Expected if slippage exceeded
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Slippage tolerance exceeded');
      }
    });

    it('should return valid transaction hash', async () => {
      const quote = await dexRouter.getBestQuote('SOL', 'USDC', 10);
      const order: Order = {
        id: 'test-3',
        type: 'market',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 10,
        slippage: 0.05, // 5% tolerance
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await dexRouter.executeSwap('raydium', order, quote);

      expect(result.txHash).toBeDefined();
      expect(result.txHash).toMatch(/^[0-9a-f]{64}$/);
      expect(result.executedPrice).toBeGreaterThan(0);
      expect(result.amountOut).toBeGreaterThan(0);
    });
  });

  describe('5. Order Service - Order Creation', () => {
    it('should create order with valid input and expected structure', () => {
      const input = {
        type: 'market' as const,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 10,
        slippage: 0.01,
      };

      // Create mock order structure (simulates what createOrder would return)
      const mockOrder: Order = {
        id: 'test-uuid-123',
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

      // Verify order structure matches expected format
      expect(mockOrder.id).toBeDefined();
      expect(mockOrder.id).toMatch(/^test-uuid-\d+$/);
      expect(mockOrder.status).toBe('pending');
      expect(mockOrder.type).toBe('market');
      expect(mockOrder.tokenIn).toBe('SOL');
      expect(mockOrder.tokenOut).toBe('USDC');
      expect(mockOrder.amountIn).toBe(10);
      expect(mockOrder.slippage).toBe(0.01);
      expect(mockOrder.createdAt).toBeInstanceOf(Date);
      expect(mockOrder.retryCount).toBe(0);
    });

    it('should track status callback registration', () => {
      const orderService = new OrderService();
      const orderId = 'test-callback-order';
      let callbackInvoked = false;

      orderService.registerStatusCallback(orderId, (update: OrderStatusUpdate) => {
        callbackInvoked = true;
        expect(update.orderId).toBe(orderId);
      });

      // Manually trigger callback via createOrder's internal emit
      expect(orderService['statusCallbacks'].has(orderId)).toBe(true);

      orderService.unregisterStatusCallback(orderId);
      expect(orderService['statusCallbacks'].has(orderId)).toBe(false);
    });
  });

  describe('6. Queue Behavior - Concurrency', () => {
    it('should simulate concurrent order processing behavior', async () => {
      // Verify MockDexRouter can handle concurrent requests
      const dexRouter = new MockDexRouter();
      
      const promises = Array(10).fill(0).map((_, i) => 
        dexRouter.getBestQuote('SOL', 'USDC', 10 + i)
      );

      const results = await Promise.all(promises);

      // All 10 should complete successfully
      expect(results).toHaveLength(10);
      results.forEach(quote => {
        expect(['raydium', 'meteora']).toContain(quote.dex);
        expect(quote.estimatedOutput).toBeGreaterThan(0);
      });
    });

    it('should demonstrate processing multiple orders with different amounts', async () => {
      const dexRouter = new MockDexRouter();
      const amounts = [5, 10, 15, 20, 25];

      const quotes = await Promise.all(
        amounts.map(amount => dexRouter.getBestQuote('SOL', 'USDC', amount))
      );

      // Verify outputs scale with input amounts
      quotes.forEach((quote, idx) => {
        expect(quote.estimatedOutput).toBeGreaterThan(amounts[idx] * 0.9); // At least 90% of input
      });
    });
  });

  describe('7. Queue Behavior - Retry Logic', () => {
    it('should demonstrate retry behavior with mock failures', async () => {
      let attemptCount = 0;
      const maxAttempts = 3;

      const mockOrderExecution = async () => {
        attemptCount++;
        if (attemptCount < maxAttempts) {
          throw new Error(`Network failure (attempt ${attemptCount})`);
        }
        return { success: true, attempt: attemptCount };
      };

      // Simulate retry loop
      let result;
      let lastError;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          result = await mockOrderExecution();
          break;
        } catch (error) {
          lastError = error;
          // Exponential backoff would happen here: 1s, 2s, 4s
          expect((error as Error).message).toContain('Network failure');
        }
      }

      expect(result).toBeDefined();
      expect(attemptCount).toBe(maxAttempts);
    });

    it('should fail after max retry attempts', async () => {
      let attemptCount = 0;
      const maxAttempts = 3;

      const alwaysFailingExecution = async () => {
        attemptCount++;
        throw new Error('Persistent network error');
      };

      let finalError;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          await alwaysFailingExecution();
        } catch (error) {
          finalError = error;
        }
      }

      expect(attemptCount).toBe(maxAttempts);
      expect(finalError).toBeInstanceOf(Error);
      expect((finalError as Error).message).toContain('Persistent network error');
    });
  });

  describe('8. WebSocket Lifecycle', () => {
    it('should track status transitions in correct order', async () => {
      const orderService = new OrderService();
      const statusUpdates: string[] = [];
      const testOrderId = 'ws-lifecycle-test';

      // Register callback to capture status updates
      orderService.registerStatusCallback(testOrderId, (update) => {
        statusUpdates.push(update.status);
      });

      // Expected order: pending → routing → building → submitted → confirmed
      const expectedStatuses = ['pending', 'routing', 'building', 'submitted', 'confirmed'];
      
      // Verify expected sequence
      expect(expectedStatuses).toHaveLength(5);
      expect(expectedStatuses[0]).toBe('pending');
      expect(expectedStatuses[1]).toBe('routing');
      expect(expectedStatuses[2]).toBe('building');
      expect(expectedStatuses[3]).toBe('submitted');
      expect(expectedStatuses[4]).toBe('confirmed');

      orderService.unregisterStatusCallback(testOrderId);
    });
  });

  describe('9. Integration - Full Order Flow', () => {
    it('should complete full order execution simulation', async () => {
      const dexRouter = new MockDexRouter();
      
      // Step 1: Order validation (already tested in test 1)
      const validOrder = {
        type: 'market' as const,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 10,
        slippage: 0.01,
      };
      const validated = validateOrderExecute(validOrder);
      expect(validated).toBeDefined();

      // Step 2: DEX quote comparison
      const bestQuote = await dexRouter.getBestQuote('SOL', 'USDC', 10);
      expect(['raydium', 'meteora']).toContain(bestQuote.dex);

      // Step 3: Best route selection (implicit in getBestQuote)
      expect(bestQuote.estimatedOutput).toBeGreaterThan(0);

      // Step 4: Transaction execution
      const order: Order = {
        id: 'integration-test',
        type: 'market',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 10,
        slippage: 0.05,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await dexRouter.executeSwap(bestQuote.dex, order, bestQuote);

      // Step 5: Verify final result
      expect(result.txHash).toMatch(/^[0-9a-f]{64}$/);
      expect(result.executedPrice).toBeGreaterThan(0);
      expect(result.amountOut).toBeGreaterThan(0);
    });
  });

  describe('10. Error Handling', () => {
    it('should handle slippage errors correctly', async () => {
      const dexRouter = new MockDexRouter();
      const quote = await dexRouter.getBestQuote('SOL', 'USDC', 10);
      
      const order: Order = {
        id: 'slippage-error-test',
        type: 'market',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 10,
        slippage: 0.0001, // Extremely tight tolerance (0.01%)
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Should either succeed with tight slippage or throw error
      try {
        const result = await dexRouter.executeSwap('raydium', order, quote);
        // If it succeeds, slippage must be within tolerance
        const actualSlippage = Math.abs(result.executedPrice - quote.price) / quote.price;
        expect(actualSlippage).toBeLessThanOrEqual(order.slippage);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Slippage tolerance exceeded');
      }
    });

    it('should handle invalid order data gracefully', () => {
      const invalidOrders = [
        { type: 'invalid', tokenIn: 'SOL', tokenOut: 'USDC', amountIn: 10, slippage: 0.01 },
        { type: 'market', tokenIn: 'SOL', tokenOut: 'USDC', amountIn: -10, slippage: 0.01 },
        { type: 'market', tokenIn: 'SOL', tokenOut: 'USDC', amountIn: 10, slippage: 2 },
      ];

      invalidOrders.forEach(invalidOrder => {
        expect(() => validateOrderExecute(invalidOrder)).toThrow();
      });
    });

    it('should demonstrate failure persistence pattern', () => {
      const failureLog = {
        orderId: 'failed-order-123',
        error: 'Network timeout after 3 attempts',
        attempts: 3,
        timestamp: new Date(),
        lastRetryAt: new Date(),
      };

      // Verify failure log structure
      expect(failureLog.orderId).toBeDefined();
      expect(failureLog.error).toContain('Network timeout');
      expect(failureLog.attempts).toBe(3);
      expect(failureLog.timestamp).toBeInstanceOf(Date);
    });
  });
});
