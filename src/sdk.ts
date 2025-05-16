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
      mutation CreateUnsignedRideRequest($pickupLatitude: Float!, $pickupLongitude: Float!, $dropoffLatitude: Float!, $dropoffLongitude: Float!, $fare: Int!) {
        createUnsignedRideRequest(
          pickupLatitude: $pickupLatitude,
          pickupLongitude: $pickupLongitude,
          dropoffLatitude: $dropoffLatitude,
          dropoffLongitude: $dropoffLongitude,
          fare: $fare
        )
      }
    `;
    
    console.log(args.pickup);
    

    const variables = {
      pickupLatitude: args.pickup.latitude,
      pickupLongitude: args.pickup.longitude,
      dropoffLatitude: args.dropoff.latitude,
      dropoffLongitude: args.dropoff.longitude,
      fare: args.fare,
    };
    const resp = await axios.post(
      `${this.apiUrl}/graphql`,
      { query: mutation, variables }
    );

    if (resp.data.errors) {
      console.error('GraphQL errors:', resp.data.errors);
      throw new Error(resp.data.errors.map((e: { message: string }) => e.message).join('\n'));
    }
    if (!resp.data.data || !resp.data.data.create_unsigned_ride_request) {
      throw new Error('No data returned from create_unsigned_ride_request');
    }
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