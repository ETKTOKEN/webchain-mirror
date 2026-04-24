# WebChain Mirror Node

## Requirements
- Node.js >= 18
- npm

## Setup
1. Run `npm install` to install dependencies
2. Edit `config.json` with your e-talk user ID and validator wallet
3. Run `npm start` to start the mirror node

## Features
- Mirrors WebChain blocks from e-talk.xyz
- Reports new blocks back to the mother node
- Allows validator transactions via Our CLI /withdraw + OTP confirmation
- to submit transactions? Use our CLI/SDK `npm install webchain-blockchain-sdk`
- Optional browser peer relay via WebRTC

## Managing the Mirror

### Stop the Mirror
If you want to stop the mirror node safely:
- In the terminal where `npm start` is running, press `Ctrl + C`.  
  This will stop the mirror immediately without affecting your local chain (`localChain.json`).

- Alternatively, you can close the terminal where it’s running.

### Resume the Mirror
To start it again after stopping:
```bash
npm start OR npm run start:all


