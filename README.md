# clutch-hub-sdk-js

![Alpha](https://img.shields.io/badge/status-alpha-orange.svg)
![Experimental](https://img.shields.io/badge/stage-experimental-red.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![npm](https://img.shields.io/badge/npm-CB3837?style=flat&logo=npm&logoColor=white)

> ⚠️ **ALPHA SOFTWARE** - This project is in active development and is considered experimental. Use at your own risk. APIs may change without notice.

JavaScript SDK for interacting with the clutch-hub-api

## Overview

`clutch-hub-sdk-js` is a JavaScript/TypeScript SDK for building decentralized applications (dApps) that interact with the [clutch-hub-api](https://github.com/your-org/clutch-hub-api) and the Clutch custom blockchain. This SDK helps you:
- Connect to the hub API
- Build and sign transactions client-side (keeping private keys secure)
- Submit signed transactions to the blockchain via the API
- Query chain state (e.g., get nonce, balances, etc.)

## Features
- **Client-side signing:** Never expose your private key to the server; all signing is done in the browser or mobile app.
- **Transaction helpers:** Easily build, encode, and sign custom Clutch transactions (e.g., ride requests).
- **API integration:** Fetch chain state and submit signed transactions to the hub API.
- **TypeScript support:** Type-safe interfaces for all major methods and transaction types.

## Installation
```bash
npm install clutch-hub-sdk-js
```

## Basic Usage
```js
import { ClutchHubSdk } from 'clutch-hub-sdk-js';

const sdk = new ClutchHubSdk('https://your-hub-api-url');

// 1. Fetch the next nonce for the user
const nonce = await sdk.getNextNonce(userAddress);

// 2. Build a ride request transaction
const tx = sdk.buildRideRequestTx({
  pickup: { latitude: 35.7, longitude: 51.4 },
  dropoff: { latitude: 35.8, longitude: 51.5 },
  fare: 1000
}, userAddress, nonce);

// 3. Sign the transaction (using user's private key)
const { r, s, v } = await sdk.signTx(tx, userPrivateKey);

// 4. Submit the signed transaction
const receipt = await sdk.sendTransaction({
  from: userAddress,
  nonce,
  payload: tx,
  r, s, v
});

console.log('Transaction receipt:', receipt);
```

## Security Note
**Never share or expose your private key.** The SDK is designed for client-side signing only. For best security, integrate with browser wallets, hardware wallets, or secure mobile keystores.

## License
MIT
