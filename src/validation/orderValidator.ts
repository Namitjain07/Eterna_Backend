import { z } from 'zod';

export const orderExecuteSchema = z.object({
  type: z.enum(['market', 'limit', 'sniper']),
  tokenIn: z.string().min(1, 'Token in address is required'),
  tokenOut: z.string().min(1, 'Token out address is required'),
  amountIn: z.number().positive('Amount must be positive'),
  slippage: z.number().min(0).max(1).default(0.01), // default 1% slippage
});

export type OrderExecuteInput = z.infer<typeof orderExecuteSchema>;

export const validateOrderExecute = (data: unknown): OrderExecuteInput => {
  return orderExecuteSchema.parse(data);
};
