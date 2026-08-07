/**
 * Instrumented HTTPS Agent
 *
 * Extends Node's https.Agent to capture per-connection timing:
 *   - DNS lookup
 *   - TCP connect
 *   - TLS handshake
 *
 * For reused (keep-alive) connections all three are zero.
 * Singleton — passed to the Anthropic SDK constructor once.
 *
 * Wires into Node.js net/tls socket lifecycle events:
 *   'lookup' callback  → DNS done
 *   'connect' event    → TCP established
 *   'secureConnect'    → TLS handshake finished
 */

import * as https from 'https';
import * as dns from 'dns';
import { Socket } from 'net';
import { createLogger } from '../../config/logger';

const log = createLogger('InstrumentedHttpsAgent');

// ── Types ──────────────────────────────────────────────────────────────────

export interface ConnectionTimings {
  dnsLookupMs: number;
  tcpConnectMs: number;
  tlsHandshakeMs: number;
  /** true when the request reused an existing keep-alive socket */
  reused: boolean;
}

export type TimingCallback = (timings: ConnectionTimings) => void;

// ── Agent ──────────────────────────────────────────────────────────────────

export class InstrumentedHttpsAgent extends https.Agent {
  private _timingCbs: TimingCallback[] = [];
  private _connectionCount = 0;
  private _lastTiming: ConnectionTimings | null = null;

  constructor() {
    super({
      keepAlive: true,
      maxSockets: 10,
      // Reasonable idle timeout: close sockets idle > 55s so we don't
      // hold dead connections past the server's 60s keep-alive window.
      keepAliveMsecs: 55_000,
    });
  }

  /** Register a callback invoked every time a new connection is established. */
  onTiming(cb: TimingCallback): void {
    this._timingCbs.push(cb);
  }

  /**
   * Snapshot the current connection count. After the API call, compare
   * with `connectionDelta()` to detect whether a new connection was
   * established during the request window.
   */
  snapshotConnectionCount(): number {
    return this._connectionCount;
  }

  /**
   * Returns timing info for the request window.
   * If a new connection was opened → returns its timings with reused=false.
   * If no new connection (keep-alive) → returns zero-timings with reused=true.
   */
  connectionDelta(prevCount: number): ConnectionTimings {
    if (this._connectionCount > prevCount && this._lastTiming) {
      // Consume the timing so it isn't reused by a later request
      const t = this._lastTiming;
      this._lastTiming = null;
      return t;
    }
    return { dnsLookupMs: 0, tcpConnectMs: 0, tlsHandshakeMs: 0, reused: true };
  }

  // ── Override: instrument new connections ──────────────────────────────

  /**
   * Override to instrument new connections.  We match the broader http.Agent
   * signature and access TLS-specific options via `any` internally — at
   * runtime this agent is used exclusively for HTTPS.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createConnection(options: any, cb?: any): any {
    const timings: ConnectionTimings = {
      dnsLookupMs: 0,
      tcpConnectMs: 0,
      tlsHandshakeMs: 0,
      reused: false,
    };

    const t0 = process.hrtime.bigint();
    let dnsEnd = 0n;
    let tcpEnd = 0n;

    // ── DNS instrumentation ─────────────────────────────────────────
    const origLookup = options.lookup;

    options.lookup = (
      hostname: string,
      opts: any,
      callback: (err: Error | null, address: string, family: number) => void,
    ) => {
      const dnsStart = process.hrtime.bigint();
      const wrappedCb = (err: Error | null, address: string, family: number) => {
        dnsEnd = process.hrtime.bigint();
        timings.dnsLookupMs = Number(dnsEnd - dnsStart) / 1e6;
        callback(err, address, family);
      };
      if (origLookup) {
        origLookup(hostname, opts, wrappedCb);
      } else {
        // Fallback to the default system resolver when no custom lookup
        dns.lookup(hostname, opts, wrappedCb);
      }
    };

    // ── Create the underlying socket ─────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const socket: Socket = (https.Agent.prototype.createConnection as any).call(
      this,
      options,
      cb,
    ) as Socket;

    // ── TCP instrumentation ─────────────────────────────────────────
    socket.once('connect', () => {
      tcpEnd = process.hrtime.bigint();
      timings.tcpConnectMs = Number(tcpEnd - t0) / 1e6 - timings.dnsLookupMs;
    });

    // ── TLS instrumentation ─────────────────────────────────────────
    socket.once('secureConnect', () => {
      const tlsEnd = process.hrtime.bigint();
      timings.tlsHandshakeMs = Number(tlsEnd - (tcpEnd || t0)) / 1e6;
    });

    // ── Emit once socket is ready ───────────────────────────────────
    socket.once('ready', () => {
      this._emit(timings);
    });

    return socket;
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private _emit(timings: ConnectionTimings): void {
    this._connectionCount++;
    this._lastTiming = timings;
    // Log connection details at info level so they surface even in production
    log.info(
      `🔌 New connection #${this._connectionCount}: ` +
      `DNS=${timings.dnsLookupMs.toFixed(1)}ms ` +
      `TCP=${timings.tcpConnectMs.toFixed(1)}ms ` +
      `TLS=${timings.tlsHandshakeMs.toFixed(1)}ms | ` +
      `pool=${JSON.stringify(this.poolStats())}`,
    );
    for (const cb of this._timingCbs) {
      try { cb(timings); } catch { /* never let a callback break networking */ }
    }
  }

  /**
   * Return a snapshot of the current socket pool for diagnostics.
   * Casts through `any` because freeSockets/sockets are deprecated
   * (but still present) in @types/node.
   */
  poolStats(): { free: number; active: number; pending: number } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const self = this as any;
    let free = 0, active = 0, pending = 0;
    for (const arr of Object.values(self.freeSockets || {})) free += (arr as any[]).length;
    for (const arr of Object.values(self.sockets || {})) active += (arr as any[]).length;
    for (const arr of Object.values(self.requests || {})) pending += (arr as any[]).length;
    return { free, active, pending };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: InstrumentedHttpsAgent | null = null;

/**
 * Return the shared singleton InstrumentedHttpsAgent.
 * Call once at startup; the same agent is reused for all requests.
 */
export function getInstrumentedAgent(): InstrumentedHttpsAgent {
  if (!_instance) {
    _instance = new InstrumentedHttpsAgent();
    log.info('InstrumentedHttpsAgent singleton created (keepAlive enabled).');
  }
  return _instance;
}

export default InstrumentedHttpsAgent;
