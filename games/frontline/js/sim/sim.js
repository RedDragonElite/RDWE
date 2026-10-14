/* RDE // FRONTLINE — authoritative, deterministic game simulation (core)
 *
 * Rules for multiplayer-readiness:
 *  - The ONLY way to change state from outside is sim.step(intents).
 *  - No DOM, no Date, no Math.random. Randomness comes from this.rng only.
 *  - Iteration orders are deterministic (arrays, insertion-ordered Sets/Maps).
 * Run the same intents on the same tick on every client => identical worlds (lockstep).
 *
 * Economy (resources, buildings, research, trade) lives in economy.js,
 * world events in events.js — both are mixed into Sim.prototype.
 */
(function (BW) {
  'use strict';
  const C = BW.C, T = C.T;

  class Sim {
    constructor(cfg) {
      this.cfg = cfg;
      this.rng = new BW.RNG((cfg.seed ^ 0xa5a5a5a5) >>> 0);
      this.map = BW.MapGen.generate({ seed: cfg.seed, W: cfg.W, H: cfg.H, type: cfg.mapType });
      const { W, H } = this.map;
      this.W = W; this.H = H; this.N = W * H;
      this.terrain = this.map.terrain;
      this.owner = new Uint16Array(this.N);
      this.rad = new Uint32Array(this.N); // radiation: tick until which a tile is irradiated
      this.tick = 0;
      this.phase = 'spawn';
      this.winner = 0;
      this.winReason = '';
      this.players = [null];
      this.attacks = [];
      this.boats = [];
      this.nukes = [];
      this.structures = [];
      this.structAt = new Map();
      this.allyRequests = [];
      this.events = [];
      this.changed = [];
      this.nextId = 1;
      this._nb = new Int32Array(4);
      this._bfsQ = new Int32Array(this.N);
      this._bfsPrev = new Int32Array(this.N);
      this._bfsSeen = new Uint32Array(this.N);
      this._bfsStamp = 0;

      this.deposits = this.map.deposits.map(d => Object.assign({ boost: 0 }, d));
      this.depAt = new Map(this.deposits.map(d => [d.tile, d]));
      this._initEconomy();
      this._initEvents();
      this._initArmy();
      this._initLegend();

      // --- players ------------------------------------------------------
      const used = new Set(), usedEmblems = new Set();
      for (const hp of cfg.humans) {
        this._addPlayer({ name: hp.name, color: hp.color, emblem: hp.emblem || '🐉', human: true, clientId: hp.clientId, diff: 'normal' });
        used.add(hp.color.join(','));
        usedEmblems.add(hp.emblem);
      }
      const names = this.rng.shuffle(C.NATION_NAMES.slice());
      const colors = this.rng.shuffle(C.PALETTE.filter(c => !used.has(c.join(','))));
      const emblems = this.rng.shuffle(C.EMBLEMS.filter(e => !usedEmblems.has(e)));
      for (let i = 0; i < cfg.bots; i++) {
        const name = names[i % names.length] + (i >= names.length ? ' ' + (2 + Math.floor(i / names.length)) : '');
        this._addPlayer({ name, color: colors[i % colors.length], emblem: emblems[i % emblems.length], human: false, diff: cfg.difficulty });
      }
      // bots claim their land right away so humans can pick around them
      for (const p of this.players) if (p && !p.human) this._spawn(p, this._findSpawnTile());
    }

    _addPlayer(o) {
      const id = this.players.length;
      const p = {
        id, name: o.name, color: o.color, emblem: o.emblem, human: o.human, clientId: o.clientId ?? null, diff: o.diff,
        alive: true, spawned: false, spawnTile: -1,
        troops: C.START_TROOPS, armyStr: 0, gold: 1500, glut: 0, ult: null, dragonHeart: false, tiles: 0, sx: 0, sy: 0,
        res: { food: 60, wood: 80, iron: 10, silver: 0, gems: 0, oil: 0, uranium: 0, sci: 0 },
        rates: { gold: 0, food: 0, wood: 0, iron: 0, silver: 0, gems: 0, oil: 0, uranium: 0, sci: 0 },
        terr: new Int32Array(8),
        tech: new Set(),
        fed: true,
        border: new Set(), allies: new Set(), traitorUntil: 0,
        counts: {}, built: {},
        nextThink: 0, lastTarget: 0,
        stats: { conquered: 0, lost: 0, nukes: 0, peak: 0, deathTick: 0, goldEarned: 0, crates: 0, trades: 0 },
      };
      for (const k in C.BUILD) { p.counts[k] = 0; p.built[k] = 0; }
      this.players.push(p);
      return p;
    }

    // ---------------------------------------------------------------- helpers
    isLand(t) { return this.terrain[t] >= T.BEACH; }
    xy(t) { return [t % this.W, (t / this.W) | 0]; }
    nbrs(t) {
      const W = this.W, nb = this._nb; let n = 0;
      const x = t % W;
      if (t >= W) nb[n++] = t - W;
      if (t < this.N - W) nb[n++] = t + W;
      if (x > 0) nb[n++] = t - 1;
      if (x < W - 1) nb[n++] = t + 1;
      return n;
    }
    allied(a, b) { return a !== 0 && b !== 0 && this.players[a].allies.has(b); }
    alivePlayers() { return this.players.filter(p => p && p.alive); }
    emit(type, data) { this.events.push(Object.assign({ type, tick: this.tick }, data)); }
    has(p, tech) { return p.tech.has(tech); }

    setOwner(t, o) {
      const old = this.owner[t];
      if (old === o) return;
      const x = t % this.W, y = (t / this.W) | 0, ter = this.terrain[t];
      this.owner[t] = o;
      if (old) {
        const p = this.players[old];
        p.tiles--; p.sx -= x; p.sy -= y; p.border.delete(t); p.stats.lost++; p.terr[ter]--;
      }
      if (o) {
        const p = this.players[o];
        p.tiles++; p.sx += x; p.sy += y; p.terr[ter]++;
        if (p.tiles > p.stats.peak) p.stats.peak = p.tiles;
      }
      this._updBorder(t);
      const n = this.nbrs(t), nb = this._nb;
      const a = nb[0], b = nb[1], c = nb[2], d = nb[3];
      if (n > 0) this._updBorder(a);
      if (n > 1) this._updBorder(b);
      if (n > 2) this._updBorder(c);
      if (n > 3) this._updBorder(d);
      const s = this.structAt.get(t);
      if (s) {
        if (o) {
          s.owner = o;
          if (s.kind === 'wonder') s.heldSince = this.tick;
          this.emit('captured', { sid: s.id, kind: s.kind, by: o, from: old, x, y });
        } else this._destroyStructure(s);
      }
      if (o && old !== o) {
        const d = this.depAt.get(t);
        if (d) this.emit('depositTaken', { pid: o, from: old, kind: d.kind, x, y });
      }
      this.changed.push(t);
    }
    _updBorder(t) {
      const o = this.owner[t];
      if (!o) return;
      const W = this.W, own = this.owner, x = t % W;
      const b = (t < W || own[t - W] !== o) || (t >= this.N - W || own[t + W] !== o) ||
        (x === 0 || own[t - 1] !== o) || (x === W - 1 || own[t + 1] !== o);
      if (b) this.players[o].border.add(t); else this.players[o].border.delete(t);
    }
    _ownNbCount(t, o) {
      const n = this.nbrs(t), nb = this._nb; let c = 0;
      for (let i = 0; i < n; i++) if (this.owner[nb[i]] === o) c++;
      return c;
    }
    centroid(p) {
      return p.tiles ? [p.sx / p.tiles, p.sy / p.tiles] : this.xy(Math.max(0, p.spawnTile));
    }

    // ---------------------------------------------------------------- spawn
    _findSpawnTile() {
      let best = -1, bestD = -1;
      const spawns = this.players.filter(p => p && p.spawned).map(p => this.xy(p.spawnTile));
      for (let k = 0; k < 160; k++) {
        const t = this.rng.int(this.N);
        const tt = this.terrain[t];
        if (tt !== T.PLAINS && tt !== T.FOREST && tt !== T.HILLS) continue;
        if (this.owner[t]) continue;
        const [x, y] = this.xy(t);
        let md = 1e9;
        for (const [sx, sy] of spawns) md = Math.min(md, (sx - x) ** 2 + (sy - y) ** 2);
        if (md > bestD) { bestD = md; best = t; }
      }
      if (best < 0) for (let t = 0; t < this.N; t++) if (this.isLand(t) && !this.owner[t]) return t;
      return best;
    }
    _spawn(p, tile) {
      if (tile < 0 || !this.isLand(tile)) return false;
      const o = this.owner[tile];
      if (o && o !== p.id) return false;
      if (p.spawned) { // relocate during spawn phase
        for (let t = 0; t < this.N && p.tiles; t++) if (this.owner[t] === p.id) this.setOwner(t, 0);
      }
      const [cx, cy] = this.xy(tile), R = C.SPAWN_RADIUS;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > R * R + 1) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= this.W || y >= this.H) continue;
        const t = y * this.W + x;
        if (this.isLand(t) && !this.owner[t]) this.setOwner(t, p.id);
      }
      p.spawned = true; p.spawnTile = tile;
      this.emit('spawn', { pid: p.id, x: cx, y: cy });
      return true;
    }

    // ---------------------------------------------------------------- main step
    step(intents) {
      this.events.length = 0;
      this.changed.length = 0;
      if (intents) for (const it of intents) this.applyIntent(it);

      if (this.phase === 'spawn') {
        if (this.tick >= C.SPAWN_TICKS) {
          for (const p of this.players) if (p && !p.spawned) this._spawn(p, this._findSpawnTile());
          this.phase = 'play';
          this.emit('phase', { phase: 'play' });
        }
        this.tick++;
        return;
      }
      if (this.phase === 'over') { this.tick++; return; }

      this._recountStructures();
      this._economyTick();
      for (const p of this.players) {
        if (!p || !p.alive) continue;
        this.addGlut(p, 0.008);
        const max = this.maxTroops(p), total = p.troops + p.armyStr; // fielded armies count toward the cap
        if (total < max) p.troops = Math.min(max - p.armyStr, p.troops + this.troopRate(p));
        else p.troops -= Math.min(p.troops, (total - max) * 0.02);
        if (!p.human && this.tick >= p.nextThink) {
          const d = C.DIFFICULTY[p.diff].think;
          p.nextThink = this.tick + d[0] + this.rng.int(d[1] - d[0]);
          BW.AI.think(this, p);
        }
      }
      this._processAttacks();
      this._processUnits();
      this._processBoats();
      this._processTradeShips();
      this._processNukes();
      this._eventsTick();
      this._dragonTick();
      this.allyRequests = this.allyRequests.filter(r => r.expires > this.tick);
      this._checkDeaths();
      this._checkWin();
      this.tick++;
    }

    applyIntent(it) {
      const p = this.players[it.pid];
      if (!p || !p.alive) return;
      switch (it.type) {
        case 'spawn':
          if (this.phase === 'spawn') this._spawn(p, it.tile);
          break;
        case 'attack': if (this.phase === 'play') this.cmdAttack(p, it.tile, it.ratio); break;
        case 'boat': if (this.phase === 'play') this.cmdBoat(p, it.tile, it.ratio); break;
        case 'build': if (this.phase === 'play') this.cmdBuild(p, it.kind, it.tile); break;
        case 'nuke': if (this.phase === 'play') this.cmdNuke(p, it.kind, it.tile); break;
        case 'research': if (this.phase === 'play') this.cmdResearch(p, it.tech); break;
        case 'trade': if (this.phase === 'play') this.cmdTrade(p, it.res, it.qty, it.side); break;
        case 'deploy': if (this.phase === 'play') this.cmdDeploy(p, it.kind, it.tile, it.ratio); break;
        case 'move': if (this.phase === 'play') this.cmdMove(p, it.ids, it.tile); break;
        case 'stop': this.cmdStop(p, it.ids); break;
        case 'disband': this.cmdDisband(p, it.ids); break;
        case 'ultimate': if (this.phase === 'play') this.cmdUltimate(p, it.kind, it.tile); break;
        case 'ally': this.cmdAlly(p, it.target); break;
        case 'allyReply': this.cmdAllyReply(p, it.target, it.accept); break;
        case 'unally': this.cmdUnally(p, it.target); break;
      }
    }

    // ---------------------------------------------------------------- troops
    maxTroops(p) {
      let m = Math.pow(p.tiles, 0.72) * 55 + 2000 + p.counts.city * 25000;
      if (this.has(p, 'med')) m *= 1.15;
      if (p.counts.wonder) m *= 1.2;
      return Math.floor(m);
    }
    troopRate(p) {
      const max = this.maxTroops(p);
      let mult = p.human ? 1 : C.DIFFICULTY[p.diff].growth;
      mult *= 1 + 0.12 * Math.min(5, p.counts.barracks);
      mult *= p.fed ? 1.15 : 0.7;
      if (this.has(p, 'empire')) mult *= 1.2;
      if (p.dragonHeart) mult *= 1.25;
      return Math.max(0, (10 + Math.pow(Math.max(p.troops, 1), 0.73) / 4) * (1 - (p.troops + p.armyStr) / max)) * mult;
    }

    // ---------------------------------------------------------------- attacks
    cmdAttack(p, tile, ratio) {
      if (tile < 0 || tile >= this.N || !this.isLand(tile)) return;
      const target = this.owner[tile];
      if (target === p.id) return;
      if (this.allied(p.id, target)) { this.emit('fail', { pid: p.id, msg: 'Verbündete kann man nicht angreifen.' }); return; }
      ratio = Math.max(0.01, Math.min(1, +ratio || 0.3));
      const troops = Math.floor(p.troops * ratio);
      if (troops < 1) return;
      if (this.startAttack(p, target, troops, null)) return;
      this.cmdBoat(p, tile, ratio); // not adjacent → amphibious landing
    }

    startAttack(p, target, troops, seeds) {
      if (target !== 0) {
        const D = this.players[target];
        if (!D || !D.alive || this.allied(p.id, target)) return false;
      }
      let a = this.attacks.find(x => x.attacker === p.id && x.target === target);
      const fresh = !a;
      if (fresh) a = { id: this.nextId++, attacker: p.id, target, troops: 0, cand: [], pos: new Map(), start: this.tick };
      const add = (t) => { if (this.owner[t] === target && this.isLand(t)) this._addCand(a, t); };
      if (seeds) {
        for (const s of seeds) { const n = this.nbrs(s); const nb = Array.from(this._nb.subarray(0, n)); for (const t of nb) add(t); }
      } else {
        for (const b of p.border) { const n = this.nbrs(b); for (let i = 0; i < n; i++) add(this._nb[i]); }
      }
      if (!a.cand.length) return false;
      p.troops -= troops;
      if (target !== 0) { // head-on collision with a counter attack
        const opp = this.attacks.find(x => x.attacker === target && x.target === p.id);
        if (opp) {
          const m = Math.min(opp.troops, troops);
          opp.troops -= m; troops -= m;
          if (opp.troops <= 0.5) this._endAttack(opp, false);
          if (troops <= 0.5) { this.emit('clash', { pid: p.id, target }); if (fresh) return true; }
        }
      }
      a.troops += troops;
      if (fresh) this.attacks.push(a);
      this.emit('attack', { pid: p.id, target, troops: a.troops, merged: !fresh });
      return true;
    }
    _addCand(a, t) { if (!a.pos.has(t)) { a.pos.set(t, a.cand.length); a.cand.push(t); } }
    _removeCand(a, t) {
      const i = a.pos.get(t);
      if (i === undefined) return;
      const last = a.cand.pop();
      if (i < a.cand.length) { a.cand[i] = last; a.pos.set(last, i); }
      a.pos.delete(t);
    }
    _endAttack(a, refund) {
      const i = this.attacks.indexOf(a);
      if (i >= 0) this.attacks.splice(i, 1);
      if (refund && a.troops > 0) {
        const p = this.players[a.attacker];
        if (p.alive) p.troops += a.troops;
      }
      a.troops = 0;
      this.emit('attackEnd', { pid: a.attacker, target: a.target });
    }
    tileCost(t, attacker, target) {
      let tm = C.TERRAIN[this.terrain[t]].cost * (this.rad[t] > this.tick ? 4 : 1) * (this.burn[t] > this.tick ? 2.5 : 1);
      if (this.has(attacker, 'steel')) tm *= 0.88;
      if (!target) return 6 * tm * (1 + attacker.tiles / 60000);
      const D = this.players[target];
      const dens = D.troops / Math.max(1, D.tiles);
      let c = (8 + dens * 1.25) * tm;
      if (this._inFort(t, target)) c *= this.has(D, 'fort2') ? 3.5 : 2.5;
      if (this.has(D, 'elite')) c *= 1.25;
      if (D.counts.wonder) c *= 1.3;
      if (this.ultActive(D, 'bulwark')) c *= 3;
      return c;
    }
    _inFort(t, owner) {
      const R = C.BUILD.fort.radius, x = t % this.W, y = (t / this.W) | 0;
      for (const s of this.structures) {
        if (s.kind !== 'fort' || s.owner !== owner || !this.active(s)) continue;
        if (Math.abs(s.x - x) <= R && Math.abs(s.y - y) <= R) return true;
      }
      return false;
    }
    _processAttacks() {
      const list = this.attacks.slice();
      for (const a of list) {
        if (this.attacks.indexOf(a) < 0) continue;
        const A = this.players[a.attacker];
        if (!A.alive) { this._endAttack(a, false); continue; }
        const D = a.target ? this.players[a.target] : null;
        if (D && (!D.alive || this.allied(A.id, D.id))) { this._endAttack(a, true); continue; }
        let rate = D ? 0.08 : 0.14;
        if (this.has(A, 'logi')) rate *= 1.3;
        if (this.ultActive(A, 'blitz')) rate *= 2;
        const n = Math.min(a.cand.length, 1 + Math.floor(a.cand.length * rate));
        let stalled = false;
        for (let k = 0; k < n && a.cand.length; k++) {
          let bestT = -1, bestS = -1e9;
          for (let s = 0; s < 6 && a.cand.length; s++) {
            const t = a.cand[this.rng.int(a.cand.length)];
            if (this.owner[t] !== a.target) { this._removeCand(a, t); continue; }
            const own = this._ownNbCount(t, A.id);
            if (!own) { this._removeCand(a, t); continue; }
            const sc = own + this.rng.next() * 1.4 - C.TERRAIN[this.terrain[t]].cost * 0.5;
            if (sc > bestS) { bestS = sc; bestT = t; }
          }
          if (bestT < 0) continue;
          const cost = this.tileCost(bestT, A, a.target);
          if (a.troops < cost) { stalled = true; break; }
          a.troops -= cost;
          if (D) D.troops = Math.max(0, D.troops - (D.troops / Math.max(1, D.tiles)) * 0.85);
          this.setOwner(bestT, A.id);
          this.addGlut(A, D ? 0.012 : 0.0012);
          A.stats.conquered++;
          this._removeCand(a, bestT);
          const m = this.nbrs(bestT);
          for (let i = 0; i < m; i++) {
            const nt = this._nb[i];
            if (this.owner[nt] === a.target && this.isLand(nt)) this._addCand(a, nt);
          }
        }
        if (stalled || !a.cand.length) this._endAttack(a, true);
      }
    }

    // ---------------------------------------------------------------- boats
    findBoatPath(pid, tile) {
      const N = this.N, q = this._bfsQ, prev = this._bfsPrev, seen = this._bfsSeen;
      const stamp = ++this._bfsStamp;
      const tgtOwner = this.owner[tile], own = this.owner, ter = this.terrain;
      let h = 0, tl = 0;
      q[tl++] = tile; seen[tile] = stamp; prev[tile] = -1;
      let goal = -1;
      while (h < tl && goal < 0) {
        const t = q[h++];
        const land = ter[t] >= T.BEACH;
        const n = this.nbrs(t);
        const nb = [this._nb[0], this._nb[1], this._nb[2], this._nb[3]];
        for (let i = 0; i < n; i++) {
          const nt = nb[i];
          if (seen[nt] === stamp) continue;
          const nl = ter[nt] >= T.BEACH;
          if (nl && (!land || own[nt] !== tgtOwner)) continue; // walk only through the target's own land
          seen[nt] = stamp; prev[nt] = t; q[tl++] = nt;
          if (!nl) {
            const m = this.nbrs(nt);
            for (let j = 0; j < m; j++) if (own[this._nb[j]] === pid) { goal = nt; break; }
            if (goal >= 0) break;
          }
        }
        if (tl >= N) break;
      }
      if (goal < 0) return null;
      const path = [];
      let landing = -1;
      for (let t = goal; t !== -1; t = prev[t]) {
        if (ter[t] >= T.BEACH) { landing = t; break; }
        path.push(t);
      }
      if (landing < 0 || path.length < 1) return null;
      return { path: Int32Array.from(path), landing };
    }
    maxBoats(p) { return C.MAX_BOATS + (this.has(p, 'nav') ? 1 : 0); }
    cmdBoat(p, tile, ratio) {
      if (tile < 0 || tile >= this.N || !this.isLand(tile) || this.owner[tile] === p.id) return;
      if (this.allied(p.id, this.owner[tile])) return;
      if (this.boats.filter(b => b.owner === p.id).length >= this.maxBoats(p)) {
        this.emit('fail', { pid: p.id, msg: 'Maximal ' + this.maxBoats(p) + ' Boote gleichzeitig.' }); return;
      }
      const r = this.findBoatPath(p.id, tile);
      if (!r) { this.emit('fail', { pid: p.id, msg: 'Kein Weg dorthin – weder Land- noch Seeverbindung.' }); return; }
      const troops = Math.floor(p.troops * Math.max(0.01, Math.min(1, +ratio || 0.3)));
      if (troops < 10) return;
      p.troops -= troops;
      let speed = p.counts.port ? 2.4 : 1.6;
      if (this.has(p, 'nav')) speed *= 1.3;
      const b = { id: this.nextId++, owner: p.id, troops, path: r.path, landing: r.landing, prog: 0, speed };
      this.boats.push(b);
      this.emit('boat', { pid: p.id, bid: b.id, target: this.owner[r.landing] });
    }
    _shipSpeed(path, prog, speed) {
      if (!this.storm) return speed;
      const t = path[Math.min(path.length - 1, Math.floor(prog))];
      const [x, y] = this.xy(t), [sx, sy] = this.stormPos();
      return (x - sx) ** 2 + (y - sy) ** 2 < this.storm.r * this.storm.r ? speed * 0.35 : speed;
    }
    _processBoats() {
      for (const b of this.boats.slice()) {
        const P = this.players[b.owner];
        if (!P.alive) { this.boats.splice(this.boats.indexOf(b), 1); continue; }
        b.prog += this._shipSpeed(b.path, b.prog, b.speed);
        if (b.prog < b.path.length - 1) continue;
        this.boats.splice(this.boats.indexOf(b), 1);
        const L = b.landing, o = this.owner[L];
        const [x, y] = this.xy(L);
        if (o === b.owner || this.allied(b.owner, o)) { P.troops += b.troops; this.emit('boatLand', { pid: b.owner, x, y, ok: true }); continue; }
        const cost = this.tileCost(L, P, o);
        if (b.troops < cost) { this.emit('boatLand', { pid: b.owner, x, y, ok: false, target: o }); continue; }
        b.troops -= cost;
        this.setOwner(L, b.owner);
        this.emit('boatLand', { pid: b.owner, x, y, ok: true, target: o });
        P.troops += b.troops; // startAttack draws them back out (or they stay home if blocked)
        this.startAttack(P, o, b.troops, [L]);
      }
    }

    // ---------------------------------------------------------------- nukes / missiles
    cmdNuke(p, kind, tile) {
      const d = C.NUKES[kind];
      if (!d || tile < 0 || tile >= this.N) return;
      if (d.tech && !this.has(p, d.tech)) { this.emit('fail', { pid: p.id, msg: 'Erst erforschen: ' + C.TECH[d.tech].name }); return; }
      const silos = this.structures.filter(s => s.kind === 'silo' && s.owner === p.id && s.done <= this.tick);
      if (!silos.length) { this.emit('fail', { pid: p.id, msg: 'Du brauchst ein fertiges Raketensilo.' }); return; }
      if (!this.canAfford(p, d.cost)) { this.emit('fail', { pid: p.id, msg: 'Nicht genug Ressourcen.' }); return; }
      const [tx, ty] = this.xy(tile);
      let best = null, bd = 1e18;
      for (const s of silos) {
        if (s.cd > this.tick || s.off > this.tick) continue;
        const dd = (s.x - tx) ** 2 + (s.y - ty) ** 2;
        if (dd < bd) { bd = dd; best = s; }
      }
      if (!best) { this.emit('fail', { pid: p.id, msg: 'Silo lädt nach…' }); return; }
      this.pay(p, d.cost);
      best.cd = this.tick + 50;
      const flight = Math.round(30 + Math.sqrt(bd) / 5);
      const n = { id: this.nextId++, owner: p.id, kind, fx: best.x, fy: best.y, tx, ty, tile,
        launched: this.tick, eta: this.tick + flight, checked: false };
      this.nukes.push(n);
      p.stats.nukes++;
      const victim = this.owner[tile];
      if (victim && this.allied(p.id, victim)) this._breakAlliance(p, this.players[victim], true);
      this.emit('nukeLaunch', { pid: p.id, nid: n.id, kind, victim, tx, ty });
    }
    _processNukes() {
      for (const n of this.nukes.slice()) {
        const u = (this.tick - n.launched) / (n.eta - n.launched);
        if (!n.checked && u >= 0.65) {
          n.checked = true;
          const elecR = 20;
          for (const s of this.structures) {
            if (s.kind !== 'sam' || s.owner === n.owner || this.allied(s.owner, n.owner) || s.cd > this.tick || !this.active(s)) continue;
            const O = this.players[s.owner];
            const R = C.BUILD.sam.radius + (this.has(O, 'elec') ? elecR : 0);
            if ((s.x - n.tx) ** 2 + (s.y - n.ty) ** 2 > R * R) continue;
            s.cd = this.tick + 70;
            let p = C.NUKES[n.kind].intercept + (this.has(O, 'elec') ? 0.15 : 0);
            const RR = C.BUILD.radar.radius;
            if (this.structures.some(r => r.kind === 'radar' && r.owner === s.owner && this.active(r) && (r.x - s.x) ** 2 + (r.y - s.y) ** 2 <= RR * RR)) p += 0.15;
            if (this.rng.next() < Math.min(0.97, p)) {
              this.nukes.splice(this.nukes.indexOf(n), 1);
              const gx = n.fx + (n.tx - n.fx) * u, gy = n.fy + (n.ty - n.fy) * u;
              this.emit('nukeIntercept', { nid: n.id, owner: n.owner, by: s.owner, x: gx, y: gy, sx: s.x, sy: s.y, u });
            }
            break;
          }
          if (this.nukes.indexOf(n) < 0) continue;
        }
        if (this.tick >= n.eta) {
          this.nukes.splice(this.nukes.indexOf(n), 1);
          if (n.kind === 'emp') this._emp(n);
          else {
            const victims = this._blast(n.tx, n.ty, C.NUKES[n.kind].radius, { rad: 600, troop: 1.6 });
            const dr = this.dragon, R = C.NUKES[n.kind].radius + 4;
            if (dr && (dr.x - n.tx) ** 2 + (dr.y - n.ty) ** 2 < R * R) this._hurtDragon(n.owner, n.kind === 'hydro' ? 60000 : 25000);
            this.emit('nukeHit', { nid: n.id, owner: n.owner, kind: n.kind, x: n.tx, y: n.ty, r: C.NUKES[n.kind].radius, victims });
          }
        }
      }
    }
    /** Generic area destruction used by nukes, meteors and volcanoes. Returns victim ids. */
    _blast(cx, cy, R, o) {
      const lost = new Map();
      const bunkers = this.structures.filter(s => s.kind === 'bunker' && this.active(s) &&
        (s.x - cx) ** 2 + (s.y - cy) ** 2 <= (R + C.BUILD.bunker.radius) ** 2);
      const BR = C.BUILD.bunker.radius;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > R * R) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= this.W || y >= this.H) continue;
        const t = y * this.W + x;
        const r = Math.sqrt(d2) / R;
        if (o.rad) this.rad[t] = Math.max(this.rad[t], this.tick + o.rad);
        const ow = this.owner[t];
        let prot = false;
        if (ow && bunkers.length) for (const b of bunkers) if (b.owner === ow && (b.x - x) ** 2 + (b.y - y) ** 2 <= BR * BR) { prot = true; break; }
        let prob = r < 0.65 ? 1 : 1 - (r - 0.65) / 0.35 * 0.8;
        if (prot) prob *= 0.35;
        if (this.rng.next() > prob) continue;
        const s = this.structAt.get(t);
        if (s && r < 0.85 && !prot) this._destroyStructure(s);
        if (ow) { lost.set(ow, (lost.get(ow) || 0) + 1); this.setOwner(t, 0); }
      }
      for (const [ow, c] of lost) {
        const P = this.players[ow];
        P.troops -= P.troops * Math.min(0.85, (c / (P.tiles + c)) * (o.troop || 1));
      }
      return [...lost.keys()];
    }
    _emp(n) {
      const R = C.NUKES.emp.radius, hit = [];
      for (const s of this.structures) {
        if ((s.x - n.tx) ** 2 + (s.y - n.ty) ** 2 > R * R) continue;
        s.off = this.tick + C.NUKES.emp.emp;
        hit.push(s.id);
      }
      this.emit('empHit', { owner: n.owner, x: n.tx, y: n.ty, r: R, count: hit.length });
    }

    // ---------------------------------------------------------------- diplomacy
    _makeAlliance(a, b) {
      a.allies.add(b.id); b.allies.add(a.id);
      for (const at of this.attacks.slice()) {
        if ((at.attacker === a.id && at.target === b.id) || (at.attacker === b.id && at.target === a.id)) this._endAttack(at, true);
      }
      this.allyRequests = this.allyRequests.filter(r => !((r.from === a.id && r.to === b.id) || (r.from === b.id && r.to === a.id)));
      this.emit('ally', { a: a.id, b: b.id });
    }
    _breakAlliance(a, b, viaNuke) {
      if (!a.allies.has(b.id)) return;
      a.allies.delete(b.id); b.allies.delete(a.id);
      a.traitorUntil = this.tick + 600;
      this.emit('unally', { a: a.id, b: b.id, viaNuke: !!viaNuke });
    }
    cmdAlly(p, target) {
      const B = this.players[target];
      if (!B || !B.alive || B === p || p.allies.has(target)) return;
      if (B.human) {
        if (this.allyRequests.some(r => r.from === p.id && r.to === B.id)) return;
        const back = this.allyRequests.find(r => r.from === B.id && r.to === p.id);
        if (back) { this._makeAlliance(p, B); return; }
        this.allyRequests.push({ from: p.id, to: B.id, expires: this.tick + 200 });
        this.emit('allyRequest', { from: p.id, to: B.id });
        return;
      }
      if (BW.AI.acceptAlliance(this, B, p)) this._makeAlliance(p, B);
      else this.emit('allyDenied', { from: p.id, to: B.id });
    }
    cmdAllyReply(p, from, accept) {
      const r = this.allyRequests.find(x => x.from === from && x.to === p.id);
      if (!r) return;
      this.allyRequests.splice(this.allyRequests.indexOf(r), 1);
      if (accept && this.players[from].alive) this._makeAlliance(p, this.players[from]);
      else this.emit('allyDenied', { from, to: p.id });
    }
    cmdUnally(p, target) {
      const B = this.players[target];
      if (B) this._breakAlliance(p, B, false);
    }

    // ---------------------------------------------------------------- end conditions
    _checkDeaths() {
      for (const p of this.players) {
        if (!p || !p.alive || !p.spawned || p.tiles > 0) continue;
        p.alive = false; p.troops = 0; p.stats.deathTick = this.tick;
        for (const a of this.attacks.slice()) if (a.attacker === p.id) this._endAttack(a, false);
        this.boats = this.boats.filter(b => b.owner !== p.id);
        this.units = this.units.filter(u => u.owner !== p.id);
        for (const q of this.players) if (q) q.allies.delete(p.id);
        p.allies.clear();
        this.emit('eliminated', { pid: p.id });
      }
    }
    _checkWin() {
      const alive = this.alivePlayers();
      let winner = 0, reason = 'land';
      for (const p of alive) if (p.tiles / this.map.landCount >= C.WIN_SHARE) winner = p.id;
      if (!winner) {
        for (const s of this.structures) {
          if (s.kind === 'wonder' && s.done <= this.tick && this.tick - s.heldSince >= C.WONDER_HOLD) { winner = s.owner; reason = 'wonder'; break; }
        }
      }
      if (!winner && alive.length === 1) { winner = alive[0].id; reason = 'last'; }
      if (!winner && alive.length > 1 && alive.every(p => alive.every(q => q === p || p.allies.has(q.id)))) {
        winner = alive.reduce((a, b) => (b.tiles > a.tiles ? b : a)).id; reason = 'peace';
      }
      if (winner) {
        this.phase = 'over'; this.winner = winner; this.winReason = reason;
        this.emit('gameOver', { winner, reason });
      }
    }

    /** Cheap state fingerprint for desync detection between lockstep peers. */
    hash() {
      let h = 2166136261 >>> 0;
      const o = this.owner;
      for (let i = 0; i < o.length; i += 3) { h ^= o[i]; h = Math.imul(h, 16777619); }
      for (const p of this.players) if (p) {
        h ^= (p.troops | 0) ^ (p.tiles << 8) ^ (p.gold | 0); h = Math.imul(h, 16777619);
        for (const k of C.TRADE_RES) { h ^= (p.res[k] * 10) | 0; h = Math.imul(h, 16777619); }
      }
      for (const u of this.units) { h ^= (u.str | 0) ^ ((u.x * 16) | 0); h = Math.imul(h, 16777619); }
      if (this.dragon) { h ^= this.dragon.hp | 0; h = Math.imul(h, 16777619); }
      return (h ^ this.tick ^ this.structures.length) >>> 0;
    }
  }

  Object.assign(Sim.prototype, BW.SimEconomy, BW.SimEvents, BW.SimArmy, BW.SimLegend);
  BW.Sim = Sim;
})(globalThis.BW = globalThis.BW || {});
