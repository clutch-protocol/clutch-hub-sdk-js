import axios from 'axios';
import { keccak_256 } from '@noble/hashes/sha3';
import * as rlp from 'rlp';
import * as secp from '@noble/secp256k1';
import { RideRequestArgs, SignedTx, Signature } from './types';

function toHex(uint8: Uint8Array): string {
  return Array.from(uint8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export class ClutchHubSdk {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async getNextNonce(address: string): Promise<number> {
    const resp = await axios.get(`${this.apiUrl}/nonce/${address}`);
    return resp.data.nonce;
  }

  buildRideRequestTx(args: RideRequestArgs, from: string, nonce: number): Uint8Array {
    const callData = {
      function_call_type: 'RideRequest',
      arguments: {
        fare: args.fare,
        pickup_location: args.pickup,
        dropoff_location: args.dropoff,
      },
    };
    // RLP encode [from, nonce, callData as JSON string]
    return rlp.encode([from, nonce, JSON.stringify(callData)]);
  }

  async signTx(raw: Uint8Array, privateKey: string): Promise<Signature> {
    const hash = keccak_256(raw);
    const [sig, rec] = await secp.signAsync(hash, privateKey, { recovered: true });
    return {
      r: toHex(sig.slice(0, 32)),
      s: toHex(sig.slice(32)),
      v: rec,
    };
  }

  async sendTransaction(tx: SignedTx): Promise<any> {
    // Send to /send-transaction or GraphQL mutation as appropriate
    const resp = await axios.post(`${this.apiUrl}/send-transaction`, {
      from: tx.from,
      nonce: tx.nonce,
      payload: toHex(tx.payload),
      r: tx.r,
      s: tx.s,
      v: tx.v,
    });
    return resp.data;
  }
} 