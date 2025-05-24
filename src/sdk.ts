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

// Move utility functions to a separate section or file
const utils = {
  toHex: (uint8: Uint8Array): string => {
    return Array.from(uint8)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  ensure0x: (str: string): string => {
    return str.startsWith('0x') ? str : '0x' + str;
  },

  float64ToBits: (value: number): string => {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setFloat64(0, value, false);
    const highBits = view.getUint32(0, false);
    const lowBits = view.getUint32(4, false);
    const highHex = highBits.toString(16).padStart(8, '0');
    const lowHex = lowBits.toString(16).padStart(8, '0');
    return highHex + lowHex;
  }
};

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

  // Helper: RLP-encode the FunctionCall according to Rust definitions
  private encodeFunctionCall(data: any): Buffer {
    const type = data.function_call_type || data.type;

    switch (type) {
      case 'RideRequest': {
        const args = data.arguments || data;
        const { pickup_location, dropoff_location, fare } = args;
        if (!pickup_location || !dropoff_location || fare === undefined) {
          throw new Error('Invalid RideRequest arguments: Missing required fields.');
        }

        const pickupLatBits = utils.float64ToBits(pickup_location.latitude);
        const pickupLongBits = utils.float64ToBits(pickup_location.longitude);
        const dropoffLatBits = utils.float64ToBits(dropoff_location.latitude);
        const dropoffLongBits = utils.float64ToBits(dropoff_location.longitude);

        const pickupCoordinates = [pickupLatBits, pickupLongBits];
        const dropoffCoordinates = [dropoffLatBits, dropoffLongBits];
        const rideRequestArgs = [pickupCoordinates, dropoffCoordinates, fare];

        return Buffer.from(rlp.encode([1, rideRequestArgs]));
      }
      // TODO: handle other function_call types here
      default:
        throw new Error(`Unsupported FunctionCall type for RLP encoding: ${type}`);
    }
  }

  async signTransaction(unsignedTx: { from: string, nonce: number, data: any }, privateKey: string): Promise<Signature & { rawTransaction: string }> {
    // 1. RLP-encode the data field
    const callDataRlp = this.encodeFunctionCall(unsignedTx.data);

    // 2. RLP-encode the unsigned transaction for hashing: [from, nonce, callDataRlp]
    const fromNoPrefix = unsignedTx.from.startsWith('0x') ? unsignedTx.from.slice(2) : unsignedTx.from;
    
    const data = [
      fromNoPrefix,
      unsignedTx.nonce,
      callDataRlp,
    ];

    const unsignedRlp = rlp.encode(data);
    const hashBytes = keccak_256(unsignedRlp);

    // Hash without '0x' prefix for consistency with Rust
    const rawHash = Buffer.from(hashBytes).toString('hex');
    
    // 3. Sign the hash
    const sig = await secp.signAsync(hashBytes, privateKey);

    // 4. RLP-encode the full transaction
    // Format signature components correctly
    const r = sig.r.toString(16).padStart(64, '0');
    const s = sig.s.toString(16).padStart(64, '0');
    const v = (typeof sig.recovery === 'number' ? sig.recovery : 0) + 27;
    const hash = rawHash; // No '0x' prefix in RLP
    
    // Construct TX for RLP encoding
    const tx = [
      fromNoPrefix,
      unsignedTx.nonce,
      r,
      s,
      v,
      hash,
      // Important: callDataRlp is already RLP encoded, but it's a Buffer
      // We need to pass the raw value not wrapped in another RLP encoding
      [...callDataRlp]  // Convert Buffer to array so rlp.encode treats it properly
    ];
    
    const signedRlp = rlp.encode(tx);

    // For return values, use '0x' prefix as expected by consumers
    const rawTransaction = '0x' + Buffer.from(signedRlp).toString('hex');
    return { 
      r: utils.ensure0x(r), 
      s: utils.ensure0x(s), 
      v, 
      rawTransaction 
    };
  }

  async submitTransaction(tx: SignedTx): Promise<any> {
    // Send to /send-transaction or GraphQL mutation as appropriate
    const resp = await axios.post(`${this.apiUrl}/send-transaction`, {
      from: tx.from,
      nonce: tx.nonce,
      payload: utils.toHex(tx.payload),
      r: tx.r,
      s: tx.s,
      v: tx.v,
    });
    return resp.data;
  }

  // Standardize error handling in API calls
  private async handleApiCall<T>(query: string, variables: any, headers?: any): Promise<T> {
    try {
      const resp = await axios.post(`${this.apiUrl}/graphql`, { query, variables }, { headers });
      if (resp.data.errors) {
        throw new Error(resp.data.errors.map((e: { message: string }) => e.message).join('\n'));
      }
      if (!resp.data.data) {
        throw new Error('No data returned from the API.');
      }
      return resp.data.data;
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }
} 