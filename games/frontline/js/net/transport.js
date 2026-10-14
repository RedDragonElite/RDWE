/* RDE // FRONTLINE — intent transport layer
 *
 * The client never mutates the sim directly. It calls transport.send(intent);
 * the game loop asks transport.intentsFor(tick) before every sim.step().
 *
 * LocalTransport   – singleplayer: intents execute on the next tick.
 * LockstepTransport – multiplayer skeleton: intents are sent to a relay server,
 *                     which stamps them with an execution tick and broadcasts
 *                     "turn" bundles. A client may only step tick T once the
 *                     bundle for T has arrived → all peers stay in sync.
 *
 * Wire protocol (JSON over WebSocket):
 *   C→S {t:'join', name, color}
 *   S→C {t:'start', seed, W, H, mapType, bots, difficulty, humans:[{clientId,name,color}], you}
 *   C→S {t:'intent', intent}
 *   S→C {t:'turn', tick, intents:[...]}        (one per tick, possibly empty)
 *   C→S {t:'hash', tick, hash}                 (every 50 ticks, desync detection)
 */
(function (BW) {
  'use strict';

  class LocalTransport {
    constructor() { this.queue = []; this.multiplayer = false; }
    send(intent) { this.queue.push(intent); }
    canStep() { return true; }
    intentsFor() { const q = this.queue; this.queue = []; return q; }
    reportHash() {}
  }

  class LockstepTransport {
    constructor(url, handlers) {
      this.multiplayer = true;
      this.turns = new Map();
      this.handlers = handlers || {};
      this.ws = new WebSocket(url);
      this.ws.onopen = () => this.handlers.open && this.handlers.open();
      this.ws.onclose = () => this.handlers.close && this.handlers.close();
      this.ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.t === 'turn') this.turns.set(m.tick, m.intents);
        else if (this.handlers[m.t]) this.handlers[m.t](m);
      };
    }
    join(name, color) { this._out({ t: 'join', name, color }); }
    send(intent) { this._out({ t: 'intent', intent }); }
    canStep(tick) { return this.turns.has(tick); }
    intentsFor(tick) { const i = this.turns.get(tick) || []; this.turns.delete(tick); return i; }
    reportHash(tick, hash) { if (tick % 50 === 0) this._out({ t: 'hash', tick, hash }); }
    _out(m) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  }

  BW.Net = { LocalTransport, LockstepTransport };
})(globalThis.BW = globalThis.BW || {});
