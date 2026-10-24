// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import { useSyncExternalStore } from 'react';
import { DemoDriver } from './demo';
import { Flag, Frame, emptyFrame, has } from './frame';
import { RaceTracker, Stats, emptyStats } from './tracker';
import { GT7Client } from './udp';

export type Source = 'demo' | 'ps5';
export type ConnectionState = 'stopped' | 'waiting' | 'live' | 'paused' | 'demo' | 'failed';

export const stateLabel: Record<ConnectionState, string> = {
  stopped: 'Stoppet',
  waiting: 'Venter på GT7 …',
  live: 'Live',
  paused: 'GT7 på pause',
  demo: 'Demo',
  failed: 'Fejl',
};

export interface Snapshot {
  frame: Frame;
  stats: Stats;
  state: ConnectionState;
  error: string | null;
  packetsPerSecond: number;
}

/**
 * Single source of telemetry for the UI. Packets arrive at 60 Hz;
 * the UI is refreshed at ~25 Hz to save battery.
 */
class TelemetryHub {
  private snapshot: Snapshot = { frame: emptyFrame(), stats: emptyStats(), state: 'stopped', error: null, packetsPerSecond: 0 };
  private listeners = new Set<() => void>();
  private tracker = new RaceTracker();
  private latest: Frame = emptyFrame();
  private client: GT7Client | null = null;
  private demoTimer: ReturnType<typeof setInterval> | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private publishTimer: ReturnType<typeof setInterval> | null = null;
  private demo = new DemoDriver();
  private source: Source = 'demo';
  private state: ConnectionState = 'stopped';
  private error: string | null = null;
  private counter = 0;
  private pps = 0;
  private lastPacket = 0;
  private dirty = false;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  start(source: Source, address: string) {
    this.stop();
    this.source = source;
    this.error = null;
    this.tracker.reset();
    this.latest = emptyFrame();

    if (source === 'demo') {
      this.state = 'demo';
      this.demo = new DemoDriver();
      // Warm up a few laps so lap times and fuel figures exist straight away.
      for (let i = 0; i < 60 * 250; i++) this.tracker.ingest(this.demo.next());
      this.demoTimer = setInterval(() => {
        for (let i = 0; i < 3; i++) this.ingest(this.demo.next());
      }, 50);
    } else {
      this.state = 'waiting';
      this.client = new GT7Client(
        address,
        (f) => this.ingest(f),
        (message) => {
          this.state = 'failed';
          this.error = message;
          this.publish();
        },
      );
      this.client.start();
    }

    this.healthTimer = setInterval(() => {
      this.pps = this.counter;
      this.counter = 0;
      if (this.source === 'ps5' && (this.state === 'live' || this.state === 'paused') && Date.now() - this.lastPacket > 3000) {
        this.state = 'waiting';
      }
      this.dirty = true;
    }, 1000);
    this.publishTimer = setInterval(() => {
      if (this.dirty) this.publish();
    }, 40);
    this.publish();
  }

  stop() {
    this.client?.stop();
    this.client = null;
    if (this.demoTimer) clearInterval(this.demoTimer);
    if (this.healthTimer) clearInterval(this.healthTimer);
    if (this.publishTimer) clearInterval(this.publishTimer);
    this.demoTimer = this.healthTimer = this.publishTimer = null;
    this.pps = this.counter = 0;
    if (this.state !== 'failed') this.state = 'stopped';
  }

  /** Clears lap times, fuel history, top speed, delta and the track map. */
  resetSession() {
    this.tracker.reset();
    this.dirty = true;
  }

  private ingest(f: Frame) {
    this.latest = f;
    this.tracker.ingest(f);
    this.lastPacket = Date.now();
    this.counter++;
    if (this.source === 'ps5') {
      this.state = has(f, Flag.paused) || has(f, Flag.loading) || !has(f, Flag.onTrack) ? 'paused' : 'live';
    }
    this.dirty = true;
  }

  private publish() {
    this.dirty = false;
    this.snapshot = {
      frame: this.latest,
      stats: { ...this.tracker.stats },
      state: this.state,
      error: this.error,
      packetsPerSecond: this.pps,
    };
    this.listeners.forEach((l) => l());
  }
}

export const hub = new TelemetryHub();

/** React hook: the latest telemetry snapshot (re-renders ~25 times a second while data flows). */
export function useTelemetry(): Snapshot {
  return useSyncExternalStore(hub.subscribe, hub.getSnapshot);
}
