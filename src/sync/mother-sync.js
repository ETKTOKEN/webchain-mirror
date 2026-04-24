import fetch from 'node-fetch';

export async function fetchChainFromMother(rpcUrl) {
  try {
    const url = rpcUrl.replace("/rpc", "/get_chain");
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "success" && Array.isArray(data.blocks)) {
      console.log(`🔍 Fetched ${data.blocks.length} blocks from mother node`);
      return { blocks: data.blocks };
    }

    console.warn("⚠️  No blocks from mother node");
    return null;
  } catch (err) {
    console.error("⚠️  Error fetching from mother node:", err.message);
    return null;
  }
}

export async function reportBlockToMother(config, block) {
  try {
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "webchain_reportBlock",
      params: { 
        block, 
        user_id: config.user_id, 
        validator_address: config.validator_wallet 
      }
    };

    const response = await fetch(config.rpc_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log(`📤 Reported block ${block.number} to mother node`);
    return data;
  } catch (err) {
    console.error("⚠️  Error reporting block:", err.message);
  }
}