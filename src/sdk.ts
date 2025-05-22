import axios from 'axios';
import { Buffer } from 'buffer';
declare global {
  interface Window { Buffer: typeof Buffer }
}
if (typeof window !== 'undefined' && !window.Buffer) window.Buffer = Buffer;
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
  private publicKey: string;
  private token: string | null = null;
  private tokenExpireTime: number = 0;

  constructor(apiUrl: string, publicKey: string) {
    this.apiUrl = apiUrl;
    this.publicKey = publicKey;
  }

  private async ensureAuth() {
    const now = Date.now();
    if (!this.token || now > this.tokenExpireTime) {
      const mutation = `
        mutation GenerateToken($publicKey: String!) {
          generateToken(publicKey: $publicKey) {
            token
            expiresAt
          }
        }
      `;
      const resp = await axios.post(
        `${this.apiUrl}/graphql`,
        { query: mutation, variables: { publicKey: this.publicKey } }
      );
      if (resp.data.errors) throw new Error(resp.data.errors.map((e: { message: string }) => e.message).join('\n'));
      const { token, expiresAt } = resp.data.data.generateToken;
      this.token = token;
      this.tokenExpireTime = expiresAt * 1000;
    }
  }

  /**
   * Fetches the unsigned ride request payload from the GraphQL API.
   */
  async createUnsignedRideRequest(args: RideRequestArgs): Promise<any> {
    await this.ensureAuth();
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
    const pickup = {
      latitude: (args.pickup as any).latitude ?? (args.pickup as any).lat,
      longitude: (args.pickup as any).longitude ?? (args.pickup as any).lng,
    };
    const dropoff = {
      latitude: (args.dropoff as any).latitude ?? (args.dropoff as any).lat,
      longitude: (args.dropoff as any).longitude ?? (args.dropoff as any).lng,
    };
    const variables = {
      pickupLatitude: pickup.latitude,
      pickupLongitude: pickup.longitude,
      dropoffLatitude: dropoff.latitude,
      dropoffLongitude: dropoff.longitude,
      fare: args.fare,
    };
    const resp = await axios.post(
      `${this.apiUrl}/graphql`,
      { query: mutation, variables },
      { headers: { Authorization: `Bearer ${this.token}` } }
    );

    if (resp.data.errors) {
      console.error('GraphQL errors:', resp.data.errors);
      throw new Error(resp.data.errors.map((e: { message: string }) => e.message).join('\n'));
    }
    if (!resp.data.data || !resp.data.data.createUnsignedRideRequest) {
      throw new Error('No data returned from createUnsignedRideRequest');
    }
    return resp.data.data.createUnsignedRideRequest;
  }

  async signTransaction(unsignedTx: { from: string, nonce: number, data: any }, privateKey: string): Promise<Signature> {
    // RLP encode [from, nonce, callData as JSON string]
    const callData = JSON.stringify(unsignedTx.data);
    const toSign = rlp.encode([unsignedTx.from, unsignedTx.nonce, callData]);
    const hash = keccak_256(toSign);
    const sig = await secp.signAsync(hash, privateKey);
    const r = sig.r.toString().padStart(64, '0');
    const s = sig.s.toString().padStart(64, '0');
    const v = (typeof sig.recovery === 'number' ? sig.recovery : 0) + 27;
    return { r, s, v };
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