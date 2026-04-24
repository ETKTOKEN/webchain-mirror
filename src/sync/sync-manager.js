import fetch from 'node-fetch';

export class SyncManager {
  constructor(storage, config) {
    this.storage = storage;
    this.config = config;
    this.isSyncing = false;
    this.syncInterval = null;
    this.lastProcessedHeight = -1;
  }

  async start() {
    this.isSyncing = true;
    console.log('🚀 Starting sync from mother node...');
    
    // Initial sync
    await this.syncFromMother();
    
    // Regular sync every 5 seconds
    this.syncInterval = setInterval(() => this.syncFromMother(), 5000);
  }

  async syncFromMother() {
    if (!this.isSyncing) return;

    try {
        // Build sync URL from config
        const syncUrl = this.getSyncUrl();
        console.log(`🔍 Fetching from: ${syncUrl}`);
        
        const response = await fetch(syncUrl, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.status !== "success" || !Array.isArray(data.blocks)) {
            this.logNoNewBlocks(data);
            return;
        }
        
        // Process received blocks
        const processingResult = await this.processBlocks(data.blocks);
        
        // Log summary
        this.logSyncSummary(processingResult);
        
    } catch (error) {
        console.error(`⚠️ Sync error: ${error.message}`);
    }
  }

  getSyncUrl() {
    if (this.config.base_url) {
      return `${this.config.base_url}/get_chain`;
    } else if (this.config.rpc_url) {
      return this.config.rpc_url.replace("/rpc", "/get_chain");
    }
    throw new Error('No sync URL configured');
  }

  async processBlocks(blocks) {
    const uniqueCount = new Set(blocks.map(b => b.index)).size;
    const highestBlock = Math.max(...blocks.map(b => b.index));
    
    console.log(`📥 Received ${blocks.length} blocks, ${uniqueCount} unique (highest: ${highestBlock})`);
    
    // Deduplicate blocks
    const uniqueBlocks = this.deduplicateBlocks(blocks);
    
    const localHeight = await this.storage.getCurrentHeight();
    console.log(`📊 Local chain height: ${localHeight}`);
    
    let newBlocks = 0;
    let reorgBlocks = 0;
    
    // Process in order
    const sortedIndexes = Array.from(uniqueBlocks.keys()).sort((a, b) => a - b);
    
    for (const blockIndex of sortedIndexes) {
      const block = uniqueBlocks.get(blockIndex);
      const result = await this.processSingleBlock(block, localHeight);
      
      if (result === 'new') newBlocks++;
      if (result === 'reorg') reorgBlocks++;
    }
    
    return { newBlocks, reorgBlocks, highestBlock, localHeight };
  }

  deduplicateBlocks(blocks) {
    const uniqueBlocks = new Map();
    
    for (const block of blocks) {
      const blockIndex = block.index;
      
      if (!uniqueBlocks.has(blockIndex)) {
        uniqueBlocks.set(blockIndex, block);
      } else {
        const existingBlock = uniqueBlocks.get(blockIndex);
        if (existingBlock.hash !== block.hash) {
          // Chain reorganization detected (excluding genesis special case)
          if (blockIndex === 0) {
            // Genesis block difference - use the one we already have
            continue;
          }
          
          uniqueBlocks.set(blockIndex, block);
          this.logChainReorg(blockIndex, existingBlock.hash, block.hash);
        }
      }
    }
    
    console.log(`🔍 Unique blocks after deduplication: ${uniqueBlocks.size}`);
    return uniqueBlocks;
  }

  async processSingleBlock(block, localHeight) {
    const blockIndex = block.index;
    
    if (blockIndex > localHeight) {
      // New block
      await this.storage.putBlock(block);
      await this.reportBlock(block);
      console.log(`✅ Added block ${blockIndex} (${block.hash.slice(0, 10)}...)`);
      return 'new';
    }
    
    // Check for reorg or update
    const existing = await this.storage.getBlock(blockIndex);
    if (existing && existing.hash !== block.hash && blockIndex !== 0) {
      // Block changed (reorg)
      await this.storage.putBlock(block);
      console.log(`🔄 Updated block ${blockIndex} (reorg)`);
      return 'reorg';
    }
    
    return 'unchanged';
  }

  logNoNewBlocks(data) {
    if (data.blocks && Array.isArray(data.blocks) && data.blocks.length === 0) {
      console.log('⏸️ Mother node returned empty block array');
    } else {
      console.log('⏸️ No new blocks available');
    }
  }

  logChainReorg(blockIndex, oldHash, newHash) {
    console.log(`🔄 Chain reorg detected for block ${blockIndex}`);
    console.log(`   Previous: ${oldHash.slice(0, 15)}...`);
    console.log(`   Current:  ${newHash.slice(0, 15)}...`);
  }

  logSyncSummary({ newBlocks, reorgBlocks, highestBlock, localHeight }) {
    if (newBlocks > 0) {
      console.log(`🎉 Synced ${newBlocks} new blocks`);
      if (reorgBlocks > 0) {
        console.log(`   (including ${reorgBlocks} reorg updates)`);
      }
    } else if (reorgBlocks > 0) {
      console.log(`🔄 Processed ${reorgBlocks} chain reorganization(s)`);
    } else {
      console.log('🔄 Already up to date');
      
      // Only log height periodically to reduce noise
      const now = Date.now();
      if (!this.lastHeightLog || now - this.lastHeightLog > 60000) { // Every minute
        console.log(`📊 Chain synchronized at height ${localHeight} (latest: ${highestBlock})`);
        this.lastHeightLog = now;
      }
    }
  }

  async reportBlock(block) {
    try {
      const reportUrl = this.getReportUrl();
      
      const payload = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "webchain_reportBlock",
        params: {
          block: block,
          user_id: this.config.user_id || 1,
          validator_address: this.config.validator_wallet || this.getDefaultValidator()
        }
      };

      const response = await fetch(reportUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      await response.json(); // We don't use the response, just ensure it succeeded
      console.log(`📤 Reported block ${block.index} to mother node`);
      
    } catch (error) {
      console.error(`⚠️ Failed to report block ${block?.index}: ${error.message}`);
    }
  }

  getReportUrl() {
    if (this.config.base_url) {
      return `${this.config.base_url}/rpc`;
    } else if (this.config.rpc_url) {
      return this.config.rpc_url;
    }
    throw new Error('No RPC URL configured');
  }

  getDefaultValidator() {
    return "0xf51a1175098f814a751dc339b7d5a47f786fb3a4";
  }

  stop() {
    this.isSyncing = false;
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    console.log('🛑 Sync stopped');
  }
}