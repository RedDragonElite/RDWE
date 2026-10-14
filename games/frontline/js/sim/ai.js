/* RDE // FRONTLINE — nation AI
 * Runs INSIDE the simulation (deterministic, uses sim.rng) so bots behave
 * identically on every lockstep client without any network traffic. */
(function (BW) {
  'use strict';
  const C = BW.C, T = C.T;

  const TECH_ORDER = ['agri', 'mining', 'steel', 'med', 'econ', 'nav', 'fort2', 'logi', 'fission', 'arch', 'elite', 'elec', 'fusion', 'empire'];

  function scanNeighbours(sim, p) {
    const counts = new Map();
    let neutral = 0, coast = 0;
    const border = [];
    for (const t of p.border) {
      border.push(t);
      const n = sim.nbrs(t);
      for (let i = 0; i < n; i++) {
        const u = sim._nb[i];
        if (!sim.isLand(u)) { coast++; continue; }
        const o = sim.owner[u];
        if (o === p.id) continue;
        if (o === 0) neutral++;
        else counts.set(o, (counts.get(o) || 0) + 1);
      }
    }
    return { counts, neutral, coast, border };
  }

  function interiorTile(sim, p, border) {
    const [cx, cy] = sim.centroid(p);
    const c = Math.round(cy) * sim.W + Math.round(cx);
    const ok = (t) => t >= 0 && t < sim.N && sim.owner[t] === p.id;
    if (ok(c) && sim.rng.chance(0.3)) return c;
    for (let k = 0; k < 16 && border.length; k++) {
      const b = sim.rng.pick(border);
      const [bx, by] = sim.xy(b);
      const f = sim.rng.range(0.35, 0.8);
      const t = Math.round(by + (cy - by) * f) * sim.W + Math.round(bx + (cx - bx) * f);
      if (ok(t)) return t;
    }
    return ok(c) ? c : -1;
  }

  function tryBuild(sim, p, kind, tile) {
    if (tile < 0 || sim.buildBlocker(p, kind)) return false;
    const t = sim.canBuildAt(p, kind, tile);
    if (t < 0) return false;
    sim.cmdBuild(p, kind, t);
    return true;
  }

  function economy(sim, p, D, border, coast, underAttack) {
    const b = p.built, r = p.res;
    // research first – cheap and permanent
    let look = 0;
    for (const k of TECH_ORDER) {
      const st = sim.techState(p, k);
      if (st === 'done') continue;
      if (st === 'ready') { sim.cmdResearch(p, k); break; }
      if (++look >= 3) break; // don't skip too far ahead of the plan
    }
    // sell surplus on the stock market, keep a reserve
    if (sim.rng.chance(0.3)) {
      for (const k of C.TRADE_RES) {
        const keep = k === 'uranium' ? 150 : k === 'gems' ? 160 : 400;
        if (r[k] > keep * 1.5) { sim.cmdTrade(p, k, Math.floor(r[k] - keep), 'sell'); break; }
      }
    }
    const inner = () => interiorTile(sim, p, border);
    // 1. food security
    if ((!p.fed || p.rates.food < 0) && tryBuild(sim, p, 'farm', inner())) return;
    // 2. extract owned deposits
    for (const d of sim.deposits) {
      if (sim.owner[d.tile] !== p.id || sim.structAt.has(d.tile)) continue;
      const kind = d.kind === 'oil' ? 'derrick' : 'mine';
      if (tryBuild(sim, p, kind, d.tile)) return;
    }
    // 3. defense when pressed
    if (underAttack.length && sim.rng.chance(0.25 + D.aggr * 0.3)) {
      const a = sim.rng.pick(underAttack);
      if (a.cand.length) {
        const t = a.cand[sim.rng.int(a.cand.length)];
        const [bx, by] = sim.xy(t), [cx, cy] = sim.centroid(p);
        if (tryBuild(sim, p, 'fort', Math.round(by + (cy - by) * 0.15) * sim.W + Math.round(bx + (cx - bx) * 0.15))) return;
      }
    }
    // 4. growth buildings by priority
    const wish = [];
    if (r.wood < 40 && p.terr[T.FOREST] > 20 && b.sawmill < 3) wish.push('sawmill');
    wish.push('city');
    if (coast > 0 && b.port < 2) wish.push('port');
    if (b.city >= 1 && b.lab < 2) wish.push('lab');
    if (b.barracks < 3) wish.push('barracks');
    if (b.farm < 2 + b.city) wish.push('farm');
    if (b.market < 1 && p.tiles > 1500) wish.push('market');
    if (b.bank < 1 && p.gold > 20000) wish.push('bank');
    if (D.nukes && p.tiles > 2500) {
      if (b.silo < 1) wish.push('silo');
      if (b.sam < 1 && sim.structures.some(s => s.kind === 'silo' && s.owner !== p.id)) wish.push('sam');
      if (b.radar < 1 && b.sam > 0) wish.push('radar');
      if (b.bunker < 1 && sim.nukes.length) wish.push('bunker');
    }
    if (sim.has(p, 'arch') && b.wonder < 1 && p.tiles > 5000) wish.unshift('wonder');
    for (const k of wish) {
      if (!sim.canAfford(p, sim.costOf(p, k))) continue;
      const t = k === 'port' ? (border.find(u => sim._isCoastal(u)) ?? -1) : inner();
      if (tryBuild(sim, p, k, t)) return;
    }
  }

  function missiles(sim, p, D) {
    if (!D.nukes || !p.counts.silo || !sim.rng.chance(0.15 + D.aggr * 0.2)) return;
    const foes = sim.alivePlayers().filter(q => q !== p && !p.allies.has(q.id));
    if (!foes.length) return;
    const q = foes.reduce((a, b) => (b.tiles > a.tiles ? b : a));
    if (q.tiles < p.tiles * 0.7) return;
    const [cx, cy] = sim.centroid(q);
    let t = Math.round(cy) * sim.W + Math.round(cx);
    if (sim.owner[t] !== q.id && q.border.size) t = q.border.values().next().value;
    // knock out air defense first
    const sam = sim.structures.find(s => s.kind === 'sam' && s.owner === q.id && sim.active(s));
    if (sam && sim.has(p, 'elec') && sim.canAfford(p, C.NUKES.emp.cost)) { sim.cmdNuke(p, 'emp', sam.tile); return; }
    const kind = sim.has(p, 'fusion') && sim.canAfford(p, C.NUKES.hydro.cost) && sim.rng.chance(0.5) ? 'hydro' : 'atom';
    if (sim.has(p, C.NUKES[kind].tech) && sim.canAfford(p, C.NUKES[kind].cost)) sim.cmdNuke(p, kind, t);
    else if (sim.has(p, 'fission') && p.gold > 60000 && p.res.uranium < 30) sim.cmdTrade(p, 'uranium', 30, 'buy');
  }

  function targetTile(sim, q) {
    const [cx, cy] = sim.centroid(q);
    const c = Math.round(cy) * sim.W + Math.round(cx);
    if (sim.owner[c] === q.id) return c;
    return q.border.size ? q.border.values().next().value : -1;
  }

  /** spearheads: deploy at the front facing the target and keep idle armies busy */
  function armies(sim, p, D, counts, fill) {
    const mine = sim.unitsOf(p.id);
    let target = sim.players[p.lastTarget];
    if (!target || !target.alive || !counts.has(target.id) || p.allies.has(target.id)) {
      target = null;
      for (const [o] of counts) { const q = sim.players[o]; if (q.alive && !p.allies.has(o)) { target = q; break; } }
    }
    for (const u of mine) {
      if (u.path || u.fight) continue;
      if (target) { const t = targetTile(sim, target); if (t >= 0) sim._order(p, u, t); }
      else {
        const here = Math.floor(u.y) * sim.W + Math.floor(u.x);
        if (sim.owner[here] === p.id) sim.cmdDisband(p, [u.id]);
      }
    }
    const cap = p.diff === 'easy' ? 1 : p.diff === 'hard' ? 5 : 3;
    if (!target || mine.length >= cap || fill < 0.55 || !sim.rng.chance(0.1 + D.aggr * 0.2)) return;
    let kind = 'inf';
    if (sim.has(p, 'logi') && sim.canAfford(p, C.UNITS.tank.cost) && sim.rng.chance(0.6)) kind = 'tank';
    else if (sim.has(p, 'steel') && sim.canAfford(p, C.UNITS.art.cost) && sim.rng.chance(0.3)) kind = 'art';
    if (!sim.canAfford(p, C.UNITS[kind].cost)) return;
    const [tx, ty] = sim.centroid(target);
    let best = -1, bd = 1e18;
    for (const t of p.border) {
      const x = t % sim.W, y = (t / sim.W) | 0, d = (x - tx) ** 2 + (y - ty) ** 2;
      if (d < bd) { bd = d; best = t; }
    }
    if (best < 0) return;
    const u = sim.cmdDeploy(p, kind, best, 0.25);
    const t = targetTile(sim, target);
    if (u && t >= 0) sim._order(p, u, t);
  }

  function think(sim, p) {
    const D = C.DIFFICULTY[p.diff];
    const max = sim.maxTroops(p);
    const fill = p.troops / max;
    const { counts, neutral, coast, border } = scanNeighbours(sim, p);
    const underAttack = sim.attacks.filter(a => a.target === p.id);

    economy(sim, p, D, border, coast, underAttack);
    missiles(sim, p, D);

    // ---------- diplomacy
    const human = sim.players.find(q => q && q.human && q.alive);
    if (human && counts.has(human.id) && !p.allies.has(human.id) && human.tiles > p.tiles * 1.6 &&
        p.allies.size < 2 && sim.rng.chance(0.04) && !sim.allyRequests.some(r => r.from === p.id)) {
      sim.cmdAlly(p, human.id);
    }

    // ---------- military
    armies(sim, p, D, counts, fill);

    const minFill = 0.55 - D.aggr * 0.3;
    if (fill < minFill && !underAttack.length) return;

    // grab crates & deposits next to us first
    if (neutral > 0 && (sim.rng.chance(0.75) || counts.size === 0)) {
      sim.startAttack(p, 0, Math.floor(p.troops * sim.rng.range(0.25, 0.45)), null);
      return;
    }

    let best = null, bestScore = -1e9;
    for (const [o, c] of counts) {
      const q = sim.players[o];
      if (!q.alive) continue;
      const ally = p.allies.has(o);
      if (ally && !(D.betray && q.tiles < p.tiles * 0.4 && counts.size === 1 && sim.rng.chance(D.betray))) continue;
      const dens = q.troops / Math.max(1, q.tiles), myDens = p.troops / Math.max(1, p.tiles);
      let s = (myDens - dens) * 2 + Math.log(1 + c) - q.troops / Math.max(1, p.troops) * 3;
      if (o === p.lastTarget) s += 1.5;
      if (q.human) s += D.aggr * 2;
      if (underAttack.some(a => a.attacker === o)) s += 3;
      if (q.counts.wonder) s += 4; // nobody lets a wonder stand
      if (s > bestScore) { bestScore = s; best = q; }
    }
    if (best) {
      if (p.allies.has(best.id)) sim._breakAlliance(p, best, false);
      const ratio = sim.rng.range(0.3, 0.45 + D.aggr * 0.3);
      if (p.troops * ratio > best.troops * (0.35 - D.aggr * 0.2) || fill > 0.9) {
        p.lastTarget = best.id;
        sim.startAttack(p, best.id, Math.floor(p.troops * ratio), null);
        return;
      }
    }

    // no land targets → go naval (prefer crates and deposits)
    if ((neutral === 0 && counts.size === 0 || sim.rng.chance(0.06)) && coast > 0 && fill > 0.5) {
      const crate = sim.crates.find(c => !sim.owner[c.tile]);
      if (crate && sim.rng.chance(0.5)) { sim.cmdBoat(p, crate.tile, 0.3); return; }
      for (let k = 0; k < 20; k++) {
        const t = sim.rng.int(sim.N);
        if (!sim.isLand(t)) continue;
        const o = sim.owner[t];
        if (o === p.id || sim.allied(p.id, o)) continue;
        if (o !== 0 && sim.players[o].troops > p.troops * 0.6) continue;
        sim.cmdBoat(p, t, sim.rng.range(0.3, 0.5));
        break;
      }
    }
  }

  function acceptAlliance(sim, bot, req) {
    if (req.traitorUntil > sim.tick) return false;
    if (bot.allies.size >= 2) return false;
    if (sim.attacks.some(a => (a.attacker === req.id && a.target === bot.id) || (a.attacker === bot.id && a.target === req.id))) {
      return req.tiles > bot.tiles * 2 && sim.rng.chance(0.5);
    }
    const ratio = req.tiles / Math.max(1, bot.tiles);
    if (ratio > 0.8) return sim.rng.chance(0.75);
    return sim.rng.chance(0.35);
  }

  BW.AI = { think, acceptAlliance };
})(globalThis.BW = globalThis.BW || {});
