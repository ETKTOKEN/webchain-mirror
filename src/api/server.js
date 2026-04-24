import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

console.log('🚀 Starting WebChain Mirror API...');

// Internal API configuration
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:3002/internal';

// Create axios instance for internal API calls
const internalApi = axios.create({
  baseURL: INTERNAL_API_URL,
  timeout: 10000,
});

// Helper function to call internal API
async function callInternalApi(endpoint, params = {}) {
  try {
    const response = await internalApi.get(endpoint, { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`Internal API error: ${error.response.data.error || error.message}`);
    } else if (error.request) {
      throw new Error('Internal API unavailable. Make sure sync service (npm start) is running.');
    } else {
      throw error;
    }
  }
}

// ========== MIDDLEWARE ==========
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// ========== ENDPOINTS ==========

// 1. HEALTH ENDPOINT (with real DB check)
app.get('/health', async (req, res) => {
  try {
    const health = await callInternalApi('/health');
    
    res.json({
      status: 'healthy',
      service: 'webchain-mirror-api',
      timestamp: new Date().toISOString(),
      chainHeight: health.height || 0,
      connected: health.connected || false,
      internalApi: health.healthy ? 'connected' : 'disconnected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'webchain-mirror-api',
      error: error.message,
      timestamp: new Date().toISOString(),
      connected: false,
      internalApi: 'disconnected',
      suggestion: 'Make sure sync service (npm start) is running first'
    });
  }
});

// 2. INFO ENDPOINT
app.get('/api/v1/info', async (req, res) => {
  try {
    const [healthData, heightData, latestData] = await Promise.all([
      callInternalApi('/health'),
      callInternalApi('/height'),
      callInternalApi('/latest')
    ]);
    
    res.json({
      status: 'success',
      data: {
        chainHeight: heightData.height || 0,
        latestBlock: latestData.block?.number || 0,
        latestBlockHash: latestData.block?.hash || null,
        latestBlockTime: latestData.block?.timestamp ? new Date(latestData.block.timestamp).toISOString() : null,
        node: 'WebChain Mirror Node',
        version: '2.0.0',
        apiVersion: '1.0',
        status: heightData.height > 0 ? 'active' : 'empty',
        internalApi: 'connected'
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      code: 'INTERNAL_API_ERROR'
    });
  }
});

// 3. GET BLOCK BY NUMBER OR HASH
app.get('/api/v1/blocks/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    if (isNaN(identifier)) {
      // For hash-based lookup, we need to get all blocks and filter
      // This is inefficient but works for now
      const blocksData = await callInternalApi('/blocks', { limit: 1000 });
      const block = blocksData.blocks.find(b => b.hash === identifier);
      
      if (block) {
        res.json({ 
          status: 'success', 
          data: block,
          meta: {
            number: block.number,
            hash: block.hash,
            transactions: block.transactions?.length || 0
          }
        });
      } else {
        res.status(404).json({ 
          status: 'error', 
          message: `Block not found: ${identifier}`
        });
      }
    } else {
      // Get by number
      const blockNumber = parseInt(identifier);
      const blockData = await callInternalApi(`/block/${blockNumber}`);
      
      res.json({ 
        status: 'success', 
        data: blockData.block,
        meta: {
          number: blockData.block.number,
          hash: blockData.block.hash,
          transactions: blockData.block.transactions?.length || 0
        }
      });
    }
  } catch (error) {
    if (error.message.includes('Block not found')) {
      res.status(404).json({ 
        status: 'error', 
        message: `Block not found: ${req.params.identifier}`
      });
    } else {
      res.status(500).json({ 
        status: 'error', 
        message: error.message
      });
    }
  }
});

