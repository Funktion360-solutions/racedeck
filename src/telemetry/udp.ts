// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import Constants from 'expo-constants';
import { decryptGT7 } from './salsa20';
import { Frame, parseFrame } from './frame';

/**
 * Talks to Gran Turismo 7 on the PS5 over UDP.
 *
 * GT7 only streams telemetry to a device that keeps sending it a heartbeat:
 * we send one byte to port 33739 on the PS5, and GT7 answers with ~60
 * encrypted packets per second to port 33740 on this device.
 *
 * UDP needs the native module `react-native-udp`, which is not part of Expo Go.
 * It works in a development build (see LÆS-MIG.md).
 */

export const SEND_PORT = 33739;
export const RECEIVE_PORT = 33740;

/** True when running inside the Expo Go app (no custom native modules). */
export const isExpoGo = Constants.executionEnvironment === 'storeClient';

interface UdpSocket {
  bind(port: number, callback?: () => void): void;
  on(event: 'message', listener: (msg: { buffer: ArrayBufferLike; byteOffset: number; length: number }, rinfo: unknown) => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
  send(msg: Uint8Array, offset: number, length: number, port: number, address: string, callback?: (err?: Error) => void): void;
  close(): void;
}

function loadDgram(): { createSocket(options: { type: 'udp4'; reusePort?: boolean }): UdpSocket } | null {
  if (isExpoGo) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-udp');
    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

export const udpSupported = () => loadDgram() !== null;

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
export const isValidIp = (ip: string) => IPV4.test(ip.trim());

export class GT7Client {
  private socket: UdpSocket | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private packetsSinceHeartbeat = 0;
  private lastHeartbeat = 0;
  private stopped = false;

  constructor(
    private address: string,
    private onFrame: (f: Frame) => void,
    private onError: (message: string) => void,
  ) {}

  start() {
    const ip = this.address.trim();
    if (!isValidIp(ip)) {
      this.onError(`“${ip || '(tom)'}” er ikke en gyldig IP-adresse. Skriv fx 192.168.1.23.`);
      return;
    }
    const dgram = loadDgram();
    if (!dgram) {
      this.onError(
        isExpoGo
          ? 'Expo Go kan ikke modtage data fra PS5. Brug et development build af RaceDeck (se LÆS-MIG), eller vælg Demo.'
          : 'UDP-modulet mangler i denne version af appen. Byg appen igen med react-native-udp.',
      );
      return;
    }
    try {
      const socket = dgram.createSocket({ type: 'udp4', reusePort: true });
      this.socket = socket;
      socket.on('error', (err) => {
        if (!this.stopped) this.onError(`Netværksfejl: ${err?.message ?? err}`);
      });
      socket.on('message', (msg) => {
        this.packetsSinceHeartbeat++;
        const bytes = new Uint8Array(msg.buffer as ArrayBuffer, msg.byteOffset, msg.length);
        const plain = decryptGT7(bytes);
        const frame = plain && parseFrame(plain);
        if (frame) this.onFrame(frame);
      });
      socket.bind(RECEIVE_PORT, () => this.heartbeat());
      // GT7 wants a heartbeat about every 100 packets; while waiting we retry every 2 s.
      this.timer = setInterval(() => {
        const waited = Date.now() - this.lastHeartbeat;
        if (this.packetsSinceHeartbeat >= 100 || (this.packetsSinceHeartbeat === 0 && waited > 2000) || waited > 5000) {
          this.heartbeat();
        }
      }, 250);
    } catch (e) {
      this.onError(`Kunne ikke åbne port ${RECEIVE_PORT}: ${(e as Error)?.message ?? e}`);
    }
  }

  private heartbeat() {
    if (!this.socket || this.stopped) return;
    this.lastHeartbeat = Date.now();
    this.packetsSinceHeartbeat = 0;
    const msg = new Uint8Array([0x41]); // "A"
    try {
      this.socket.send(msg, 0, 1, SEND_PORT, this.address.trim(), () => {});
    } catch {
      // The first send can fail while iOS asks for local network access; we retry.
    }
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    try {
      this.socket?.close();
    } catch {
      // already closed
    }
    this.socket = null;
  }
}
