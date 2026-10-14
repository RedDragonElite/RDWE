/* RDE // FRONTLINE — nation AI
 * Runs INSIDE the simulation (deterministic, uses sim.rng) so bots behave
 * identically on every lockstep client without any network traffic. */
(function (BW) {
  'use strict';
  const C = BW.C;

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
    const ok = (t) => t >= 0 && t < sim.N && sim.owner[t] === p.id && !sim._structNear(t % sim.W, (t / sim.W) | 0, 4);
    if (ok(c) && sim.rng.chance(0.3)) return c;
    for (let k = 0; k < 16 && border.length; k++) {
      const b = sim.rng.pick(border);
      const [bx, by] = sim.xy(b);
      const f = sim.rng.range(0.35, 0.8);
      const x = Math.round(bx + (cx - bx) * f), y = Math.round(by + (cy - by) * f);
      const t = y * sim.W + x;
      if (ok(t)) return t;
    }
    return ok(c) ? c : -1;
  }

  function think(sim, p) {
    const D = C.DIFFICULTY[p.diff];
    const max = sim.maxTroops(p);
    const fill = p.troops / max;
    const { counts, neutral, coast, border } = scanNeighbours(sim, p);
    const underAttack = sim.attacks.filter(a => a.target === p.id);

    // ---------- economy
    if (p.gold > sim.buildCost(p, 'city') && sim.rng.chance(0.55)) {
      const t = interiorTile(sim, p, border);
      if (t >= 0) sim.cmdBuild(p, 'city', t);
    }
    if (coast > 0 && p.counts.port < 2 && p.gold > sim.buildCost(p, 'port') * 1.3 && sim.rng.chance(0.25)) {
      const coastal = border.filter(t => sim._isCoastal(t));
      if (coastal.length) sim.cmdBuild(p, 'port', sim.rng.pick(coastal));
    }
    if (underAttack.length && p.gold > sim.buildCost(p, 'defense') && sim.rng.chance(0.25 + D.aggr * 0.3)) {
      const a = sim.rng.pick(underAttack);
      // attack candidates are tiles we own on that front
      if (a.cand.length) {
        const t = a.cand[sim.rng.int(a.cand.length)];
        const [bx, by] = sim.xy(t), [cx, cy] = sim.centroid(p);
        const x = Math.round(bx + (cx - bx) * 0.15), y = Math.round(by + (cy - by) * 0.15);
        sim.cmdBuild(p, 'defense', y * sim.W + x);
      }
    }
    if (D.nukes && p.tiles > 2500) {
      if (p.counts.silo === 0 && p.gold > sim.buildCost(p, 'silo') && sim.rng.chance(0.2)) {
        const t = interiorTile(sim, p, border); if (t >= 0) sim.cmdBuild(p, 'silo', t);
      } else if (p.counts.sam === 0 && p.gold > sim.buildCost(p, 'sam') && sim.structures.some(s => s.kind === 'silo' && s.owner !== p.id) && sim.rng.chance(0.25)) {
        const t = interiorTile(sim, p, border); if (t >= 0) sim.cmdBuild(p, 'sam', t);
      } else if (p.counts.silo > 0 && p.gold > C.NUKES.atom.cost && sim.rng.chance(0.15 + D.aggr * 0.2)) {
        const foes = sim.alivePlayers().filter(q => q !== p && !p.allies.has(q.id));
        if (foes.length) {
          const q = foes.reduce((a, b) => (b.tiles > a.tiles ? b : a));
          if (q.tiles > p.tiles * 0.7) {
            const [cx, cy] = sim.centroid(q);
            let t = Math.round(cy) * sim.W + Math.round(cx);
            if (sim.owner[t] !== q.id && q.border.size) t = q.border.values().next().value;
            const kind = p.gold > C.NUKES.hydro.cost && sim.rng.chance(0.5) ? 'hydro' : 'atom';
            sim.cmdNuke(p, kind, t);
          }
        }
      }
    }

    // ---------- diplomacy
    const human = sim.players.find(q => q && q.human && q.alive);
    if (human && counts.has(human.id) && !p.allies.has(human.id) && human.tiles > p.tiles * 1.6 &&
        p.allies.size < 2 && sim.rng.chance(0.04) && !sim.allyRequests.some(r => r.from === p.id)) {
      sim.cmdAlly(p, human.id);
    }

    // ---------- military
    const minFill = 0.55 - D.aggr * 0.3;
    if (fill < minFill && !underAttack.length) return;

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
      if (underAttack.some(a => a.attacker === o)) s += 3; // strike back
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

    // no land targets → go naval
    if ((neutral === 0 && counts.size === 0 || sim.rng.chance(0.06)) && coast > 0 && fill > 0.5) {
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
