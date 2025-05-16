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

  /**
   * Fetches the unsigned ride request payload from the GraphQL API.
   */
  async createUnsignedRideRequest(args: RideRequestArgs): Promise<any> {
    const mutation = `
      mutation CreateUnsignedRideRequest($pickup_latitude: Float!, $pickup_longitude: Float!, $dropoff_latitude: Float!, $dropoff_longitude: Float!, $fare: Int!) {
        create_unsigned_ride_request(
          pickup_latitude: $pickup_latitude,
          pickup_longitude: $pickup_longitude,
          dropoff_latitude: $dropoff_latitude,
          dropoff_longitude: $dropoff_longitude,
          fare: $fare
        )
      }
    `;
    const variables = {
      pickup_latitude: args.pickup.latitude,
      pickup_longitude: args.pickup.longitude,
      dropoff_latitude: args.dropoff.latitude,
      dropoff_longitude: args.dropoff.longitude,
      fare: args.fare,
    };
    const resp = await axios.post(
      `${this.apiUrl}/graphql`,
      { query: mutation, variables }
    );
    return resp.data.data.create_unsigned_ride_request;
  }

  async signTransaction(raw: Uint8Array, privateKey: string): Promise<Signature> {
    const hash = keccak_256(raw);
    const sig = await secp.signAsync(hash, privateKey);
    return {
      r: sig.r.toString().padStart(64, '0'),
      s: sig.s.toString().padStart(64, '0'),
      v: typeof sig.recovery === 'number' ? sig.recovery : 0,
    };
  }

  async submitTransaction(tx: SignedTx): Promise<any> {
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