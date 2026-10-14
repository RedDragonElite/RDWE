/* RDE // KONTRAKT — vector sprites: people (alive / dead), weapons, cars, furniture & street props */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE, W8 = K.WEAPONS;
  const TAU = Math.PI * 2;

  function ell(x, cx, cy, rx, ry, rot = 0) { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, TAU); }
  function circ(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, r, 0, TAU); }
  function rr(x, a, b, w, h, r) { x.beginPath(); x.roundRect(a, b, w, h, r); }
  function arm(x, sx, sy, hx, hy, sleeve, skin, w = 4.4) {
    x.strokeStyle = sleeve; x.lineWidth = w; x.lineCap = 'round';
    x.beginPath(); x.moveTo(sx, sy); x.lineTo(hx, hy); x.stroke();
    x.fillStyle = skin; circ(x, hx, hy, 2.5); x.fill();
  }

  // ------------------------------------------------------------------ weapons (top-down, +x forward)
  K.drawWeaponTop = function (x, id, sup, ox = 0) {
    x.save(); x.translate(ox, 0);
    const dark = '#16171a', metal = '#3a3d44';
    switch (id) {
      case 'p9': x.fillStyle = dark; x.fillRect(-1, -1.6, 10, 3.2); if (sup) { x.fillStyle = metal; x.fillRect(9, -1.3, 7, 2.6); } break;
      case 'silber': x.fillStyle = '#b9bcc2'; x.fillRect(-1, -1.7, 11, 3.4); x.fillStyle = '#2b2d31'; x.fillRect(10, -1.4, 8, 2.8); break;
      case 'magnum': x.fillStyle = '#8c8f96'; x.fillRect(-1, -1.6, 13, 3.2); x.fillStyle = dark; circ(x, 2, 0, 2.6); x.fill(); break;
      case 'mpk': x.fillStyle = dark; x.fillRect(-4, -2.2, 17, 4.4); x.fillRect(4, 2, 2.6, 6); if (sup) { x.fillStyle = metal; x.fillRect(13, -1.5, 8, 3); } break;
      case 'pump': x.fillStyle = '#5a3d24'; x.fillRect(-8, -2.4, 9, 4.8); x.fillStyle = dark; x.fillRect(0, -1.8, 24, 3.6); x.fillStyle = '#3d2a18'; x.fillRect(9, -2.4, 7, 4.8); break;
      case 'k47': x.fillStyle = '#5a3d24'; x.fillRect(-9, -2.4, 9, 4.8); x.fillStyle = dark; x.fillRect(0, -1.9, 24, 3.8); x.fillRect(6, 1.8, 3, 6); x.fillStyle = '#5a3d24'; x.fillRect(13, -2.3, 6, 4.6); if (sup) { x.fillStyle = metal; x.fillRect(24, -1.6, 9, 3.2); } break;
      case 'jaeger': x.fillStyle = '#3c4a32'; x.fillRect(-10, -2.4, 14, 4.8); x.fillStyle = dark; x.fillRect(2, -1.5, 30, 3); x.fillStyle = '#111'; x.fillRect(3, -3.2, 11, 6.4); if (sup) { x.fillStyle = metal; x.fillRect(32, -1.8, 9, 3.6); } break;
      case 'knife': x.fillStyle = '#222'; x.fillRect(-2, -1.4, 5, 2.8); x.fillStyle = '#d6d9de'; x.beginPath(); x.moveTo(3, -1.6); x.lineTo(13, -0.4); x.lineTo(13, 0.6); x.lineTo(3, 1.6); x.fill(); break;
      case 'bat': x.fillStyle = '#b9925d'; x.beginPath(); x.moveTo(-2, -1.4); x.lineTo(24, -3.2); x.lineTo(26, 0); x.lineTo(24, 3.2); x.lineTo(-2, 1.4); x.fill(); break;
      case 'crowbar': x.strokeStyle = '#8b1b1b'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(-2, 0); x.lineTo(22, 0); x.quadraticCurveTo(27, 0, 26, -4); x.stroke(); break;
      case 'machete': x.fillStyle = '#222'; x.fillRect(-3, -1.5, 6, 3); x.fillStyle = '#cfd3d8'; x.beginPath(); x.moveTo(3, -2); x.lineTo(22, -3.5); x.lineTo(24, 0); x.lineTo(21, 2.4); x.lineTo(3, 2); x.fill(); break;
      case 'katana': x.fillStyle = '#1b1b1b'; x.fillRect(-6, -1.3, 8, 2.6); x.fillStyle = '#c9a227'; x.fillRect(2, -2.6, 1.6, 5.2); x.strokeStyle = '#e4e7ec'; x.lineWidth = 1.8; x.beginPath(); x.moveTo(3.6, 0); x.quadraticCurveTo(18, -1.5, 32, -3.5); x.stroke(); break;
      case 'grenade': x.fillStyle = '#3c4a32'; circ(x, 2, 0, 3.2); x.fill(); break;
      case 'c4': x.fillStyle = '#c9b98a'; x.fillRect(-2, -3, 8, 6); break;
      case 'coin': x.fillStyle = '#e8c45a'; circ(x, 1, 0, 1.8); x.fill(); break;
      case 'syringe': case 'sedative': x.fillStyle = '#d9eef5'; x.fillRect(0, -1, 7, 2); x.fillStyle = '#aaa'; x.fillRect(7, -0.3, 4, 0.6); break;
    }
    x.restore();
  };

  // ------------------------------------------------------------------ people
  /** pose resolution from actor + world */
  function poseOf(a, w) {
    if (a.kind === 'player' && w.P && w.P.surrender) return 'hands';
    if (a.kind === 'player' && w.drag) return 'drag';
    if (a.state === 'cower') return 'cower';
    if (a.phone) return 'phone';
    const d = W8[(a.wi && a.wi.id) || 'fists'];
    const drawn = a.kind === 'player' || ['hostile', 'search', 'warn', 'arrest', 'respond'].includes(a.state) || (a.kind === 'keeper' && false);
    if (!drawn || !d) return 'fist';
    if (d.type === 'gun') return d.cls === 'pistol' ? 'pistol' : 'rifle';
    if (d.type === 'melee') return 'melee';
    if (d.type === 'throw') return 'throw';
    return 'fist';
  }
  K.poseOf = poseOf;

  K.drawHuman = function (x, a, w, o = {}) {
    const of = K.OUTFITS[a.outfit] || K.OUTFITS.civ1;
    const mv = a.moving || 0, ph = a.walk || 0;
    const skin = a.skin || '#e0b08a';
    x.save();
    x.translate(a.x, a.y);
    // ground shadow
    x.fillStyle = `rgba(0,0,0,${o.shadowA != null ? o.shadowA : 0.28})`;
    ell(x, (o.sx || 2), (o.sy || 3), 11, 9.5); x.fill();
    x.rotate(a.angle);
    const sc = a.crouch ? 0.86 : 1;
    x.scale(sc, sc);
    if (a.flinch > 0) x.translate(-a.flinch * 10, 0);
    const pose = poseOf(a, w);
    const d = W8[(a.wi && a.wi.id) || 'fists'] || W8.fists;
    const pants = of.pants || '#333', body = of.body, trim = of.trim;
    // legs
    const sw = Math.sin(ph) * 7 * Math.min(1, mv * 1.2);
    for (const s of [-1, 1]) {
      const lx = s * sw * (a.crouch ? 0.5 : 1), ly = s * 4.3;
      x.fillStyle = pants; rr(x, lx - 4.2, ly - 2.7, 8.4, 5.4, 2.6); x.fill();
      x.fillStyle = '#121214'; ell(x, lx + 3.6, ly, 2.8, 2.4); x.fill();
    }
    // dress / coat tail
    if (of.dress) { x.fillStyle = U.shade(body, 0.78); ell(x, -2.5, 0, 7.4, 11.4); x.fill(); }
    // torso
    const g = x.createLinearGradient(-6, -10, 6, 10);
    g.addColorStop(0, U.shade(body, 1.18)); g.addColorStop(1, U.shade(body, 0.72));
    x.fillStyle = g; ell(x, -0.8, 0, 6.8, 10.4); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 0.8; x.stroke();
    // outfit details
    const id = of.id;
    if (id === 'suit' || id === 'suitgrey' || id === 'tux' || id === 'rich') {
      x.fillStyle = '#f2f0ea'; x.beginPath(); x.moveTo(5.7, 0); x.lineTo(1.5, -3); x.lineTo(1.5, 3); x.closePath(); x.fill();
      x.strokeStyle = trim; x.lineWidth = id === 'tux' ? 2.4 : 1.6; x.beginPath(); x.moveTo(1.4, 0); x.lineTo(5.6, 0); x.stroke();
      x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(5.6, 0); x.lineTo(0, -5.5); x.moveTo(5.6, 0); x.lineTo(0, 5.5); x.stroke();
    } else if (id === 'police') {
      x.fillStyle = trim; x.fillRect(-2.5, -9.6, 4, 2.2); x.fillRect(-2.5, 7.4, 4, 2.2); circ(x, 3, -4, 1.3); x.fill();
      x.fillStyle = '#0d1424'; x.fillRect(-6.5, -1, 2, 2);
    } else if (id === 'guard' || id === 'bouncer') {
      x.fillStyle = trim; x.fillRect(-3, -9.4, 5, 1.4); x.fillRect(-3, 8, 5, 1.4);
    } else if (id === 'waiter') {
      x.fillStyle = '#121212'; x.beginPath(); x.ellipse(-1.4, 0, 5.6, 9.2, 0, 0.6, TAU - 0.6); x.lineTo(-1.4, 0); x.fill();
      x.fillStyle = '#7a1420'; x.fillRect(3.8, -1.6, 1.6, 3.2);
    } else if (id === 'chef') {
      x.fillStyle = '#9aa0a6'; for (let k = 0; k < 3; k++) { circ(x, 3.5 - k * 3.2, -2.5, 0.9); x.fill(); circ(x, 3.5 - k * 3.2, 2.5, 0.9); x.fill(); }
    } else if (id === 'worker') {
      x.fillStyle = trim; x.fillRect(-4, -10, 2.4, 20); x.fillRect(2, -9, 2.4, 18);
    } else if (id === 'doctor') {
      x.strokeStyle = '#222'; x.lineWidth = 0.9; x.beginPath(); x.arc(3, 0, 4, -1.2, 1.2); x.stroke();
      x.fillStyle = trim; x.fillRect(1, 4, 3, 2);
    } else if (id === 'leather') {
      x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(5.8, -0.2); x.lineTo(-7.5, -0.2); x.stroke();
      x.fillStyle = U.shade(body, 1.4); ell(x, 2, 0, 2, 5); x.fill();
    } else if (id === 'gang') {
      x.strokeStyle = '#c9a227'; x.lineWidth = 0.9; x.beginPath(); x.arc(2, 0, 4.2, -1, 1); x.stroke();
    } else if (id === 'under') {
      x.fillStyle = skin; ell(x, -0.8, -7.6, 3.8, 2.6); x.fill(); ell(x, -0.8, 7.6, 3.8, 2.6); x.fill();
    }
    if (of.hood) { x.fillStyle = U.shade(body, 0.7); ell(x, -5.4, 0, 3.6, 5.6); x.fill(); }
    // arms
    const sleeve = id === 'under' ? skin : U.shade(body, 0.92);
    const swing = Math.sin(ph) * 4.5 * Math.min(1, mv);
    const at = a.attackT != null ? a.attackT : 9;
    let weaponDraw = null;
    switch (pose) {
      case 'pistol': {
        const kick = at < 0.08 ? (1 - at / 0.08) * 3 : 0;
        arm(x, -1, -8.6, 12 - kick, -1, sleeve, skin); arm(x, -1, 8.6, 12.5 - kick, 0.8, sleeve, skin);
        weaponDraw = [12 - kick, 0];
        if (a.reloading) { arm(x, -1, -8.6, 7 + Math.sin(a.reloadT * 14) * 2, 4, sleeve, skin); }
        break;
      }
      case 'rifle': {
        const kick = at < 0.06 ? (1 - at / 0.06) * 2.5 : 0;
        arm(x, -1, 8.6, 9 - kick, 3.4, sleeve, skin); arm(x, -1, -8.6, a.reloading ? 8 : 18 - kick, a.reloading ? 5 : -0.6, sleeve, skin);
        weaponDraw = [6 - kick, 1];
        break;
      }
      case 'melee': {
        const dur = Math.max(0.2, d.rate * 0.75);
        let ang = 0.95;
        if (at < dur) { const k = at / dur; ang = U.lerp(-1.35, 1.25, U.smooth(Math.min(1, k * 1.25))); }
        const hx = -1 + Math.cos(ang) * 12.5, hy = 8.6 * 0 + Math.sin(ang) * 12.5;
        arm(x, -1, 8.6, hx, hy, sleeve, skin);
        arm(x, -1, -8.6, 3 - swing, -10, sleeve, skin);
        x.save(); x.translate(hx, hy); x.rotate(ang - 0.25 + (at < dur ? 0 : -0.5)); K.drawWeaponTop(x, d.id, false, 0); x.restore();
        if (at < dur * 0.8 && d.sharp) { x.strokeStyle = 'rgba(255,255,255,0.22)'; x.lineWidth = 6; x.beginPath(); x.arc(-1, 0, 26, -1.2, ang); x.stroke(); }
        break;
      }
      case 'drag': arm(x, -1, -8.6, -15, -4, sleeve, skin); arm(x, -1, 8.6, -15, 4, sleeve, skin); break;
      case 'cower': arm(x, -1, -8.6, 2, -4.5, sleeve, skin); arm(x, -1, 8.6, 2, 4.5, sleeve, skin); break;
      case 'hands': arm(x, -1, -8.6, 0, -13, sleeve, skin); arm(x, -1, 8.6, 0, 13, sleeve, skin); x.fillStyle = skin; circ(x, 1, -14.5, 2.6); x.fill(); circ(x, 1, 14.5, 2.6); x.fill(); break;
      case 'phone': arm(x, -1, -8.6, 3 - swing, -10, sleeve, skin); arm(x, -1, 8.6, 3, 6.8, sleeve, skin); x.fillStyle = '#9fe0ff'; x.fillRect(2, 6.5, 3, 1.6); break;
      case 'throw': arm(x, -1, -8.6, 3 - swing, -10, sleeve, skin); arm(x, -1, 8.6, at < 0.25 ? 14 : 8, at < 0.25 ? 4 : 9, sleeve, skin); if (at > 0.25) { x.save(); x.translate(8, 9); K.drawWeaponTop(x, d.id, false); x.restore(); } break;
      default: { // fists / relaxed
        let lh = [3 - swing, -10.2], rh = [3 + swing, 10.2];
        if (a.kind === 'player' || a.state === 'fight' || a.state === 'hostile') {
          lh = [6, -6]; rh = [6, 6];
          if (at < 0.17) { const k = Math.sin((at / 0.17) * Math.PI); if (a.punchSide) rh = [6 + k * 11, 6 - k * 5]; else lh = [6 + k * 11, -6 + k * 5]; }
          if (a.kind === 'player' && !(a.wi && (a.wi.id === 'fists')) && at > 0.17) { lh = [3 - swing, -10.2]; rh = [3 + swing, 10.2]; }
        }
        arm(x, -1, -8.6, lh[0], lh[1], sleeve, skin); arm(x, -1, 8.6, rh[0], rh[1], sleeve, skin);
        if (a.kind === 'player' && a.wi && a.wi.id === 'wire' && o.td) { x.strokeStyle = '#ddd'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(lh[0], lh[1]); x.lineTo(rh[0], rh[1]); x.stroke(); }
      }
    }
    if (weaponDraw) { x.save(); x.translate(weaponDraw[0], weaponDraw[1]); K.drawWeaponTop(x, d.id, a.wi && a.wi.sup); x.restore(); }
    // head
    if (of.hood && !a.bald) { x.fillStyle = U.shade(body, 0.8); circ(x, 0.6, 0, 6.6); x.fill(); }
    x.fillStyle = skin; circ(x, 1, -5.3, 1.5); x.fill(); circ(x, 1, 5.3, 1.5); x.fill();
    x.fillStyle = skin; circ(x, 1, 0, 5.6); x.fill();
    if (a.hair && !of.hood) {
      x.fillStyle = a.hair;
      x.beginPath(); x.arc(0.6, 0, 5.8, 0.85, TAU - 0.85); x.closePath(); x.fill();
      if (a.female) { ell(x, -6, 0, 3.4, 2.4); x.fill(); }
    } else if (!of.hood) {
      x.fillStyle = 'rgba(255,255,255,0.28)'; circ(x, -0.6, -1.6, 2.2); x.fill();
    }
    if (a.kind === 'player' && w.P && w.P.masked) {
      x.fillStyle = '#121214'; circ(x, 0.8, 0, 6.1); x.fill();
      x.fillStyle = skin; x.fillRect(3.2, -3.2, 2.2, 6.4);
      x.fillStyle = '#1b1b1f'; circ(x, 4.4, -1.6, 0.8); x.fill(); circ(x, 4.4, 1.6, 0.8); x.fill();
    }
    const hat = a.hat ? 'fedora' : of.hat;
    if (hat === 'cap') { x.fillStyle = of.hatC; circ(x, 0.4, 0, 6.1); x.fill(); x.fillStyle = '#0a1226'; rr(x, 4.6, -4, 4, 8, 2); x.fill(); x.fillStyle = '#d4af37'; circ(x, 3.6, 0, 1); x.fill(); }
    else if (hat === 'hard') { x.fillStyle = of.hatC; circ(x, 0.6, 0, 6.6); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-5, 0); x.lineTo(6, 0); x.stroke(); }
    else if (hat === 'chef') { x.fillStyle = '#fff'; circ(x, -0.5, 0, 7); x.fill(); x.fillStyle = '#e6e6e6'; circ(x, -1.5, -2.5, 3); x.fill(); circ(x, 1.5, 2.5, 3); x.fill(); }
    else if (hat === 'band') { x.fillStyle = of.hatC; x.beginPath(); x.arc(0.4, 0, 5.9, 1.2, TAU - 1.2); x.closePath(); x.fill(); x.fillRect(-8, -1, 3, 2); }
    else if (hat === 'ear') { x.fillStyle = '#111'; circ(x, 0.8, 5.6, 1.1); x.fill(); x.strokeStyle = 'rgba(30,30,30,0.7)'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(0.8, 5.6); x.lineTo(-3, 8); x.stroke(); }
    else if (hat === 'fedora') { x.fillStyle = '#1d1a17'; circ(x, 0.4, 0, 8.6); x.fill(); x.fillStyle = '#2b2622'; circ(x, 0.4, 0, 5.4); x.fill(); x.strokeStyle = '#7a1420'; x.lineWidth = 1.1; circ(x, 0.4, 0, 5.6); x.stroke(); }
    x.restore();
  };

  /** lying body (dead or unconscious) */
  K.drawBody = function (x, a, w) {
    const of = K.OUTFITS[a.outfit] || K.OUTFITS.civ1;
    const skin = a.skin || '#e0b08a';
    const ang = a.alive ? (a.koA != null ? a.koA : a.angle) : a.deathA;
    x.save(); x.translate(a.x, a.y); x.rotate(ang);
    const seed = a.id % 7;
    x.fillStyle = 'rgba(0,0,0,0.22)'; ell(x, 1, 2, 18, 10); x.fill();
    // legs (behind = -x)
    x.strokeStyle = of.pants; x.lineWidth = 5; x.lineCap = 'round';
    x.beginPath(); x.moveTo(-6, -3); x.lineTo(-19, -5 - seed * 0.4); x.moveTo(-6, 3); x.lineTo(-18, 6 + seed * 0.3); x.stroke();
    x.fillStyle = '#121214'; circ(x, -20, -5 - seed * 0.4, 2.4); x.fill(); circ(x, -19, 6 + seed * 0.3, 2.4); x.fill();
    // torso
    x.fillStyle = of.id === 'under' ? '#d8cfc0' : U.shade(of.body, 0.9); ell(x, 0, 0, 9, 7.4); x.fill();
    if (of.id === 'suit' || of.id === 'tux') { x.strokeStyle = of.trim; x.lineWidth = 1.5; x.beginPath(); x.moveTo(3, 0); x.lineTo(8, 0); x.stroke(); }
    // arms flung out
    const sl = of.id === 'under' ? skin : U.shade(of.body, 0.8);
    arm(x, 4, -6, 8 + seed, -15 - seed * 0.5, sl, skin);
    arm(x, 4, 6, -2 + seed * 0.5, 16, sl, skin);
    // head
    x.fillStyle = skin; circ(x, 12, 0, 5.4); x.fill();
    if (a.hair) { x.fillStyle = a.hair; x.beginPath(); x.arc(12.5, 0, 5.6, -1.8, 1.8); x.closePath(); x.fill(); }
    x.restore();
  };

  // ------------------------------------------------------------------ cars
  K.drawCar = function (x, c, t, o = {}) {
    x.save(); x.translate(c.x, c.y);
    // shadow
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.save(); x.translate(o.sx || 3, o.sy || 5); x.rotate(c.a); rr(x, -c.l / 2, -c.w / 2, c.l, c.w, 8); x.fill(); x.restore();
    x.rotate(c.a);
    const L = c.l, Wd = c.w, hl = L / 2, hw = Wd / 2;
    const col = c.wreck ? '#1a1714' : c.color;
    // wheels
    x.fillStyle = '#0b0b0c';
    const st = (c.steer || 0) * 0.45;
    for (const [u, v, s] of [[hl - 13, hw - 1, st], [hl - 13, -hw + 1, st], [-hl + 12, hw - 1, 0], [-hl + 12, -hw + 1, 0]]) { x.save(); x.translate(u, v); x.rotate(s); x.fillRect(-6, -2.4, 12, 4.8); x.restore(); }
    // body
    const g = x.createLinearGradient(0, -hw, 0, hw);
    g.addColorStop(0, U.shade(col, 1.25)); g.addColorStop(0.5, col); g.addColorStop(1, U.shade(col, 0.65));
    x.fillStyle = g; rr(x, -hl, -hw + 1, L, Wd - 2, c.kind === 'van' ? 4 : 9); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1; x.stroke();
    if (c.kind === 'police') { x.fillStyle = '#f2f2f2'; x.fillRect(-hl + 14, -hw + 1, L - 30, 5); x.fillRect(-hl + 14, hw - 6, L - 30, 5); }
    if (c.kind === 'taxi') { x.fillStyle = '#111'; for (let k = 0; k < 6; k++) x.fillRect(-hl + 16 + k * 5, (k & 1) ? -hw + 2 : hw - 4, 5, 2); }
    if (c.kind === 'sport') { x.fillStyle = 'rgba(255,255,255,0.75)'; x.fillRect(-hl + 2, -2.5, L - 4, 1.6); x.fillRect(-hl + 2, 1, L - 4, 1.6); }
    // cabin
    const cab0 = c.kind === 'van' ? -hl + 4 : -hl + 15, cab1 = c.kind === 'van' ? hl - 18 : hl - 22;
    x.fillStyle = U.shade(col, 0.82); rr(x, cab0, -hw + 4, cab1 - cab0, Wd - 8, 5); x.fill();
    // windshield + rear window
    const glass = x.createLinearGradient(cab1 - 8, 0, cab1 + 6, 0);
    glass.addColorStop(0, '#1a2a3a'); glass.addColorStop(1, '#5d7d98');
    x.fillStyle = glass; x.beginPath(); x.moveTo(cab1 - 7, -hw + 5); x.lineTo(cab1 + 4, -hw + 7); x.lineTo(cab1 + 4, hw - 7); x.lineTo(cab1 - 7, hw - 5); x.closePath(); x.fill();
    if (c.kind !== 'van') { x.fillStyle = '#1d2a36'; x.fillRect(cab0 - 2, -hw + 6, 6, Wd - 12); }
    x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(cab1 - 4, -hw + 7, 2, Wd / 2 - 6);
    // roof decoration
    if (c.kind === 'police') {
      const on = c.siren && Math.floor(t * 6) % 2;
      x.fillStyle = on ? '#ff2030' : '#5a1016'; x.fillRect(-3, -hw + 6, 6, hw - 6);
      x.fillStyle = !on && c.siren ? '#2a6bff' : '#10204a'; x.fillRect(-3, 0, 6, hw - 6);
    }
    if (c.kind === 'taxi') { x.fillStyle = '#ffe680'; x.fillRect(-3, -5, 6, 10); }
    // lights
    x.fillStyle = c.lightsOn ? '#fffbe0' : '#d8d2b0'; x.fillRect(hl - 3, -hw + 3, 3, 6); x.fillRect(hl - 3, hw - 9, 3, 6);
    x.fillStyle = c.brake ? '#ff2a2a' : c.lightsOn ? '#b0121a' : '#6a1015'; x.fillRect(-hl, -hw + 3, 2.5, 6); x.fillRect(-hl, hw - 9, 2.5, 6);
    // mirrors
    x.fillStyle = U.shade(col, 0.7); x.fillRect(cab1 - 6, -hw - 2, 3, 3); x.fillRect(cab1 - 6, hw - 1, 3, 3);
    // damage
    if (c.hp < 60 && !c.wreck) { x.fillStyle = 'rgba(20,20,20,0.35)'; for (let k = 0; k < 4 - Math.floor(c.hp / 20); k++) { circ(x, ((k * 37) % L) - hl + 6, ((k * 13) % Wd) - hw + 4, 4); x.fill(); } }
    x.restore();
  };

  // ------------------------------------------------------------------ props (static, baked into chunks)
  const WOOD = ['#7a5232', '#5e3d24', '#8c6440', '#4a3020', '#9a7350', '#6b4a2e'];
  const FAB = ['#7a2a2a', '#2a4a6a', '#3d5a3a', '#6b5a3a', '#4a3a5a', '#2b2b2f'];
  K.drawProp = function (x, p, b) {
    const X = p.x * TILE, Y = p.y * TILE, Wd = p.w * TILE, H = p.h * TILE;
    const cx = X + Wd / 2, cy = Y + H / 2;
    const sh = () => { x.fillStyle = 'rgba(0,0,0,0.28)'; rr(x, X + 3, Y + 4, Wd - 3, H - 3, 4); x.fill(); };
    const horiz = p.w >= p.h;
    switch (p.k) {
      case 'bed': {
        sh(); x.fillStyle = WOOD[p.c]; rr(x, X + 2, Y + 2, Wd - 4, H - 4, 4); x.fill();
        x.fillStyle = '#ece8df'; rr(x, X + 4, Y + 4, Wd - 8, H - 8, 3); x.fill();
        x.fillStyle = FAB[p.c]; if (horiz) rr(x, X + Wd * 0.38, Y + 4, Wd * 0.6 - 4, H - 8, 3); else rr(x, X + 4, Y + H * 0.38, Wd - 8, H * 0.6 - 4, 3); x.fill();
        x.fillStyle = '#fff'; if (horiz) { rr(x, X + 6, Y + 6, 10, H / 2 - 7, 3); x.fill(); rr(x, X + 6, Y + H / 2 + 1, 10, H / 2 - 7, 3); x.fill(); } else { rr(x, X + 6, Y + 6, Wd / 2 - 7, 10, 3); x.fill(); rr(x, X + Wd / 2 + 1, Y + 6, Wd / 2 - 7, 10, 3); x.fill(); }
        break;
      }
      case 'hbed': sh(); x.fillStyle = '#cfd6da'; rr(x, X + 3, Y + 3, Wd - 6, H - 6, 3); x.fill(); x.fillStyle = '#a7c7d6'; rr(x, X + 6, Y + 6, Wd - 12, H - 12, 3); x.fill(); x.strokeStyle = '#7d8a90'; x.lineWidth = 1.5; x.strokeRect(X + 3, Y + 3, Wd - 6, H - 6); break;
      case 'sofa': {
        sh(); const f = FAB[p.c]; x.fillStyle = U.shade(f, 0.75); rr(x, X + 2, Y + 3, Wd - 4, H - 6, 6); x.fill();
        x.fillStyle = f; if (horiz) { rr(x, X + 6, Y + 7, Wd - 12, H - 12, 4); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.moveTo(cx, Y + 8); x.lineTo(cx, Y + H - 6); x.stroke(); } else { rr(x, X + 7, Y + 6, Wd - 12, H - 12, 4); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.moveTo(X + 8, cy); x.lineTo(X + Wd - 6, cy); x.stroke(); }
        break;
      }
      case 'table': sh(); x.fillStyle = WOOD[p.c]; rr(x, X + 4, Y + 4, Wd - 8, H - 8, 3); x.fill(); x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(X + 6, Y + 6, Wd - 12, 3); x.fillStyle = '#f4f1ea'; circ(x, cx - 4, cy, 3.5); x.fill(); circ(x, cx + 5, cy + 3, 2.5); x.fill(); break;
      case 'chair': case 'stool': x.fillStyle = WOOD[p.c]; circ(x, cx, cy, p.k === 'stool' ? 6 : 7); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.3)'; x.stroke(); break;
      case 'desk': case 'desk2': {
        sh(); x.fillStyle = p.k === 'desk2' ? '#3a2416' : WOOD[(p.c + 2) % 6]; rr(x, X + 2, Y + 3, Wd - 4, H - 6, 3); x.fill();
        x.fillStyle = '#111'; const mx = horiz ? cx - 7 : cx - 4, my = horiz ? cy - 4 : cy - 7; x.fillRect(mx, my, horiz ? 14 : 4, horiz ? 4 : 14);
        x.fillStyle = '#2d6db5'; x.fillRect(mx + 1, my + 1, horiz ? 12 : 2, horiz ? 2 : 12);
        x.fillStyle = '#ddd'; x.fillRect(horiz ? cx - 5 : cx + 3, horiz ? cy + 3 : cy - 5, horiz ? 10 : 3, horiz ? 3 : 10);
        if (p.k === 'desk2') { x.fillStyle = '#c9a227'; circ(x, X + 8, Y + 8, 3); x.fill(); }
        break;
      }
      case 'shelf': case 'rack': {
        sh(); x.fillStyle = p.k === 'rack' ? '#2a2b2f' : '#4a3a2a'; x.fillRect(X + 2, Y + 2, Wd - 4, H - 4);
        for (let k = 0; k < 6; k++) { x.fillStyle = p.k === 'rack' ? '#111' : ['#c8102e', '#2d6db5', '#e0b000', '#3d8a4a', '#ddd', '#8a4ac8'][(k + p.c) % 6]; x.fillRect(X + 4 + (k % 3) * 8, Y + 5 + Math.floor(k / 3) * 11, p.k === 'rack' ? 7 : 6, p.k === 'rack' ? 3 : 8); }
        break;
      }
      case 'fridge': sh(); x.fillStyle = '#e9ecee'; rr(x, X + 4, Y + 3, Wd - 8, H - 6, 3); x.fill(); x.fillStyle = '#9aa'; x.fillRect(X + Wd - 9, Y + 8, 2, 10); break;
      case 'stove': sh(); x.fillStyle = '#2c2d30'; rr(x, X + 3, Y + 3, Wd - 6, H - 6, 2); x.fill(); x.strokeStyle = '#666'; for (const [a, c] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) { circ(x, cx + a, cy + c, 3.5); x.stroke(); } break;
      case 'sink': sh(); x.fillStyle = '#b8bec4'; rr(x, X + 4, Y + 4, Wd - 8, H - 8, 3); x.fill(); x.fillStyle = '#7f878f'; rr(x, X + 8, Y + 8, Wd - 16, H - 16, 5); x.fill(); break;
      case 'toilet': x.fillStyle = '#f4f4f2'; ell(x, cx, cy, 7, 9); x.fill(); break;
      case 'plant': x.fillStyle = '#9a5a3a'; circ(x, cx, cy, 7); x.fill(); x.fillStyle = '#2f6b34'; for (let k = 0; k < 6; k++) { const a = k * 1.05 + p.c; ell(x, cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, 6, 3, a); x.fill(); } x.fillStyle = '#4c9a50'; circ(x, cx, cy, 4); x.fill(); break;
      case 'wardrobe': sh(); x.fillStyle = WOOD[(p.c + 1) % 6]; x.fillRect(X + 2, Y + 2, Wd - 4, H - 4); x.strokeStyle = 'rgba(0,0,0,0.45)'; x.beginPath(); x.moveTo(cx, Y + 3); x.lineTo(cx, Y + H - 3); x.stroke(); x.fillStyle = '#c9a227'; x.fillRect(cx - 3, cy - 1, 2, 3); x.fillRect(cx + 1, cy - 1, 2, 3); break;
      case 'safe': sh(); x.fillStyle = '#3d4249'; rr(x, X + 4, Y + 4, Wd - 8, H - 8, 2); x.fill(); x.strokeStyle = '#8a9099'; circ(x, cx, cy, 5); x.stroke(); x.fillStyle = '#c9a227'; circ(x, cx, cy, 1.6); x.fill(); break;
      case 'counter': case 'barc': case 'cell': {
        sh(); x.fillStyle = p.k === 'barc' ? '#3a2416' : p.k === 'cell' ? '#3a3d44' : '#59524a'; x.fillRect(X + 1, Y + 2, Wd - 2, H - 4);
        x.fillStyle = p.k === 'barc' ? '#6b4426' : '#d8d2c4'; x.fillRect(X + 3, Y + 4, Wd - 6, H - 8);
        if (p.k === 'cell') { x.strokeStyle = '#1b1c1f'; x.lineWidth = 2; for (let k = 4; k < (horiz ? Wd : H); k += 6) { x.beginPath(); if (horiz) { x.moveTo(X + k, Y + 2); x.lineTo(X + k, Y + H - 2); } else { x.moveTo(X + 2, Y + k); x.lineTo(X + Wd - 2, Y + k); } x.stroke(); } }
        else { x.fillStyle = '#222'; x.fillRect(horiz ? X + Wd - 16 : cx - 5, horiz ? cy - 5 : Y + H - 16, 10, 10); if (p.k === 'barc') for (let k = 0; k < 4; k++) { x.fillStyle = ['#7a2', '#a52', '#ccc', '#c92'][k]; circ(x, horiz ? X + 10 + k * 9 : cx - 6, horiz ? cy - 6 : Y + 10 + k * 9, 2); x.fill(); } }
        break;
      }
      case 'pooltable': sh(); x.fillStyle = '#4a2a16'; rr(x, X + 2, Y + 4, Wd - 4, H - 8, 4); x.fill(); x.fillStyle = '#1f6b3a'; x.fillRect(X + 6, Y + 8, Wd - 12, H - 16); for (let k = 0; k < 5; k++) { x.fillStyle = ['#fff', '#e0b000', '#c8102e', '#2d6db5', '#111'][k]; circ(x, X + 16 + k * 7, cy + ((k * 5) % 9) - 4, 2); x.fill(); } break;
      case 'tv': x.fillStyle = '#0d0d0f'; x.fillRect(horiz ? X + 3 : cx - 2, horiz ? cy - 2 : Y + 3, horiz ? Wd - 6 : 4, horiz ? 4 : H - 6); x.fillStyle = '#4a4a4a'; x.fillRect(cx - 4, cy - 4, 8, 8); x.fillStyle = '#0d0d0f'; x.fillRect(X + 5, Y + 12, Wd - 10, 3); break;
      case 'rug': { x.fillStyle = FAB[p.c]; x.fillRect(X + 3, Y + 3, Wd - 6, H - 6); x.strokeStyle = '#c9a227'; x.lineWidth = 1.5; x.strokeRect(X + 6, Y + 6, Wd - 12, H - 12); x.strokeStyle = 'rgba(255,255,255,0.15)'; x.beginPath(); x.moveTo(cx, Y + 8); x.lineTo(X + Wd - 8, cy); x.lineTo(cx, Y + H - 8); x.lineTo(X + 8, cy); x.closePath(); x.stroke(); break; }
      case 'dance': for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) { x.fillStyle = ['#3a1050', '#10305a', '#5a1030', '#103a2a'][(i + j * 2) % 4]; x.fillRect(X + i * TILE + 1, Y + j * TILE + 1, TILE - 2, TILE - 2); } break;
      case 'dj': sh(); x.fillStyle = '#1b1b1f'; x.fillRect(X + 2, Y + 4, Wd - 4, H - 8); x.fillStyle = '#555'; circ(x, X + 14, cy, 7); x.fill(); circ(x, X + Wd - 14, cy, 7); x.fill(); x.fillStyle = '#ff2aa0'; x.fillRect(cx - 4, cy - 2, 8, 4); break;
      case 'crate': sh(); x.fillStyle = '#9a7448'; x.fillRect(X + 3, Y + 3, Wd - 6, H - 6); x.strokeStyle = '#5e4326'; x.lineWidth = 2; x.strokeRect(X + 4, Y + 4, Wd - 8, H - 8); x.beginPath(); x.moveTo(X + 4, Y + 4); x.lineTo(X + Wd - 4, Y + H - 4); x.moveTo(X + Wd - 4, Y + 4); x.lineTo(X + 4, Y + H - 4); x.stroke(); break;
      case 'container': {
        const col = ['#a8321e', '#1e5aa8', '#2f7a3d', '#c98a1e', '#5a5f66', '#7a2a6a'][p.c % 6];
        x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(X + 5, Y + 6, Wd, H); x.fillStyle = col; x.fillRect(X + 1, Y + 1, Wd - 2, H - 2);
        x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 1.2; const n = Math.max(Wd, H) / 4;
        for (let k = 1; k < n; k++) { x.beginPath(); if (horiz) { x.moveTo(X + k * 4, Y + 2); x.lineTo(X + k * 4, Y + H - 2); } else { x.moveTo(X + 2, Y + k * 4); x.lineTo(X + Wd - 2, Y + k * 4); } x.stroke(); }
        x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(X + 1, Y + 1, Wd - 2, 3);
        break;
      }
      case 'dumpster': sh(); x.fillStyle = p.c & 1 ? '#2f5a3a' : '#2a4a6a'; rr(x, X + 2, Y + 3, Wd - 4, H - 6, 2); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 1.5; x.beginPath(); if (horiz) { x.moveTo(cx, Y + 3); x.lineTo(cx, Y + H - 3); } else { x.moveTo(X + 2, cy); x.lineTo(X + Wd - 2, cy); } x.stroke(); x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(X + 3, Y + 4, Wd - 6, 2); break;
      case 'locker': sh(); x.fillStyle = '#6f7a85'; x.fillRect(X + 3, Y + 3, Wd - 6, H - 6); x.fillStyle = '#4b545d'; for (let k = 0; k < 3; k++) x.fillRect(X + 7, Y + 7 + k * 4, Wd - 14, 1.5); break;
      case 'bench': sh(); x.fillStyle = '#7a5232'; for (let k = 0; k < 3; k++) { if (horiz) x.fillRect(X + 2, Y + 8 + k * 6, Wd - 4, 4); else x.fillRect(X + 8 + k * 6, Y + 2, 4, H - 4); } break;
      case 'vending': sh(); x.fillStyle = '#b3121b'; rr(x, X + 3, Y + 3, Wd - 6, H - 6, 2); x.fill(); x.fillStyle = '#e6f6ff'; x.fillRect(X + 6, Y + 6, Wd - 12, 7); x.fillStyle = '#111'; x.fillRect(X + 6, Y + 16, Wd - 12, 9); break;
      case 'trash': x.fillStyle = '#3a3f45'; circ(x, cx, cy, 6.5); x.fill(); x.fillStyle = '#23272b'; circ(x, cx, cy, 4); x.fill(); break;
      case 'hydrant': x.fillStyle = '#c8102e'; circ(x, cx, cy, 5); x.fill(); x.fillStyle = '#e6e6e6'; circ(x, cx, cy, 2); x.fill(); break;
      case 'bollard': x.fillStyle = '#222'; circ(x, cx, cy, 5); x.fill(); x.fillStyle = '#e0b000'; circ(x, cx, cy, 2); x.fill(); break;
      case 'fountain': x.fillStyle = '#8f8a80'; circ(x, cx, cy, Wd / 2 - 1); x.fill(); x.fillStyle = '#3c8fb0'; circ(x, cx, cy, Wd / 2 - 6); x.fill(); x.fillStyle = '#b8b2a6'; circ(x, cx, cy, 7); x.fill(); break;
      case 'piano': sh(); x.fillStyle = '#0c0c0e'; x.beginPath(); x.moveTo(X + 3, Y + 4); x.lineTo(X + Wd - 3, Y + 4); x.quadraticCurveTo(X + Wd - 3, Y + H - 2, X + Wd * 0.4, Y + H - 4); x.lineTo(X + 3, Y + H - 4); x.closePath(); x.fill(); x.fillStyle = '#eee'; x.fillRect(X + 4, Y + 4, Wd * 0.45, 3); break;
      case 'lamp': x.fillStyle = '#26282c'; circ(x, cx, cy, 4); x.fill(); break;
      case 'atm': sh(); x.fillStyle = '#3a3f46'; rr(x, X + 4, Y + 4, Wd - 8, H - 8, 2); x.fill(); x.fillStyle = '#1b5fb5'; x.fillRect(X + 8, Y + 7, Wd - 16, 7); x.fillStyle = '#b8c0c8'; for (let k = 0; k < 6; k++) x.fillRect(X + 9 + (k % 3) * 5, Y + 17 + Math.floor(k / 3) * 4, 3, 2.5); x.fillStyle = '#e0b000'; x.fillRect(X + 8, Y + H - 9, Wd - 16, 2); break;
      case 'tree': x.fillStyle = '#4a3220'; circ(x, cx, cy, 5); x.fill(); break;
      case 'umbrella': x.fillStyle = '#ddd'; circ(x, cx, cy, 2); x.fill(); break;
    }
  };

  /** tall props drawn above characters (canopies, lamp heads, umbrellas, bushes, cranes) */
  K.drawTallProp = function (x, p, t, wind, alpha = 1) {
    const cx = (p.x + p.w / 2) * TILE, cy = (p.y + p.h / 2) * TILE;
    x.globalAlpha = alpha;
    switch (p.k) {
      case 'tree': {
        const sway = Math.sin(t * 1.3 + p.id) * 1.2 * wind;
        const r = 20 + (p.id % 5) * 2;
        x.fillStyle = 'rgba(0,0,0,0.22)'; circ(x, cx + 9, cy + 11, r); x.fill();
        const base = ['#2b5a2a', '#305f2c', '#3a6a2e', '#294f2c', '#4a6a2a'][p.id % 5];
        x.fillStyle = U.shade(base, 0.75);
        for (let k = 0; k < 6; k++) { const a = k * 1.047 + p.id; circ(x, cx + Math.cos(a) * r * 0.45 + sway, cy + Math.sin(a) * r * 0.45 + sway * 0.6, r * 0.62); x.fill(); }
        x.fillStyle = base; circ(x, cx + sway - 2, cy + sway * 0.6 - 2, r * 0.75); x.fill();
        x.fillStyle = U.shade(base, 1.35); circ(x, cx + sway - 6, cy + sway * 0.6 - 6, r * 0.38); x.fill();
        break;
      }
      case 'bush': {
        const base = ['#2d5a26', '#3a6a2c', '#24502a'][p.id % 3];
        x.fillStyle = 'rgba(0,0,0,0.2)'; circ(x, cx + 4, cy + 5, 14); x.fill();
        x.fillStyle = base; for (let k = 0; k < 5; k++) { const a = k * 1.25 + p.id; circ(x, cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 9); x.fill(); }
        x.fillStyle = U.shade(base, 1.3); circ(x, cx - 3, cy - 3, 6); x.fill();
        break;
      }
      case 'lamp': x.fillStyle = '#1d1f22'; rr(x, cx - 7, cy - 3, 14, 6, 3); x.fill(); x.fillStyle = '#fff3cf'; x.fillRect(cx - 4, cy - 1.5, 8, 3); break;
      case 'umbrella': {
        const r = 22; for (let k = 0; k < 8; k++) { x.fillStyle = k & 1 ? '#f2f2ee' : '#c8102e'; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r, k * 0.785, (k + 1) * 0.785); x.closePath(); x.fill(); }
        break;
      }
      case 'crane': {
        x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(cx - 6 + 30, cy + 30, 14, 360);
        x.fillStyle = '#e0a800'; x.fillRect(cx - 8, cy - 20, 16, 380);
        x.strokeStyle = '#7a5c00'; x.lineWidth = 1.5; for (let k = 0; k < 24; k++) { x.beginPath(); x.moveTo(cx - 8, cy - 20 + k * 16); x.lineTo(cx + 8, cy - 4 + k * 16); x.stroke(); }
        x.fillStyle = '#2b2d31'; x.fillRect(cx - 14, cy - 34, 28, 22);
        break;
      }
    }
    x.globalAlpha = 1;
  };
})(globalThis.K = globalThis.K || {});
