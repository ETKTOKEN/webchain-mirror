import { Level } from 'level';

export class BlockStore {
  constructor(dbPath = './data/chaindb') {
    console.log(`📦 Opening Sync database...`);
    
    try {
      this.db = new Level(dbPath, {
        valueEncoding: 'json',
        createIfMissing: true
      });
      
      console.log(`✅ Sync database ready`);
      
    } catch (error) {
      console.error(`❌ Database failed:`, error.message);
      
      if (error.code === 'LEVEL_LOCKED') {
        console.log(`   Database locked. Another process has the database open.`);
      }
      
      throw error;
    }
  }

  async getCurrentHeight() {
    try {
      const height = await this.db.get('latest:block');
      return parseInt(height);
    } catch (error) {
      if (error.code === 'LEVEL_NOT_FOUND') return 0;
      throw error;
    }
  }

  async getBlock(number) {
    try {
      return await this.db.get(`block:${number}`);
    } catch (error) {
      if (error.code === 'LEVEL_NOT_FOUND') return null;
      throw error;
    }
  }

  async putBlock(block) {
    try {
      // Validate block exists
      if (!block || typeof block !== 'object') {
        console.error(`❌ Invalid block provided to putBlock:`, block);
        return false;
      }
      
      const blockNumber = block.number !== undefined ? block.number : block.index;
      
      if (blockNumber === undefined || blockNumber === null) {
        console.error(`❌ Block missing number/index property:`, block);
        return false;
      }
      
      // Standardize the block format - ensure it has 'number' property
      const standardizedBlock = {
        ...block,
        number: blockNumber,
        // Keep original index if it exists
        original: block.index !== undefined ? { index: block.index } : null
      };
      
      // Remove index if it's duplicate of number
      if (standardizedBlock.index === standardizedBlock.number) {
        delete standardizedBlock.index;
      }
      
      // Save the block
      await this.db.put(`block:${blockNumber}`, standardizedBlock);
      
      // Update latest block pointer
      await this.db.put('latest:block', blockNumber.toString());
      
      console.log(`💾 Saved block ${blockNumber} (hash: ${block.hash?.slice(0, 10)}...)`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to save block ${block?.number || block?.index || 'unknown'}:`, error.message);
      return false;
    }
  }

  // Added: Batch save method for multiple blocks
  async putBlocks(blocks) {
    try {
      if (!Array.isArray(blocks) || blocks.length === 0) {
        console.error(`❌ Invalid blocks array provided:`, blocks);
        return false;
      }
      
      let savedCount = 0;
      let latestBlock = 0;
      
      for (const block of blocks) {
        if (await this.putBlock(block)) {
          savedCount++;
          const blockNumber = block.number !== undefined ? block.number : block.index;
          if (blockNumber > latestBlock) {
            latestBlock = blockNumber;
          }
        }
      }
      
      console.log(`💾 Saved ${savedCount} blocks (latest: ${latestBlock})`);
      return savedCount > 0;
    } catch (error) {
      console.error(`❌ Failed to save blocks:`, error.message);
      return false;
    }
  }

  async getBlockCount() {
    try {
      const height = await this.getCurrentHeight();
      return height + 1; // Blocks are 0-indexed
    } catch (error) {
      return 0;
    }
  }

  async getLatestBlock() {
    try {
      const height = await this.getCurrentHeight();
      if (height === 0) return null;
      return await this.getBlock(height);
    } catch (error) {
      return null;
    }
  }

  async healthCheck() {
    try {
      const height = await this.getCurrentHeight();
      const latestBlock = await this.getLatestBlock();
      return {
        healthy: true,
        height: height,
        totalBlocks: await this.getBlockCount(),
        latestBlock: latestBlock,
        connected: true
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        connected: false
      };
    }
  }

  async close() {
    if (this.db) {
      await this.db.close();
      console.log('📦 Database connection closed');
    }
  }
}