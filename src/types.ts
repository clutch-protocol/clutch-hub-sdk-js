export {};

/**
 * Represents geographical coordinates for location-based operations.
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RideRequestArgs {
  pickup: Coordinates;
  dropoff: Coordinates;
  fare: number;
}

export interface Signature {
  r: string;
  s: string;
  v: number;
}

export interface SignedTx {
  from: string;
  nonce: number;
  payload: Uint8Array;
  r: string;
  s: string;
  v: number;
}

/**
 * Transaction status enumeration for tracking transaction states.
 */
export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
} 