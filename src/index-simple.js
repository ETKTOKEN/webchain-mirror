import { BlockStore } from './storage/block-store.js';

console.log('🚀 Starting WebChain Sync Service');

// Create storage WITHOUT any immediate tests
const storage = new BlockStore(); // Default is write mode

// Simple loop to keep service alive and show status
setInterval(async () => {
  try {
    const height = await storage.getCurrentHeight();
    console.log(`📊 Current height: ${height}`);
  } catch (error) {
    console.log(`⚠️  Error: ${error.message}`);
  }
}, 5000);

console.log('✅ Sync service running');
console.log('Press Ctrl+C to stop');