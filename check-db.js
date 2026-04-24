import { Level } from 'level';
import fs from 'fs';

async function checkAllDatabases() {
  console.log('🔍 Checking ALL possible database locations...\n');
  
  const locations = [
    './data/chaindb',
    './chaindb',
    './data',
    '.',
    './webchain-mirror/data/chaindb',
    process.cwd() + '/data/chaindb'
  ];
  
  for (const location of locations) {
    console.log(`📍 Checking: ${location}`);
    
    // Check if directory exists
    if (!fs.existsSync(location)) {
      console.log('   ⚠️  Directory does not exist\n');
      continue;
    }
    
    try {
      const db = new Level(location, { 
        valueEncoding: 'json',
        createIfMissing: false // Don't create new DB
      });
      
      // Try to get the latest block key
      const latest = await db.get('latest:block').catch(() => null);
      
      if (latest !== null) {
        console.log(`   ✅ Found database!`);
        console.log(`      Latest block: ${latest}`);
        
        // Count block entries
        let blockCount = 0;
        for await (const [key] of db.iterator({ gt: 'block:', lt: 'block;' })) {
          blockCount++;
        }
        console.log(`      Total blocks: ${blockCount}`);
        
        // Get a sample block
        if (blockCount > 0) {
          const sampleBlock = await db.get('block:0').catch(() => null);
          console.log(`      Sample block 0: ${sampleBlock ? 'Exists' : 'Missing'}`);
        }
        
        await db.close();
        console.log('');
        
        // If we found data, check if this is where sync is writing
        const files = fs.readdirSync(location).filter(f => 
          f.endsWith('.ldb') || f.endsWith('.log') || f.includes('MANIFEST')
        );
        console.log(`      Database files: ${files.length} files`);
        if (files.length > 0) {
          console.log(`      File sample: ${files.slice(0, 3).join(', ')}`);
        }
        
        return location; // Found the database!
      } else {
        console.log(`   ℹ️  Database exists but no 'latest:block' key\n`);
        await db.close();
      }
      
    } catch (error) {
      if (error.code === 'LEVEL_DATABASE_NOT_OPEN') {
        console.log(`   🔒 Database is locked (another process is using it)`);
      } else if (error.message.includes('does not exist')) {
        console.log(`   📭 No database at this location`);
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
      console.log('');
    }
  }
  
  console.log('❌ No database with chain data found in any location');
  return null;
}

checkAllDatabases().catch(console.error);
