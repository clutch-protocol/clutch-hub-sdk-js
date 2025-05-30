import axios, { AxiosInstance } from 'axios';
import { Buffer } from 'buffer';
import { keccak_256 } from '@noble/hashes/sha3';
import * as rlp from 'rlp';
import * as secp from '@noble/secp256k1';
import { RideRequestArgs, Signature } from './types';

// Expose Buffer to browser contexts
declare global {
  interface Window { Buffer: typeof Buffer }
}
if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

/**
 * Represents an unsigned transaction returned by the GraphQL API.
 */
export interface UnsignedTransaction {
  data: any;
  from: string;
  nonce: number;
}

/**
 * SDK for interacting with the Clutch Hub API and signing transactions.
 */
export class ClutchHubSdk {
  private apiClient: AxiosInstance;
  private publicKey: string;
  private token: string | null = null;
  private tokenExpireTime: number = 0;

  constructor(apiUrl: string, publicKey: string) {
    this.apiClient = axios.create({ baseURL: apiUrl });
    this.publicKey = publicKey;
  }

  private get authHeaders(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  private async executeGraphQL<T>(query: string, variables: any): Promise<T> {
    const response = await this.apiClient.post(
      '/graphql',
      { query, variables },
      { headers: this.authHeaders }
    );
    if (response.data.errors) {
      throw new Error(response.data.errors.map((e: any) => e.message).join('\n'));
    }
    if (!response.data.data) {
      throw new Error('No data returned from GraphQL.');
    }
    return response.data.data as T;
  }

  private async ensureAuth(): Promise<void> {
    const now = Date.now();
    if (!this.token || now >= this.tokenExpireTime) {
      const query = `
        mutation GenerateToken($publicKey: String!) {
          generateToken(publicKey: $publicKey) {
            token
            expiresAt
          }
        }
      `;
      const data = await this.executeGraphQL<{
        generateToken: { token: string; expiresAt: number }
      }>(query, { publicKey: this.publicKey });
      this.token = data.generateToken.token;
      this.tokenExpireTime = data.generateToken.expiresAt * 1000;
    }
  }

  /**
   * Fetches an unsigned ride request transaction from the GraphQL API.
   */
  public async createUnsignedRideRequest(
    args: RideRequestArgs
  ): Promise<UnsignedTransaction> {
    await this.ensureAuth();
    const pickupLat = (args.pickup as any).latitude ?? (args.pickup as any).lat;
    const pickupLng = (args.pickup as any).longitude ?? (args.pickup as any).lng;
    const dropoffLat = (args.dropoff as any).latitude ?? (args.dropoff as any).lat;
    const dropoffLng = (args.dropoff as any).longitude ?? (args.dropoff as any).lng;

    const query = `
      mutation CreateUnsignedRideRequest(
        $pickupLatitude: Float!, $pickupLongitude: Float!,
        $dropoffLatitude: Float!, $dropoffLongitude: Float!, $fare: Int!
      ) {
        createUnsignedRideRequest(
          pickupLatitude: $pickupLatitude,
          pickupLongitude: $pickupLongitude,
          dropoffLatitude: $dropoffLatitude,
          dropoffLongitude: $dropoffLongitude,
          fare: $fare
        ) {
          data
          from
          nonce
        }
      }
    `;
    const variables = {
      pickupLatitude: pickupLat,
      pickupLongitude: pickupLng,
      dropoffLatitude: dropoffLat,
      dropoffLongitude: dropoffLng,
      fare: args.fare,
    };
    const result = await this.executeGraphQL<{
      createUnsignedRideRequest: UnsignedTransaction
    }>(query, variables);
    return result.createUnsignedRideRequest;
  }

  /**
   * Signs a transaction and returns the signature and raw RLP-encoded payload.
   */
  public async signTransaction(
    unsignedTx: UnsignedTransaction,
    privateKey: string
  ): Promise<Signature & { rawTransaction: string }> {
    // Encode function call
    const callData = this.encodeFunctionCall(unsignedTx.data);
    const fromNoPrefix = unsignedTx.from.replace(/^0x/, '');

    // RLP-encode unsigned payload and hash
    const unsignedPayload = rlp.encode([
      fromNoPrefix,
      unsignedTx.nonce,
      callData,
    ]);
    const hashBytes = keccak_256(unsignedPayload);
    const rawHashHex = Buffer.from(hashBytes).toString('hex');

    // Sign hash
    const signature = await this.signHash(rawHashHex, privateKey);

    // RLP-encode full transaction
    const fullPayload = rlp.encode([
      fromNoPrefix,
      unsignedTx.nonce,
      signature.r.replace(/^0x/, ''),
      signature.s.replace(/^0x/, ''),
      signature.v,
      rawHashHex,
      [...callData],
    ]);

    return {
      ...signature,
      rawTransaction: '0x' + Buffer.from(fullPayload).toString('hex'),
    };
  }

  /**
   * Submits a signed raw transaction to the network.
   */
  public async submitTransaction(
    rawTransaction: string
  ): Promise<string> {
    await this.ensureAuth();
    const query = `
      mutation SendRawTransaction($raw_transaction: String!) {
        sendRawTransaction(rawTransaction: $raw_transaction)
      }
    `;
    const result = await this.executeGraphQL<{
      sendRawTransaction: string;
    }>(query, { raw_transaction: rawTransaction });
    return result.sendRawTransaction;
  }

  /**
   * Signs a hex-encoded hash.
   */
  private async signHash(
    hashHex: string,
    privateKey: string
  ): Promise<Signature> {
    const hashBuffer = Buffer.from(hashHex.replace(/^0x/, ''), 'hex');
    const sig = await secp.signAsync(hashBuffer, privateKey);
    const r = sig.r.toString(16).padStart(64, '0');
    const s = sig.s.toString(16).padStart(64, '0');
    const v = (typeof sig.recovery === 'number' ? sig.recovery : 0) + 27;
    return {
      r: '0x' + r,
      s: '0x' + s,
      v,
    };
  }

  /**
   * RLP-encodes a function call according to Rust definitions.
   */
  private encodeFunctionCall(data: any): Buffer {
    const type = data.function_call_type || data.type;
    switch (type) {
      case 'RideRequest': {
        const { pickup_location, dropoff_location, fare } = data.arguments || data;
        const pickupLatBits = this.float64ToUint64(pickup_location.latitude);
        const pickupLngBits = this.float64ToUint64(pickup_location.longitude);
        const dropoffLatBits = this.float64ToUint64(dropoff_location.latitude);
        const dropoffLngBits = this.float64ToUint64(dropoff_location.longitude);
        const args = [
          [pickupLatBits, pickupLngBits],
          [dropoffLatBits, dropoffLngBits],
          fare,
        ];
        return Buffer.from(rlp.encode([1, args]));
      }
      default:
        throw new Error(`Unsupported FunctionCall type: ${type}`);
    }
  }

  /**
   * Converts a JavaScript number to uint64 bits as BigInt.
   */
  private float64ToUint64(value: number): bigint {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setFloat64(0, value, false);
    const high = BigInt(view.getUint32(0, false));
    const low = BigInt(view.getUint32(4, false));
    return (high << BigInt(32)) | low;
  }
} 