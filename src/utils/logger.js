// Simple logger for now - we can enhance later
export function createLogger(name = 'webchain-mirror') {
    return {
      info: (message, ...args) => console.log(`[${name}] ℹ️ ${message}`, ...args),
      error: (message, ...args) => console.error(`[${name}] ❌ ${message}`, ...args),
      warn: (message, ...args) => console.warn(`[${name}] ⚠️ ${message}`, ...args),
      debug: (message, ...args) => console.debug(`[${name}] 🔍 ${message}`, ...args)
    };
  }