import { BlockStore } from './storage/block-store.js';
import { SyncManager } from './sync/sync-manager.js';
import config from './config/config-loader.js';
import express from 'express';
import cors from 'cors';

console.log(`
==========================================
🌐 WebChain Mirror Node v2.0
📂 Storage: LevelDB
🔗 Sync: From mother node
📊 Using: index as block number
==========================================
`);

class MirrorNode {
  constructor() {
    this.storage = new BlockStore();
    this.syncManager = new SyncManager(this.storage, config);
    this.internalApi = null;
  }

  async start() {
    try {
      console.log('🚀 Starting mirror node...');
      
      // Check current height
      const height = await this.storage.getCurrentHeight();
      console.log(`📊 Current chain height: ${height}`);
      
      // Start internal API for database access
      await this.startInternalApi();
      
      // Start sync
      await this.syncManager.start();
      
      // Setup graceful shutdown
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());
      
      console.log('\n✅ Mirror node is running');
      console.log('   Press Ctrl+C to stop\n');
      
      // Show status periodically
      setInterval(async () => {
        const currentHeight = await this.storage.getCurrentHeight();
        console.log(`📈 Current height: ${currentHeight} (updated: ${new Date().toLocaleTimeString()})`);
      }, 30000); // Every 30 seconds
      
    } catch (error) {
      console.error('❌ Failed to start:', error);
      process.exit(1);
    }
  }

  async startInternalApi() {
    const app = express();
    app.use(cors());
    app.use(express.json());
    
    // Internal endpoints for API server
    app.get('/internal/health', async (req, res) => {
      try {
        const health = await this.storage.healthCheck();
        res.json(health);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/internal/height', async (req, res) => {
      try {
        const height = await this.storage.getCurrentHeight();
        res.json({ height });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/internal/block/:number', async (req, res) => {
      try {
        const blockNumber = parseInt(req.params.number);
        if (isNaN(blockNumber)) {
          return res.status(400).json({ error: 'Invalid block number' });
        }
        
        const block = await this.storage.getBlock(blockNumber);
        if (block) {
          res.json({ block });
        } else {
          res.status(404).json({ error: 'Block not found' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/internal/latest', async (req, res) => {
      try {
        const height = await this.storage.getCurrentHeight();
        const block = await this.storage.getBlock(height);
        res.json({ block });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/internal/blocks', async (req, res) => {
      try {
        const { limit = 10 } = req.query;
        const limitNum = Math.min(parseInt(limit), 100);
        const height = await this.storage.getCurrentHeight();
        
        const blocks = [];
        const start = Math.max(0, height - limitNum + 1);
        
        for (let i = height; i >= start && i >= 0; i--) {
          const block = await this.storage.getBlock(i);
          if (block) blocks.push(block);
        }
        
        res.json({ blocks, height, limit: limitNum });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Error handling
    app.use((req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });
    
    const PORT = process.env.INTERNAL_API_PORT || 3002;
    this.internalApi = app.listen(PORT, () => {
      console.log(`🔒 Internal API listening on port ${PORT}`);
    });
    
    return this.internalApi;
  }

  async shutdown() {
    console.log('\n🛑 Shutting down...');
    this.syncManager.stop();
    
    // Close internal API server
    if (this.internalApi) {
      await new Promise(resolve => this.internalApi.close(resolve));
    }
    
    await this.storage.close();
    console.log('✅ Shutdown complete');
    process.exit(0);
  }
}

// Start
const mirror = new MirrorNode();
mirror.start();