import { Pool } from 'pg';
import { Order, OrderStatus } from '../types/order';

/**
 * Database service for order persistence using PostgreSQL
 */
export class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_PUBLIC_URL,
      ssl: {
        rejectUnauthorized: false, // required for Railway
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * Initialize database schema
   */
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id VARCHAR(255) PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          token_in VARCHAR(255) NOT NULL,
          token_out VARCHAR(255) NOT NULL,
          amount_in DECIMAL NOT NULL,
          slippage DECIMAL NOT NULL,
          status VARCHAR(50) NOT NULL,
          dex_used VARCHAR(50),
          executed_price DECIMAL,
          tx_hash VARCHAR(255),
          error TEXT,
          retry_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
      `);
      console.log('✅ Database initialized');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a new order
   */
  async createOrder(order: Order): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO orders (
          id, type, token_in, token_out, amount_in, slippage, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          order.id,
          order.type,
          order.tokenIn,
          order.tokenOut,
          order.amountIn,
          order.slippage,
          order.status,
          order.createdAt,
          order.updatedAt,
        ]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update order status and related fields
   */
  async updateOrder(
    orderId: string,
    updates: {
      status?: OrderStatus;
      dexUsed?: string;
      executedPrice?: number;
      txHash?: string;
      error?: string;
      retryCount?: number;
    }
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      const fields: string[] = ['updated_at = CURRENT_TIMESTAMP'];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.status) {
        fields.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }
      if (updates.dexUsed) {
        fields.push(`dex_used = $${paramIndex++}`);
        values.push(updates.dexUsed);
      }
      if (updates.executedPrice !== undefined) {
        fields.push(`executed_price = $${paramIndex++}`);
        values.push(updates.executedPrice);
      }
      if (updates.txHash) {
        fields.push(`tx_hash = $${paramIndex++}`);
        values.push(updates.txHash);
      }
      if (updates.error) {
        fields.push(`error = $${paramIndex++}`);
        values.push(updates.error);
      }
      if (updates.retryCount !== undefined) {
        fields.push(`retry_count = $${paramIndex++}`);
        values.push(updates.retryCount);
      }

      values.push(orderId);

      await client.query(
        `UPDATE orders SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        type: row.type,
        tokenIn: row.token_in,
        tokenOut: row.token_out,
        amountIn: parseFloat(row.amount_in),
        slippage: parseFloat(row.slippage),
        status: row.status,
        dexUsed: row.dex_used,
        executedPrice: row.executed_price ? parseFloat(row.executed_price) : undefined,
        txHash: row.tx_hash,
        error: row.error,
        retryCount: row.retry_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get orders by status
   */
  async getOrdersByStatus(status: OrderStatus): Promise<Order[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC',
        [status]
      );

      return result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        tokenIn: row.token_in,
        tokenOut: row.token_out,
        amountIn: parseFloat(row.amount_in),
        slippage: parseFloat(row.slippage),
        status: row.status,
        dexUsed: row.dex_used,
        executedPrice: row.executed_price ? parseFloat(row.executed_price) : undefined,
        txHash: row.tx_hash,
        error: row.error,
        retryCount: row.retry_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Singleton instance
export const database = new Database();
