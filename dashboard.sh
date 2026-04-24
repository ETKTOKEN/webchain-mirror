#!/bin/bash
clear
echo "🌐 WEBCHAIN MIRROR NODE DASHBOARD"
echo "=================================="

while true; do
  # Get all data in one call
  info=$(curl -s "http://localhost:3001/api/v1/info")
  health=$(curl -s "http://localhost:3001/health")
  
  height=$(echo $info | jq -r '.data.chainHeight')
  status=$(echo $health | jq -r '.status')
  latest_hash=$(echo $info | jq -r '.data.latestBlockHash' | cut -c1-20)
  time=$(date '+%H:%M:%S')
  
  # Display
  echo "[$time] ┌─────────────────────────────"
  echo "      │ 📊 Height: $height"
  echo "      │ 🩺 Status: $status"
  echo "      │ 🔗 Latest: ${latest_hash}..."
  echo "      │ 🖥️  API: http://localhost:3001"
  echo "      └─────────────────────────────"
  
  # Check for new block every 5 seconds
  sleep 5
done