// 4. GET LATEST BLOCKS
app.get('/api/v1/blocks', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const blocksData = await callInternalApi('/blocks', { limit });
    
    res.json({ 
      status: 'success', 
      data: blocksData.blocks || [],
      meta: {
        total: blocksData.blocks?.length || 0,
        latestHeight: blocksData.height || 0,
        limit: blocksData.limit || limit,
        internalApi: 'connected'
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// 5. GET BLOCK RANGE
app.get('/api/v1/blocks/range/:from/:to', async (req, res) => {
  try {
    const { from, to } = req.params;
    const fromNum = parseInt(from);
    const toNum = parseInt(to);
    
    if (isNaN(fromNum) || isNaN(toNum) || fromNum > toNum) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Invalid range. Use: /range/start/end where start <= end'
      });
    }
    
    const blocks = [];
    for (let i = fromNum; i <= toNum; i++) {
      try {
        const blockData = await callInternalApi(`/block/${i}`);
        if (blockData.block) blocks.push(blockData.block);
      } catch (error) {
        // Skip not found blocks
        if (!error.message.includes('Block not found')) {
          throw error;
        }
      }
    }
    
    res.json({ 
      status: 'success', 
      data: blocks,
      meta: {
        from: fromNum,
        to: toNum,
        total: blocks.length,
        returned: blocks.length
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// 6. SIMPLE TEST ENDPOINT
app.get('/api/v1/test/block/:number', async (req, res) => {
  try {
    const blockNumber = parseInt(req.params.number);
    
    if (isNaN(blockNumber) || blockNumber < 0) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Invalid block number' 
      });
    }
    
    const heightData = await callInternalApi('/height');
    const height = heightData.height || 0;
    
    if (blockNumber > height) {
      return res.status(404).json({
        status: 'error',
        message: `Block ${blockNumber} is beyond current chain height (${height})`,
        chainHeight: height,
        suggestion: 'Wait for sync to catch up'
      });
    }
    
    const blockData = await callInternalApi(`/block/${blockNumber}`);
    
    if (blockData.block) {
      res.json({
        status: 'success',
        data: {
          exists: true,
          number: blockData.block.number,
          hash: blockData.block.hash?.slice(0, 20) + '...',
          transactions: blockData.block.transactions?.length || 0,
          timestamp: blockData.block.timestamp,
          previousHash: blockData.block.previousHash?.slice(0, 20) + '...'
        }
      });
    }
  } catch (error) {
    if (error.message.includes('Block not found')) {
      const heightData = await callInternalApi('/height');
      res.status(404).json({
        status: 'error',
        message: `Block ${req.params.number} not found`,
        chainHeight: heightData.height || 0,
        suggestion: 'Block might be corrupted or database issue'
      });
    } else {
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  }
});

// 7. DATABASE DEBUG ENDPOINT
app.get('/api/v1/debug', async (req, res) => {
  try {
    const [healthData, heightData, latestData] = await Promise.all([
      callInternalApi('/health'),
      callInternalApi('/height'),
      callInternalApi('/latest')
    ]);
    
    res.json({
      status: 'success',
      data: {
        health: healthData,
        chainHeight: heightData.height || 0,
        latestBlock: latestData.block?.number || 0,
        latestBlockHash: latestData.block?.hash?.slice(0, 20) + '...' || null,
        internalApi: {
          connected: true,
          url: INTERNAL_API_URL,
          status: 'operational'
        },
        service: {
          name: 'WebChain Mirror API',
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          architecture: 'Client-Server (Internal API)'
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      internalApi: {
        connected: false,
        url: INTERNAL_API_URL,
        status: 'unavailable'
      },
      suggestion: 'Make sure sync service (npm start) is running first'
    });
  }
});

// 8. ROOT ENDPOINT
app.get('/', (req, res) => {
  res.json({
    service: 'WebChain Mirror Node API',
    version: '2.0.0',
    architecture: 'Client-Server (Internal API)',
    endpoints: {
      health: '/health',
      info: '/api/v1/info',
      blocks: '/api/v1/blocks?limit=10',
      block: '/api/v1/blocks/{numberOrHash}',
      range: '/api/v1/blocks/range/{from}/{to}',
      debug: '/api/v1/debug',
      test: '/api/v1/test/block/{number}'
    },
    note: 'This API depends on the internal sync service running on port 3002'
  });
});

// ========== ERROR HANDLING ==========
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Endpoint not found: ${req.method} ${req.url}`,
    availableEndpoints: ['/health', '/api/v1/info', '/api/v1/blocks', '/api/v1/debug']
  });
});

app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// ========== START SERVER ==========
const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`
==========================================
🌐 WebChain Mirror API Server
==========================================
📡 Port: ${PORT}
🔒 Internal API: ${INTERNAL_API_URL}
🔗 Health: http://localhost:${PORT}/health
📊 Info: http://localhost:${PORT}/api/v1/info
🐛 Debug: http://localhost:${PORT}/api/v1/debug
📦 Blocks: http://localhost:${PORT}/api/v1/blocks?limit=5
==========================================
`);
  
  // Verify connection on startup
  setTimeout(async () => {
    try {
      console.log('🧪 Testing internal API connection...');
      const healthData = await callInternalApi('/health');
      
      if (healthData.healthy) {
        console.log(`✅ API server ready. Chain height: ${healthData.height || 0}`);
        console.log(`🔒 Internal API connection successful`);
      } else {
        console.warn('⚠️  Internal API returned unhealthy status');
      }
    } catch (error) {
      console.error(`❌ Internal API connection FAILED:`, error.message);
      console.error('   The internal API is unavailable.');
      console.error('   Make sure sync service (npm start) is running FIRST.');
    }
  }, 2000);
});