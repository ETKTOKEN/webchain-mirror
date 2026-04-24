import fs from 'fs';
import path from 'path';

// Load config from config.json
const configPath = path.join(process.cwd(), 'config.json');
let config = {};

try {
  if (fs.existsSync(configPath)) {
    const rawConfig = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(rawConfig);
  } else {
    console.warn('⚠️ config.json not found, using defaults');
  }
} catch (error) {
  console.error('❌ Error loading config:', error.message);
  process.exit(1);
}

// Default values
export default {
  user_id: config.user_id || 1,
  validator_wallet: config.validator_wallet || '0xf51a1175098f814a751dc339b7d5a47f786fb3a4',
  rpc_url: config.rpc_url || 'https://rpc.webchain.e-talk.xyz/rpc',
  base_url: config.base_url || 'https://rpc.webchain.e-talk.xyz',
  port: process.env.PORT || 3000,
  wsPort: process.env.WS_PORT || 3001,
  dataDir: './data'
};