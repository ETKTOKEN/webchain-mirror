import fs from 'fs';

function examineData() {
  console.log('🔍 Examining localChain.json structure...\n');
  
  if (!fs.existsSync('./localChain.json')) {
    console.error('❌ localChain.json not found!');
    return;
  }
  
  const data = JSON.parse(fs.readFileSync('./localChain.json', 'utf8'));
  
  console.log('📊 Top-level keys:', Object.keys(data));
  
  if (data.blocks && Array.isArray(data.blocks)) {
    console.log(`📦 Total blocks: ${data.blocks.length}`);
    
    // Show first few blocks
    console.log('\n📋 First 5 blocks:');
    for (let i = 0; i < Math.min(5, data.blocks.length); i++) {
      const block = data.blocks[i];
      console.log(`   Block ${i}:`, {
        number: block.number,
        hash: block.hash ? `${block.hash.slice(0, 10)}...` : 'NO HASH',
        hasTransactions: block.transactions ? block.transactions.length : 0,
        keys: Object.keys(block)
      });
    }
    
    // Check for blocks without numbers
    const blocksWithoutNumbers = data.blocks.filter(b => b.number === undefined || b.number === null);
    console.log(`\n⚠️  Blocks without number: ${blocksWithoutNumbers.length}`);
    
    if (blocksWithoutNumbers.length > 0) {
      console.log('Examples:', blocksWithoutNumbers.slice(0, 3).map(b => ({
        hash: b.hash,
        keys: Object.keys(b)
      })));
    }
    
    // Check for blocks without hashes
    const blocksWithoutHashes = data.blocks.filter(b => !b.hash);
    console.log(`⚠️  Blocks without hash: ${blocksWithoutHashes.length}`);
    
    // Show last few blocks
    console.log('\n📋 Last 5 blocks:');
    for (let i = Math.max(0, data.blocks.length - 5); i < data.blocks.length; i++) {
      const block = data.blocks[i];
      console.log(`   Block ${i}: number=${block.number}, hash=${block.hash?.slice(0, 10)}...`);
    }
  } else {
    console.log('❌ No blocks array found in data');
    console.log('Data structure:', JSON.stringify(data, null, 2).slice(0, 500) + '...');
  }
  
  if (data.transactions && Array.isArray(data.transactions)) {
    console.log(`\n💸 Total transactions: ${data.transactions.length}`);
  }
}

examineData();
