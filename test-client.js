#!/usr/bin/env node

/**
 * Simple test client to verify the order execution flow
 * Usage: node test-client.js
 */

const WebSocket = require('ws');
const http = require('http');

const BASE_URL = 'http://localhost:3000';
const WS_BASE_URL = 'ws://localhost:3000';

// Helper to make HTTP requests
function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

// Test the complete flow
async function testOrderFlow() {
  console.log('🧪 Testing ETERNA Order Execution Engine\n');

  try {
    // 1. Health check
    console.log('1. Checking health endpoint...');
    const health = await makeRequest('/health');
    console.log('   ✅ Server is healthy:', health.status);

    // 2. Submit order
    console.log('\n2. Submitting market order...');
    const orderData = {
      type: 'market',
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: 10,
      slippage: 0.01,
    };
    
    const orderResponse = await makeRequest('/api/orders/execute', 'POST', orderData);
    console.log('   ✅ Order submitted:', orderResponse.orderId);
    console.log('   WebSocket path:', orderResponse.wsPath);

    // 3. Connect to WebSocket for status updates
    console.log('\n3. Connecting to WebSocket for status updates...');
    const wsUrl = `${WS_BASE_URL}${orderResponse.wsPath}`;
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.log('   ✅ WebSocket connected');
    });

    ws.on('message', (data) => {
      const update = JSON.parse(data.toString());
      const timestamp = new Date(update.timestamp).toLocaleTimeString();
      
      console.log(`   [${timestamp}] Status: ${update.status}`);
      
      if (update.dexUsed) {
        console.log(`              DEX: ${update.dexUsed.toUpperCase()}`);
      }
      if (update.executedPrice) {
        console.log(`              Price: ${update.executedPrice.toFixed(4)}`);
      }
      if (update.txHash) {
        console.log(`              TX: ${update.txHash.substring(0, 16)}...`);
      }
      if (update.error) {
        console.log(`              Error: ${update.error}`);
      }
    });

    ws.on('close', async () => {
      console.log('   ✅ WebSocket closed');

      // 4. Get final order details
      console.log('\n4. Fetching final order details...');
      const orderDetails = await makeRequest(`/api/orders/${orderResponse.orderId}`);
      
      if (orderDetails.success) {
        const order = orderDetails.order;
        console.log('   ✅ Order completed:');
        console.log('      Status:', order.status);
        console.log('      DEX:', order.dexUsed?.toUpperCase() || 'N/A');
        console.log('      Executed Price:', order.executedPrice?.toFixed(4) || 'N/A');
        console.log('      TX Hash:', order.txHash?.substring(0, 32) || 'N/A');
      }

      // 5. Check queue metrics
      console.log('\n5. Checking queue metrics...');
      const metrics = await makeRequest('/api/queue/metrics');
      if (metrics.success) {
        console.log('   ✅ Queue metrics:');
        console.log('      Active:', metrics.metrics.active);
        console.log('      Waiting:', metrics.metrics.waiting);
        console.log('      Completed:', metrics.metrics.completed);
        console.log('      Failed:', metrics.metrics.failed);
      }

      console.log('\n✅ All tests passed!\n');
      process.exit(0);
    });

    ws.on('error', (error) => {
      console.error('   ❌ WebSocket error:', error.message);
      process.exit(1);
    });

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
testOrderFlow();
