/* RDE // KONTRAKT — HUD: clock, money, vitals, weapon, wanted, tracker, prompts, feed, banners, minimap */
(function (K) {
  'use strict';
  const U = K.U, T = K.T, TILE = K.TILE;
  const $ = (s) => document.querySelector(s);
  const WEATHER = { clear: '☀️', cloudy: '☁️', rain: '🌧️', storm: '⛈️', fog: '🌫️' };
  const NIGHTW = { clear: '🌙', cloudy: '☁️', rain: '🌧️', storm: '⛈️', fog: '🌫️' };

  /** dossier photo: front-facing bust drawn from an outfit spec */
  K.portrait = function (cv, spec) {
    const x = cv.getContext('2d'), S = cv.width;
    const of = K.OUTFITS[spec.outfit] || K.OUTFITS.civ1;
    const skin = spec.skin || '#e0b08a', hair = spec.hair;
    x.setTransform(1, 0, 0, 1, 0, 0);
    const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#3a2a2e'); g.addColorStop(1, '#0d0e12');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.scale(S / 100, S / 100);
    // shoulders
    const bg = x.createLinearGradient(0, 70, 0, 100); bg.addColorStop(0, U.shade(of.body, 1.15)); bg.addColorStop(1, U.shade(of.body, 0.7));
    x.fillStyle = bg; x.beginPath(); x.moveTo(8, 100); x.quadraticCurveTo(12, 72, 34, 68); x.lineTo(66, 68); x.quadraticCurveTo(88, 72, 92, 100); x.fill();
    const id = of.id;
    if (['suit', 'suitgrey', 'tux', 'rich'].includes(id)) { x.fillStyle = '#f2f0ea'; x.beginPath(); x.moveTo(42, 68); x.lineTo(50, 88); x.lineTo(58, 68); x.fill(); x.fillStyle = of.trim; x.beginPath(); x.moveTo(48, 72); x.lineTo(52, 72); x.lineTo(53, 92); x.lineTo(50, 96); x.lineTo(47, 92); x.fill(); }
    else if (id === 'police') { x.fillStyle = of.trim; x.beginPath(); x.arc(36, 84, 3.5, 0, 6.3); x.fill(); x.fillStyle = '#e8e8e8'; x.fillRect(44, 68, 12, 5); }
    else if (id === 'worker') { x.fillStyle = of.trim; x.fillRect(14, 84, 72, 5); }
    else if (id === 'chef' || id === 'doctor') { x.strokeStyle = 'rgba(0,0,0,.2)'; x.beginPath(); x.moveTo(50, 70); x.lineTo(50, 100); x.stroke(); }
    else if (id === 'waiter') { x.fillStyle = '#111'; x.fillRect(46, 68, 8, 4); }
    // neck & head
    x.fillStyle = U.shade(skin, 0.85); x.fillRect(43, 56, 14, 14);
    x.fillStyle = skin; x.beginPath(); x.ellipse(50, 42, 17, 21, 0, 0, 6.3); x.fill();
    x.beginPath(); x.ellipse(32.5, 44, 3.5, 5.5, 0, 0, 6.3); x.ellipse(67.5, 44, 3.5, 5.5, 0, 0, 6.3); x.fill();
    // face
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.beginPath(); x.ellipse(50, 50, 4, 6, 0, 0, 6.3); x.fill();
    x.fillStyle = '#1b1612'; x.beginPath(); x.ellipse(43, 42, 2.2, 1.6, 0, 0, 6.3); x.ellipse(57, 42, 2.2, 1.6, 0, 0, 6.3); x.fill();
    x.strokeStyle = 'rgba(30,20,15,0.7)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(39, 37); x.lineTo(46, 36); x.moveTo(54, 36); x.lineTo(61, 37); x.stroke();
    x.strokeStyle = 'rgba(90,40,40,0.7)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(45, 55); x.quadraticCurveTo(50, 57, 55, 55); x.stroke();
    // hair
    if (hair) {
      x.fillStyle = hair;
      x.beginPath(); x.moveTo(32, 42); x.quadraticCurveTo(30, 18, 50, 18); x.quadraticCurveTo(70, 18, 68, 42); x.quadraticCurveTo(64, 28, 50, 27); x.quadraticCurveTo(36, 28, 32, 42); x.fill();
      if (spec.female) { x.beginPath(); x.moveTo(32, 36); x.quadraticCurveTo(26, 60, 30, 70); x.lineTo(36, 66); x.quadraticCurveTo(33, 52, 35, 40); x.fill(); x.beginPath(); x.moveTo(68, 36); x.quadraticCurveTo(74, 60, 70, 70); x.lineTo(64, 66); x.quadraticCurveTo(67, 52, 65, 40); x.fill(); }
    } else { x.fillStyle = 'rgba(255,255,255,0.22)'; x.beginPath(); x.ellipse(44, 26, 7, 4, -0.3, 0, 6.3); x.fill(); }
    // hats
    const hat = spec.hat ? 'fedora' : of.hat;
    if (hat === 'fedora') { x.fillStyle = '#1d1a17'; x.beginPath(); x.ellipse(50, 26, 28, 5, 0, 0, 6.3); x.fill(); x.fillRect(34, 10, 32, 16); x.fillStyle = '#7a1420'; x.fillRect(34, 20, 32, 4); }
    else if (hat === 'cap') { x.fillStyle = of.hatC; x.beginPath(); x.ellipse(50, 22, 19, 9, 0, Math.PI, 0); x.fill(); x.fillRect(31, 22, 38, 4); x.fillStyle = '#0a1226'; x.beginPath(); x.ellipse(50, 27, 20, 3.5, 0, 0, 6.3); x.fill(); x.fillStyle = '#d4af37'; x.beginPath(); x.arc(50, 17, 2.5, 0, 6.3); x.fill(); }
    else if (hat === 'hard') { x.fillStyle = of.hatC; x.beginPath(); x.ellipse(50, 24, 20, 12, 0, Math.PI, 0); x.fill(); x.fillRect(28, 23, 44, 4); }
    else if (hat === 'chef') { x.fillStyle = '#fff'; x.beginPath(); x.arc(40, 14, 9, 0, 6.3); x.arc(52, 10, 10, 0, 6.3); x.arc(62, 15, 8, 0, 6.3); x.fill(); x.fillRect(34, 16, 32, 10); }
    else if (hat === 'band') { x.fillStyle = of.hatC; x.beginPath(); x.ellipse(50, 24, 18, 8, 0, Math.PI, 0); x.fill(); x.fillRect(32, 23, 36, 5); }
    else if (hat === 'ear') { x.fillStyle = '#111'; x.beginPath(); x.arc(67, 46, 2, 0, 6.3); x.fill(); x.strokeStyle = '#111'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(67, 48); x.quadraticCurveTo(70, 60, 64, 68); x.stroke(); }
    // photo grain + vignette
    const v = x.createRadialGradient(50, 45, 25, 50, 50, 75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    x.fillStyle = v; x.fillRect(0, 0, 100, 100);
    x.fillStyle = 'rgba(255,255,255,0.04)'; for (let k = 0; k < 60; k++) x.fillRect(U.hash2(k, 1, 3) * 100, U.hash2(k, 2, 3) * 100, 1, 1);
  };

  class UI {
    constructor(game) {
      this.g = game;
      this.el = {
        time: $('#c-time'), day: $('#c-day'), weather: $('#c-weather'), district: $('#district'), money: $('#money'),
        stars: $('#stars'), heat: $('#heat i'), tracker: $('#tracker'), hp: $('.bar.hp i'), hpT: $('#hp-t'), armor: $('.bar.armor i'), stam: $('.bar.stam i'),
        food: $('#n-food'), water: $('#n-water'), energy: $('#n-energy'), bleed: $('#n-bleed'), drunk: $('#n-drunk'),
        wName: $('#w-name'), wAmmo: $('#w-ammo'), wIcon: $('#w-icon'), wSlots: $('#w-slots'), stance: $('#stance'),
        prompt: $('#prompt'), feed: $('#feed'), banner: $('#banner'), mm: $('#mm'), bank: $('#bank'), jail: $('#jailbox'),
      };
      this.mmx = this.el.mm.getContext('2d');
      this.cache = {};
      this.t = 0;
      this.feedLog = [];
      this.bannerT = 0;
    }
    reset() {
      this.cache = {};
      this.mapTex = null;
      this.el.feed.innerHTML = '';
    }
    set(k, v, fn) { if (this.cache[k] === v) return false; this.cache[k] = v; fn(v); return true; }

    update(dt) {
      const g = this.g, w = g.world; if (!w) return;
      const P = w.P, p = w.player, e = this.el;
      this.t += dt;
      // clock & place
      this.set('time', U.clock(w.time), (v) => (e.time.textContent = v));
      this.set('day', `${U.weekday(w.time)} · Tag ${U.day(w.time)}`, (v) => (e.day.textContent = v));
      this.set('wx', (w.daylight() < 0.35 ? NIGHTW : WEATHER)[w.weather.kind], (v) => (e.weather.textContent = v));
      const dname = K.DISTRICTS[w.districtAt(p.x, p.y)] || '';
      const b = w.bldAt(p.x, p.y);
      const z = w.zoneAt(p.x, p.y);
      const place = b >= 0 ? `${dname} · ${w.buildings[b].name}` : dname;
      this.set('place', place + (z >= 0 ? '|z' + (w.zones[z].roles.includes(w.role(p)) ? 'ok' : 'no') : ''), () => { e.district.innerHTML = U.esc(place) + (z >= 0 ? (w.zones[z].roles.includes(w.role(p)) ? ' <span style="color:#5fd38d">· ZUGANG (Verkleidung)</span>' : ' <span style="color:#ff3b4e">· SPERRGEBIET</span>') : ''); });
      this.set('bank', P.bank || 0, (v) => (e.bank.textContent = `Konto ${U.money(v)}${P.deal && P.deal.rep ? ` · Dealer-Ruf ${P.deal.rep}` : ''}`));
      this.jailbox(P, w);
      if (this.set('money', P.money, (v) => (e.money.textContent = U.money(v)))) { e.money.classList.add('bump'); clearTimeout(this.mt); this.mt = setTimeout(() => e.money.classList.remove('bump'), 250); }
      // wanted
      const wl = Math.floor(w.wanted);
      this.set('wanted', wl, (v) => { e.stars.innerHTML = '<b>' + '★'.repeat(v) + '</b>' + '★'.repeat(5 - v); document.body.classList.toggle('wanted', v >= 2); });
      e.stars.classList.toggle('blink', wl > 0 && w.heat.seenT > 3);
      e.heat.style.width = wl > 0 ? (100 - (w.heatProgress || 0) * 100) + '%' : '0%';
      // vitals
      const mh = w.maxHp();
      this.set('hp', Math.ceil(Math.max(0, p.hp)), (v) => { e.hp.style.width = (v / mh * 100) + '%'; e.hpT.textContent = v; });
      this.set('armor', Math.ceil(p.armor), (v) => { e.armor.style.width = v + '%'; e.armor.parentNode.style.opacity = v > 0 ? 1 : 0.25; });
      e.stam.style.width = P.stamina + '%';
      for (const [k, el] of [['hunger', e.food], ['thirst', e.water], ['energy', e.energy]]) {
        const v = Math.round(P[k]);
        this.set(k, v, () => { el.querySelector('i').style.height = v + '%'; el.classList.toggle('low', v < 20); el.title = `${k === 'hunger' ? 'Hunger' : k === 'thirst' ? 'Durst' : 'Energie'}: ${v}%`; });
      }
      this.set('bleed', p.bleed > 0, (v) => e.bleed.classList.toggle('on', v));
      this.set('drunk', P.drunk > 0.25, (v) => e.drunk.classList.toggle('on', v));
      // weapon
      const wi = w.curWeapon(), d = K.WEAPONS[wi.id];
      const ammo = d.type === 'gun' ? `${wi.mag}<small> / ${P.ammo[d.ammo] || 0}</small>${wi.sup ? '<span class="sup">GEDÄMPFT</span>' : ''}` : d.consumable || d.stack ? `×${wi.n || 1}` : '';
      this.set('wname', d.name, (v) => { e.wName.textContent = v; e.wIcon.src = K.iconURL(wi.id); });
      this.set('wammo', ammo + (p.reloading ? 'r' : ''), () => { e.wAmmo.innerHTML = p.reloading ? '<small>LÄDT…</small>' : ammo; e.wAmmo.classList.toggle('empty', d.type === 'gun' && wi.mag === 0); });
      const slots = P.weapons.map((x, i) => x.id + (i === P.slot ? '*' : '') + (x.n || '')).join(',');
      this.set('slots', slots, () => {
        e.wSlots.innerHTML = P.weapons.map((x, i) => `<div class="${i === P.slot ? 'on' : ''}"><span>${i + 1}</span><img src="${K.iconURL(x.id)}">${x.n > 1 ? `<b>${x.n}</b>` : ''}</div>`).join('');
      });
      const st = [p.crouch ? '<b class="on">GEDUCKT</b>' : '', P.instinct ? '<b class="blue">INSTINKT</b>' : '', w.aiming ? '<b>ZIELEN</b>' : '', w.drag ? '<b class="on">ZIEHT LEICHE</b>' : '', P.flashlight ? '<b>LAMPE</b>' : '', K.OUTFITS[P.outfit].disguise ? `<b class="blue">${K.OUTFITS[P.outfit].name.toUpperCase()}</b>` : ''].join('');
      this.set('stance', st, (v) => (e.stance.innerHTML = v));
      // prompt
      const ctx = w.ctx || [];
      const pk = ctx.map((c) => c.key + c.label + !!c.fn).join('|') + (w.action ? 'A' + w.action.label : '');
      this.set('prompt', pk, () => {
        if (w.action) { e.prompt.innerHTML = `<div><kbd>${w.action.key}</kbd>${U.esc(w.action.label)} …</div>`; return; }
        e.prompt.innerHTML = ctx.slice(0, 3).map((c) => `<div class="${c.fn ? '' : 'off'}"><kbd>${c.key}</kbd>${U.esc(c.label)}${c.hold ? ' <small style="opacity:.6">(halten)</small>' : ''}</div>`).join('');
      });
      this.tracker();
      // banner timeout
      if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) e.banner.classList.remove('on'); }
      this.minimap();
    }

    jailbox(P, w) {
      const J = P.jail, el = this.el.jail;
      if (!J && !P.surrender && !P.masked) { this.set('jail', '', () => el.classList.add('hidden')); return; }
      let h;
      if (P.surrender) h = '<b>🙌 ERGEBEN</b><span>Halt still. Die Polizei nimmt dich fest. Bewegen = Widerstand.</span>';
      else if (J && J.escaped) h = '<b>⛓ AUF DER FLUCHT</b><span>Wechsle die Kleidung und tauch unter.</span>';
      else if (J) { const left = Math.max(0, J.until - w.time); h = `<b>⛓ HAFT · ${Math.floor(left / 60)}h ${String(Math.floor(left % 60)).padStart(2, '0')}m</b><span><kbd>K</kbd> Kaution ${U.money(J.bail)} · <kbd>E</kbd> an der Zellentür: Ausbruch (wenn kein Wärter hinsieht)</span><i style="width:${(1 - left / J.total) * 100}%"></i>`; }
      else h = '<b>🎭 VERMUMMT</b><span>Zeugen erkennen dich nicht. Maske ungesehen abnehmen (Inventar) = Fahndung weg.</span>';
      this.set('jail', h, (v) => { el.classList.remove('hidden'); el.innerHTML = v; });
    }
    tracker() {
      const w = this.g.world, c = w.contract, el = this.el.tracker;
      if (!c || (c.status !== 'active' && c.status !== 'killed')) { this.set('trk', '', () => el.classList.add('hidden')); return; }
      const left = Math.max(0, c.deadline - w.time);
      const objs = c.status === 'killed' ? '<div class="ok">Ziel eliminiert</div><div>Verlasse das Gebiet</div>' : `<div>Eliminiere ${U.esc(c.name)}</div>${c.bonuses.map((b) => `<div style="opacity:.75">Bonus: ${U.esc(b.desc)}</div>`).join('')}`;
      const key = c.id + c.status + Math.floor(left / 5) + c.intel;
      this.set('trk', key, () => {
        el.classList.remove('hidden');
        el.innerHTML = `<div class="tk-h"><canvas width="92" height="92"></canvas><div><div class="tk-p">${U.esc(c.title)} · ${'◆'.repeat(c.diff)}</div><div class="tk-n">${U.esc(c.name)}</div></div></div><div class="tk-o">${objs}</div><div class="tk-t">Frist: ${Math.floor(left / 60)}h ${String(Math.floor(left % 60)).padStart(2, '0')}m · ${U.money(c.reward)}${c.intel ? ' · INTEL ✔' : ''}</div>`;
        K.portrait(el.querySelector('canvas'), c);
      });
    }

    // ------------------------------------------------------------ minimap
    buildMapTex() {
      const w = this.g.world, c = K.mkCanvas(w.W, w.H), x = c.getContext('2d'), id = x.createImageData(w.W, w.H);
      const col = {};
      col[T.WATER] = [22, 48, 70]; col[T.POOL] = [60, 160, 200]; col[T.ROAD] = [58, 60, 66]; col[T.WALK] = [110, 108, 102]; col[T.GRASS] = [52, 88, 44]; col[T.PLAZA] = [120, 114, 104];
      col[T.DIRT] = [110, 88, 62]; col[T.DOCK] = [100, 78, 54]; col[T.QUAY] = [96, 96, 92]; col[T.HEDGE] = [36, 70, 34]; col[T.FENCE] = [40, 40, 40]; col[T.GATE] = [80, 80, 80]; col[T.CONC] = [86, 88, 90];
      for (let i = 0; i < w.N; i++) {
        const t = w.tiles[i], b = w.bmap[i];
        let c2 = col[t] || [150, 140, 130];
        if (b >= 0) { const bb = w.buildings[b]; c2 = U.hex2rgb(bb.color).map((v) => v * 0.8 + 30); if (t === T.WALL || t === T.WINDOW) c2 = c2.map((v) => v * 0.6); }
        if (w.solid[i] & 1 && b < 0 && t !== T.WATER) c2 = c2.map((v) => v * 0.75);
        id.data[i * 4] = c2[0]; id.data[i * 4 + 1] = c2[1]; id.data[i * 4 + 2] = c2[2]; id.data[i * 4 + 3] = 255;
      }
      x.putImageData(id, 0, 0);
      this.mapTex = c;
    }
    poiIcons() {
      const w = this.g.world, out = [];
      for (const b of w.buildings) {
        const x = (b.x + b.w / 2) * TILE, y = (b.y + b.h / 2) * TILE;
        if (b.owned) out.push({ x, y, e: '🏠', c: '#5fd38d' });
        else if (b.property) out.push({ x, y, e: '🏷️', c: '#f2c86b' });
        if (b.shop) out.push({ x, y, e: { gun: '🔫', black: '💀', food: '🛒', pharmacy: '💊', cloth: '👔', diner: '🍔', bar: '🍸', hospital: '🏥', grow: '🌱', bank: '🏦', jewel: '💎' }[b.shop] });
        if (b.type === 'police') out.push({ x, y, e: '🚓' });
        if (b.type === 'club') out.push({ x, y, e: '🎵' });
      }
      for (const p of w.props) if (p && p.k === 'atm') out.push({ x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE, e: '🏧', small: true });
      return out;
    }
    minimap() {
      const w = this.g.world, x = this.mmx, S = 440, p = w.player;
      if (!this.mapTex) { this.buildMapTex(); this.pois = this.poiIcons(); }
      const scale = 6; // px per tile
      const px = (p.inCar ? w.carOf(p).x : p.x) / TILE, py = (p.inCar ? w.carOf(p).y : p.y) / TILE;
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.fillStyle = '#0a0b0e'; x.fillRect(0, 0, S, S);
      x.imageSmoothingEnabled = false;
      x.save(); x.translate(S / 2, S / 2); x.scale(scale, scale); x.translate(-px, -py);
      x.drawImage(this.mapTex, 0, 0);
      x.restore();
      x.imageSmoothingEnabled = true;
      const toM = (wx, wy) => [S / 2 + (wx / TILE - px) * scale, S / 2 + (wy / TILE - py) * scale];
      // contract
      const c = w.contract, tgt = w.targetActor();
      if (c && c.status === 'active' && tgt) {
        if (c.intel) { const [mx, my] = toM(tgt.x, tgt.y); x.fillStyle = '#ff2030'; x.beginPath(); x.arc(mx, my, 9, 0, 6.3); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke(); }
        else if (c.ping) { const [mx, my] = toM(c.ping.x, c.ping.y); x.fillStyle = 'rgba(255,32,48,0.18)'; x.strokeStyle = 'rgba(255,32,48,0.7)'; x.lineWidth = 2; x.beginPath(); x.arc(mx, my, 8 * scale, 0, 6.3); x.fill(); x.stroke(); }
      }
      // POIs
      x.font = '22px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (const q of this.pois) { const [mx, my] = toM(q.x, q.y); if (mx < -20 || my < -20 || mx > S + 20 || my > S + 20) continue; x.font = q.small ? '15px sans-serif' : '22px sans-serif'; x.fillText(q.e, mx, my); }
      // people
      for (const a of w.actors) {
        if (!a.alive || a.removed || a.hidden || a === p || a.inCar) continue;
        const [mx, my] = toM(a.x, a.y); if (mx < 0 || my < 0 || mx > S || my > S) continue;
        const known = a.seesPlayer || w.P.instinct || a.kind === 'cop' && w.wanted > 0;
        if (a.kind === 'cop') { x.fillStyle = '#4f9bff'; }
        else if (a.state === 'hostile') x.fillStyle = '#ff2a2a';
        else if ((a.kind === 'guard' || a.kind === 'bodyguard' || a.kind === 'gang') && known) x.fillStyle = '#ffb000';
        else continue;
        x.beginPath(); x.arc(mx, my, 5, 0, 6.3); x.fill();
      }
      for (const car of w.cars) if (car.kind === 'police' && !car.dead) { const [mx, my] = toM(car.x, car.y); x.fillStyle = Math.floor(this.t * 6) % 2 ? '#ff2a2a' : '#4f9bff'; x.fillRect(mx - 6, my - 6, 12, 12); }
      // waypoint
      if (this.g.waypoint) { const [mx, my] = toM(this.g.waypoint.x, this.g.waypoint.y); x.strokeStyle = '#ffd34d'; x.lineWidth = 3; x.beginPath(); x.arc(U.clamp(mx, 12, S - 12), U.clamp(my, 12, S - 12), 9, 0, 6.3); x.stroke(); }
      // player arrow
      x.save(); x.translate(S / 2, S / 2); x.rotate(p.inCar ? w.carOf(p).a : p.angle);
      x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 3; x.beginPath(); x.moveTo(16, 0); x.lineTo(-10, -10); x.lineTo(-5, 0); x.lineTo(-10, 10); x.closePath(); x.stroke(); x.fill();
      x.restore();
      // view cone
      if (w.wanted > 0) { x.strokeStyle = `rgba(255,${Math.floor(this.t * 4) % 2 ? 40 : 120},60,0.6)`; x.lineWidth = 10; x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 5, 0, 6.3); x.stroke(); }
    }

    // ------------------------------------------------------------ feed / banners
    feed(text, kind = 'info') {
      const el = document.createElement('div');
      el.className = kind; el.textContent = text;
      this.el.feed.prepend(el);
      while (this.el.feed.children.length > 6) this.el.feed.lastChild.remove();
      setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 700); }, 5200);
      this.feedLog.unshift({ t: this.g.world ? U.clock(this.g.world.time) : '', text, kind });
      if (this.feedLog.length > 60) this.feedLog.pop();
    }
    banner(title, sub, kind = '', dur = 3) {
      const b = this.el.banner;
      b.className = kind; b.querySelector('b').textContent = title; b.querySelector('span').textContent = sub || '';
      void b.offsetWidth; b.classList.add('on');
      this.bannerT = dur;
    }
    toast(text, ms = 1600) {
      const t = $('#toast'); t.textContent = text; t.classList.add('on');
      clearTimeout(this.tt); this.tt = setTimeout(() => t.classList.remove('on'), ms);
    }

    onEvent(e) {
      const g = this.g, w = g.world;
      switch (e.type) {
        case 'notify': this.feed(e.text, e.kind); break;
        case 'banner': this.banner(e.title, e.sub, e.kind); break;
        case 'wanted':
          if (e.level > e.prev) { this.banner('★'.repeat(e.level), e.why || 'Fahndung', 'wanted', 2.2); this.feed(`Fahndungsstufe ${e.level}: ${e.why}`, 'bad'); }
          else this.feed(e.level ? `Fahndung gesenkt (${e.why})` : 'Fahndung eingestellt. Du bist sauber.', 'good');
          break;
        case 'phone': this.feed('📱 ' + e.text, 'phone'); g.phoneBadge = (g.phoneBadge || 0) + 1; break;
        case 'xp': break;
        case 'targetDown': this.banner('ZIEL ELIMINIERT', e.name, 'red', 3); break;
        case 'contractDone': g.menus.showResult(e); break;
        case 'playerDead': setTimeout(() => g.menus.showDead(e), 1800); break;
        case 'arrested': g.menus.showArrest(e); break;
        case 'respawn': this.feed(`Krankenhausrechnung: −${U.money(e.fee)}${e.lost ? ` · ${e.lost} Waffen beschlagnahmt` : ''}`, 'bad'); break;
        case 'ui': g.menus.openFromWorld(e); break;
        case 'slept': this.feed(`Ausgeschlafen (${e.hours}h). Spiel gespeichert.`, 'good'); break;
        case 'weather': this.feed({ clear: 'Der Himmel klart auf.', cloudy: 'Wolken ziehen auf.', rain: 'Es beginnt zu regnen. Regen dämpft Geräusche.', storm: 'Unwetter! Der Sturm verschluckt jeden Schuss.', fog: 'Nebel legt sich über die Stadt. Sichtweiten sinken.' }[e.kind], 'info'); break;
        case 'bodyFound': if (w.contract && w.contract.status === 'active') this.feed('Eine Leiche wurde gefunden.', 'bad'); break;
        case 'jailed': g.menus.showJail(e); break;
        case 'released': this.banner(e.how === 'bail' ? 'KAUTION GEZAHLT' : 'ENTLASSEN', 'Deine Schusswaffen und Drogen sind weg. Neue Chance, Krähenburg.', 'gold', 3.5); break;
        case 'surrender': this.feed('Du ergibst dich. Nicht bewegen!', 'bad'); break;
        case 'carEnter': this.feed(e.kind === 'police' ? 'Polizeiwagen gekapert. [R] Sirene' : 'Fahrzeug übernommen. [Leertaste] Handbremse · [H] Hupe · [F] aussteigen'); break;
      }
    }
  }
  K.UI = UI;
})(globalThis.K = globalThis.K || {});
