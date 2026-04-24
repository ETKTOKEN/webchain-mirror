import { Level } from 'level';

export class SimpleStore {
  constructor(isReadOnly = false) {
    this.db = new Level('./data/chaindb', {
      valueEncoding: 'json',
      readOnly: isReadOnly,
      createIfMissing: true
    });
    console.log(`✅ ${isReadOnly ? 'API' : 'Sync'} store ready`);
  }
  
  async getCurrentHeight() {
    try {
      const height = await this.db.get('latest:block');
      return parseInt(height || 0);
    } catch {
      return 0;
    }
  }
}

// For sync service - write mode
export class SyncStore extends SimpleStore {
  constructor() {
    super(false); // read-write
  }
  
  async putBlock(block) {
    const blockNumber = block.number !== undefined ? block.number : block.index;
    await this.db.put(`block:${blockNumber}`, block);
    if (block.hash) {
      await this.db.put(`hash:${block.hash}`, blockNumber);
    }
    await this.db.put('latest:block', blockNumber);
    console.log(`✅ Block ${blockNumber} stored`);
  }
}

// For API service - read-only mode  
export class ApiStore extends SimpleStore {
  constructor() {
    super(true); // read-only
  }
}
