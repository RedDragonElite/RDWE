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
      const down = P.handsDown && P.slot === 0;
      this.set('wname', down ? 'Hände unten' : d.name, (v) => { e.wName.textContent = v; e.wIcon.src = K.iconURL(wi.id); e.wIcon.style.opacity = down ? 0.35 : 1; });
      this.set('wammo', ammo + (p.reloading ? 'r' : ''), () => { e.wAmmo.innerHTML = p.reloading ? '<small>LÄDT…</small>' : ammo; e.wAmmo.classList.toggle('empty', d.type === 'gun' && wi.mag === 0); });
      const slots = P.weapons.map((x, i) => x.id + (i === P.slot ? '*' : '') + (x.n || '')).join(',');
      this.set('slots', slots, () => {
        e.wSlots.innerHTML = P.weapons.map((x, i) => `<div class="${i === P.slot ? 'on' : ''}"><span>${i + 1}</span><img src="${K.iconURL(x.id)}">${x.n > 1 ? `<b>${x.n}</b>` : ''}</div>`).join('');
      });
      const st = [P.handsDown && P.slot === 0 ? '<b>HÄNDE UNTEN</b>' : '', p.crouch ? '<b class="on">GEDUCKT</b>' : '', P.instinct ? '<b class="blue">INSTINKT</b>' : '', w.aiming ? '<b>ZIELEN</b>' : '', w.drag ? '<b class="on">ZIEHT LEICHE</b>' : '', P.flashlight ? '<b>LAMPE</b>' : '', K.OUTFITS[P.outfit].disguise ? `<b class="blue">${K.OUTFITS[P.outfit].name.toUpperCase()}</b>` : ''].join('');
      this.set('stance', st, (v) => (e.stance.innerHTML = v));
      // prompt
      const ctx = w.ctx || [];
      const pk = ctx.map((c) => c.key + c.label + !!c.fn).join('|') + (w.action ? 'A' + w.action.label : '');
      this.set('prompt', pk, () => {
        if (w.action) { e.prompt.innerHTML = `<div><kbd>${w.action.key}</kbd>${U.esc(w.action.label)} …</div>`; return; }
        e.prompt.innerHTML = ctx.slice(0, 3).map((c) => `<div class="${c.fn ? '' : 'off'}"><kbd>${c.key}</kbd>${U.esc(c.label)}${c.hold ? ' <small style="opacity:.6">(halten)</small>' : ''}</div>`).join('');
      });
      this.tracker();
      this.carHud(w, p, P);
      this.pumpPanel(w, P);
      // crew cards
      const R = (P.crew || []).filter((m) => m.state === 'active');
      const ck = R.map((m) => { const a = w.crewActor(m); return m.id + ':' + (a ? Math.ceil(a.hp / 5) + a.state + !!a.inCar : 'x'); }).join(',');
      this.set('crew', ck, () => {
        const el = document.getElementById('crewhud'); if (!el) return;
        el.innerHTML = R.map((m) => {
          const a = w.crewActor(m), rar = K.CREW.rarities.find((x) => x.key === m.rarity);
          const st = !a ? 'unterwegs' : a.inCar ? 'im Auto' : a.state === 'hostile' ? 'im Gefecht' : a.state === 'stay' ? 'hält Position' : Math.hypot(a.x - p.x, a.y - p.y) > 12 * K.TILE ? 'kommt' : 'folgt';
          const hp = a ? Math.max(0, a.hp / a.maxHp * 100) : 100;
          return `<div class="cm" style="--c:${rar.col}">${U.esc(m.name.split(' ')[0])}<small>${st}</small><i><b style="width:${hp}%;background:${hp < 35 ? '#ff3b4e' : '#3ddc84'}"></b></i></div>`;
        }).join('');
      });
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
    /** Vice-style map: pastel districts, teal sea, peach sand + a glowing neon street layer */
    buildMapTex() {
      const w = this.g.world, c = K.mkCanvas(w.W, w.H), x = c.getContext('2d'), id = x.createImageData(w.W, w.H);
      const col = {};
      col[T.WATER] = [18, 92, 128]; col[T.POOL] = [60, 220, 240]; col[T.ROAD] = [44, 30, 64]; col[T.WALK] = [118, 96, 140]; col[T.GRASS] = [70, 150, 96]; col[T.PLAZA] = [150, 124, 160];
      col[T.DIRT] = [150, 116, 86]; col[T.DOCK] = [120, 92, 70]; col[T.QUAY] = [104, 92, 120]; col[T.HEDGE] = [44, 110, 64]; col[T.FENCE] = [40, 30, 50]; col[T.GATE] = [90, 80, 100]; col[T.CONC] = [104, 96, 124]; col[T.SAND] = [244, 214, 164]; col[T.WOOD] = [190, 140, 100];
      const PAL = { beach: ['#ff8fb1', '#7fe0d0', '#ffd39a'], down: ['#8fd3ff', '#c79bff', '#7fe0d0', '#ff9ad5'], old: ['#ffb38a', '#ffd39a', '#f29ac0'], res: ['#a8e6a1', '#ffe08a', '#9fd8ff'], hill: ['#ff9a8a', '#ffcf9a'], ind: ['#9a8fb5', '#7f8aa5'], docks: ['#8a9ab5', '#b58aa8'] };
      const bcol = w.buildings.map((b) => { const p = PAL[b.district] || PAL.down; return U.hex2rgb(p[b.seed % p.length]); });
      for (let i = 0; i < w.N; i++) {
        const t = w.tiles[i], b = w.bmap[i];
        let c2 = col[t] || [150, 140, 150];
        if (t === T.WATER) { const y = (i / w.W) | 0, depth = Math.min(1, (y - w.city.W) / 12); c2 = [18 + (1 - depth) * 40, 92 + (1 - depth) * 70, 128 + (1 - depth) * 40]; }
        if (b >= 0) { c2 = bcol[b]; if (t === T.WALL || t === T.WINDOW) c2 = c2.map((v) => v * 0.62); }
        if (w.solid[i] & 1 && b < 0 && t !== T.WATER) c2 = c2.map((v) => v * 0.78);
        id.data[i * 4] = c2[0]; id.data[i * 4 + 1] = c2[1]; id.data[i * 4 + 2] = c2[2]; id.data[i * 4 + 3] = 255;
      }
      x.putImageData(id, 0, 0);
      this.mapTex = c;
      // neon street layer (4 px per tile)
      const S = 4, n = K.mkCanvas(w.W * S, w.H * S), nx = n.getContext('2d'), P = w.city.P, NB = w.city.NB;
      const seg = (fn) => { for (let j = 0; j <= NB; j++) for (let i = 0; i <= NB; i++) { const x0 = (i * P + 2) * S, y0 = (j * P + 2) * S; if (i < NB) fn(x0, y0, x0 + P * S, y0, j); if (j < NB) fn(x0, y0, x0, y0 + P * S, -1); } };
      nx.lineCap = 'round';
      nx.shadowColor = '#ff2fa0'; nx.shadowBlur = 14; nx.strokeStyle = 'rgba(255,47,160,0.28)'; nx.lineWidth = 13;
      seg((a, b, c3, d) => { nx.beginPath(); nx.moveTo(a, b); nx.lineTo(c3, d); nx.stroke(); });
      nx.shadowColor = '#2ef2ff'; nx.shadowBlur = 6; nx.strokeStyle = 'rgba(46,242,255,0.75)'; nx.lineWidth = 1.6;
      seg((a, b, c3, d, j) => { nx.lineWidth = j === NB ? 3 : 1.6; nx.beginPath(); nx.moveTo(a, b); nx.lineTo(c3, d); nx.stroke(); });
      nx.shadowBlur = 0;
      this.mapNeon = n;
    }
    poiIcons() {
      const w = this.g.world, out = [];
      for (const b of w.buildings) {
        const x = (b.x + b.w / 2) * TILE, y = (b.y + b.h / 2) * TILE;
        if (b.owned) out.push({ x, y, e: '🏠', c: '#5fd38d' });
        else if (b.property) out.push({ x, y, e: '🏷️', c: '#f2c86b' });
        if (b.shop) out.push({ x, y, e: { gun: '🔫', black: '💀', food: '🛒', pharmacy: '💊', cloth: '👔', diner: '🍔', bar: '🍸', hospital: '🏥', grow: '🌱', bank: '🏦', jewel: '💎', gas: '⛽', cars: '🚗', mech: '🔧', beachbar: '🍹', strip: '💃' }[b.shop] });
        if (b.type === 'police') out.push({ x, y, e: '🚓' });
        if (b.type === 'club') out.push({ x, y, e: '🎵' });
      }
      for (const p of w.props) if (p && p.k === 'atm') out.push({ x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE, e: '🏧', small: true });
      return out;
    }
    /** tint every claimed block in its owner's colour (map units: tiles) */
    drawTurf(x, s, ox, oy, alpha) {
      const w = this.g.world; if (!w.turfSpots) return;
      for (const k in w.turfSpots) {
        const sp = w.turfSpots[k], col = w.turfColor(w.turfOwner(k)); if (!col) continue;
        x.globalAlpha = alpha; x.fillStyle = col; x.fillRect(ox + (sp.bi * 26 + 3) * s, oy + (sp.bj * 26 + 3) * s, 20 * s, 20 * s);
        x.globalAlpha = Math.min(1, alpha * 3.5); x.strokeStyle = col; x.lineWidth = Math.max(1, s * 0.35); x.strokeRect(ox + (sp.bi * 26 + 3.5) * s, oy + (sp.bj * 26 + 3.5) * s, 19 * s, 19 * s);
        if (w.P.wars && w.P.wars[w.turfOwner(k)]) { x.globalAlpha = 0.9; x.fillStyle = '#ff3b4e'; x.font = `${Math.max(9, s * 5)}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('⚔', ox + (sp.bi * 26 + 13) * s, oy + (sp.bj * 26 + 13) * s); }
      }
      x.globalAlpha = 1;
    }
    /** rde_carhud-style dashboard */
    carHud(w, p, P) {
      const el = this.chEl || (this.chEl = document.getElementById('carhud'));
      const c = p.inCar ? w.carOf(p) : null;
      document.body.classList.toggle('driving', !!c);
      if (!el) return;
      el.classList.toggle('hidden', !c);
      const crack = this.crackEl || (this.crackEl = document.getElementById('crack'));
      if (!c || c.eng == null) { if (crack) crack.classList.add('hidden'); return; }
      const cv = this.chCv || (this.chCv = document.getElementById('ch-cv'));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== 760 * dpr) { cv.width = 760 * dpr; cv.height = 170 * dpr; }
      const x = cv.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, 760, 170);
      const t = this.t, kmh = (c.speed || 0) * K.KMH, d = K.CARK[c.kind];
      const ratio = Math.abs(c.vf || 0) / (d.max * 1.05);
      const gear = (c.vf || 0) < -8 ? 'R' : kmh < 2 ? 'N' : String(Math.min(6, 1 + Math.floor(ratio * 6)));
      const band = ratio * 6 - Math.floor(ratio * 6);
      const rpm = !c.engineOn ? 0 : gear === 'N' ? 0.9 + Math.abs(c.thr || 0) * 3 : U.clamp(1.2 + band * 5.6 + Math.abs(c.thr || 0) * 0.6 + (c.boost ? 0.8 : 0), 0.9, 7.9);
      this.rpmS = U.lerp(this.rpmS || 0, rpm, 0.2);
      const panel = (X, Y, W, H) => { x.fillStyle = 'rgba(12,12,12,0.92)'; x.beginPath(); x.roundRect(X, Y, W, H, 14); x.fill(); x.strokeStyle = 'rgba(255,255,255,0.08)'; x.stroke(); };
      const gauge = (cx, cy, r, v, max, step, label, red, unit, digital) => {
        x.fillStyle = 'rgba(12,12,12,0.92)'; x.beginPath(); x.arc(cx, cy, r + 8, 0, 6.3); x.fill();
        x.strokeStyle = 'rgba(255,255,255,0.1)'; x.lineWidth = 2; x.stroke();
        const a0 = -Math.PI / 2 - 2.27, a1 = -Math.PI / 2 + 2.27, ang = (q) => a0 + (a1 - a0) * U.clamp(q / max, 0, 1);
        if (red != null) { x.strokeStyle = 'rgba(239,68,68,0.85)'; x.lineWidth = 5; x.beginPath(); x.arc(cx, cy, r - 4, ang(red), a1); x.stroke(); }
        x.strokeStyle = '#cfcfcf'; x.fillStyle = '#cfcfcf'; x.font = `600 ${r > 60 ? 11 : 9}px Inter, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
        for (let q = 0; q <= max + 1e-6; q += step / 2) {
          const a = ang(q), major = Math.abs(q / step - Math.round(q / step)) < 1e-6;
          x.lineWidth = major ? 2 : 1; x.beginPath(); x.moveTo(cx + Math.cos(a) * (r - (major ? 10 : 6)), cy + Math.sin(a) * (r - (major ? 10 : 6))); x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.stroke();
          if (major) x.fillText(String(Math.round(q)), cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22));
        }
        const a = ang(v);
        x.strokeStyle = '#ef4444'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx - Math.cos(a) * 8, cy - Math.sin(a) * 8); x.lineTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6)); x.stroke();
        x.fillStyle = '#1b1b1b'; x.beginPath(); x.arc(cx, cy, 6, 0, 6.3); x.fill(); x.strokeStyle = '#ef4444'; x.lineWidth = 2; x.stroke();
        x.fillStyle = '#9a9a9a'; x.font = '600 9px Inter, sans-serif'; x.fillText(label, cx, cy + r * 0.42);
        if (digital != null) { x.fillStyle = '#fff'; x.font = `700 ${r > 60 ? 18 : 13}px Inter, sans-serif`; x.fillText(digital, cx, cy + r * 0.66); if (unit) { x.fillStyle = '#888'; x.font = '600 8px Inter, sans-serif'; x.fillText(unit, cx, cy + r * 0.66 + 12); } }
      };
      gauge(82, 92, 66, kmh, 280, 40, 'KM/H', null, '', String(Math.round(kmh)));
      gauge(226, 92, 66, this.rpmS, 8, 1, 'U/MIN ×1000', 7, '', null);
      // centre panel
      panel(306, 14, 178, 148);
      const blinkOn = Math.floor(t / 0.55) % 2 === 0;
      x.font = '700 22px Inter, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = (c.blink === -1 || c.blink === 2) && blinkOn ? '#fbbf24' : '#3a3a3a'; x.fillText('◀', 330, 38);
      x.fillStyle = (c.blink === 1 || c.blink === 2) && blinkOn ? '#fbbf24' : '#3a3a3a'; x.fillText('▶', 460, 38);
      x.fillStyle = gear === 'N' ? '#9a9a9a' : gear === 'R' ? '#fbbf24' : '#fff'; x.font = '800 40px Inter, sans-serif'; x.fillText(gear, 395, 46);
      x.font = '600 10px Inter, sans-serif'; x.fillStyle = '#9a9a9a'; x.fillText(`ODO ${c.odo.toFixed(1)} km`, 395, 76);
      const fuelCol = c.fuel < 10 ? '#ef4444' : c.fuel < 20 ? '#fbbf24' : '#4ade80';
      x.fillStyle = K.carModel(c).ev ? '#60a5fa' : fuelCol; x.font = '700 12px Inter, sans-serif'; x.fillText(K.carModel(c).ev ? '⚡ ELEKTRO' : `⛽ ${Math.round(c.fuel)}%`, 395, 92);
      const pill = (px, py, txt, col, on) => { x.fillStyle = on ? col : 'rgba(255,255,255,0.07)'; x.beginPath(); x.roundRect(px - 20, py - 8, 40, 16, 5); x.fill(); x.fillStyle = on ? '#111' : '#666'; x.font = '700 8px Inter, sans-serif'; x.fillText(txt, px, py + 0.5); };
      const engCol = c.engineOn ? '#4ade80' : (Math.floor(t * 3) % 2 ? '#ef4444' : '#5a1a1a');
      pill(330, 112, c.crankT > 0 ? 'START' : 'MOTOR', engCol, true);
      pill(374, 112, 'GURT', c.belt ? '#4ade80' : '#ef4444', true);
      pill(418, 112, 'TEMPO', '#60a5fa', !!c.cruise);
      pill(462, 112, c.highBeam ? 'FERN' : 'LICHT', c.highBeam ? '#fbbf24' : '#4ade80', !!c.lightsOn);
      ['VL', 'VR', 'HL', 'HR'].forEach((n, i) => { const h = c.tires[i]; pill(330 + i * 44, 134, n, h < 1 ? (Math.floor(t * 4) % 2 ? '#ef4444' : '#555') : h < 20 ? '#ef4444' : h < 70 ? '#fbbf24' : '#4ade80', true); });
      if (c.tune && c.tune.nitro) { x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(318, 150, 154, 5); x.fillStyle = c.boost ? '#a855f7' : '#60a5fa'; x.fillRect(318, 150, 154 * c.nos / 100, 5); }
      if (c.tune && c.tune.turbo) { x.fillStyle = '#9a9a9a'; x.font = '600 8px Inter, sans-serif'; x.fillText(`BOOST ${(Math.abs(c.thr || 0) * Math.min(1, kmh / 60) * 2.5).toFixed(1)} bar`, 395, 8); }
      gauge(560, 104, 46, K.carModel(c).ev ? 100 : c.fuel, 100, 25, 'TANK', null, '', null);
      gauge(676, 104, 46, c.temp, 150, 30, '°C', 110, '', String(Math.round(c.temp)));
      // engine / body bars under the small gauges
      const bar = (bx, v, label) => { x.fillStyle = 'rgba(12,12,12,0.92)'; x.fillRect(bx - 46, 156, 92, 10); x.fillStyle = v > 60 ? '#4ade80' : v > 30 ? '#fbbf24' : '#ef4444'; x.fillRect(bx - 45, 157, 90 * v / 100, 8); x.fillStyle = '#ddd'; x.font = '700 7px Inter, sans-serif'; x.fillText(label, bx, 161.5); };
      bar(560, c.eng, 'MOTOR'); bar(676, c.bodyHP, 'KAROSSERIE');
      // warnings
      const warn = this.chWarn || (this.chWarn = document.getElementById('ch-warn'));
      const wtxt = c.temp >= 110 ? `MOTOR ÜBERHITZT — ${Math.round(c.temp)}°C` : c.eng < 10 ? 'MOTORSCHADEN' : !K.carModel(c).ev && c.fuel < 8 ? (c.fuel <= 0 ? 'TANK LEER' : 'TANK FAST LEER') : c.leak ? 'TANK LECK — SPRIT LÄUFT AUS' : '';
      if (warn.textContent !== wtxt) warn.textContent = wtxt;
      warn.classList.toggle('on', !!wtxt);
      // windshield crack overlay (5 levels)
      if (crack) {
        const lvl = Math.ceil((c.crack || 0) / 20);
        crack.classList.toggle('hidden', lvl <= 0);
        if (lvl > 0) { if (!this.crackURL) this.crackURL = this.makeCrack(); if (!crack.style.backgroundImage) crack.style.backgroundImage = `url(${this.crackURL})`; crack.style.opacity = (lvl / 5 * 0.55).toFixed(2); }
      }
    }
    makeCrack() {
      const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; const x = cv.getContext('2d');
      x.strokeStyle = 'rgba(230,240,255,0.85)'; x.lineCap = 'round';
      const burst = (ox, oy, n, len) => { for (let k = 0; k < n; k++) { let a = (k / n) * 6.3 + Math.random() * 0.4, px = ox, py = oy; x.lineWidth = 1.6; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 9; s++) { a += (Math.random() - 0.5) * 0.5; px += Math.cos(a) * len * (0.5 + Math.random()); py += Math.sin(a) * len * (0.5 + Math.random()); x.lineTo(px, py); } x.stroke(); } for (let r = 1; r < 4; r++) { x.lineWidth = 0.8; x.beginPath(); for (let k = 0; k <= 14; k++) { const a = k / 14 * 6.3, rr = r * len * 1.6 * (0.8 + Math.random() * 0.4); k ? x.lineTo(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr) : x.moveTo(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr); } x.stroke(); } };
      burst(1050, 160, 16, 38); burst(260, 560, 11, 26);
      return cv.toDataURL();
    }
    /** rde_fuel-style pump display */
    pumpPanel(w, P) {
      const el = this.ppEl || (this.ppEl = document.getElementById('pumppanel'));
      if (!el) return;
      const dt = 1 / 60;
      if (this.pumpErrT > 0) this.pumpErrT -= dt;
      if (this.pumpDone) this.pumpDone.t -= dt;
      const show = !!P.nozzle || (this.pumpDone && this.pumpDone.t > 0);
      el.classList.toggle('hidden', !show);
      if (!show) return;
      const f = P.fueling || (this.pumpDone && this.pumpDone.t > 0 ? this.pumpDone : null);
      const car = P.fueling ? w.cars.find((q) => q.id === P.fueling.car) : null;
      const amt = f ? f.cost : 0, pct = car ? car.fuel : f && f.pct != null ? f.pct : 0;
      const a = U.clamp(amt, 0, 999.99).toFixed(2).padStart(6, '0'), b = U.clamp(pct, 0, 100).toFixed(2).padStart(6, '0');
      if (this.ppA !== a) { this.ppA = a; document.getElementById('pp-amt').textContent = a; }
      if (this.ppB !== b) { this.ppB = b; document.getElementById('pp-pct').textContent = b; document.getElementById('pp-fill').style.width = U.clamp(pct, 0, 100) + '%'; }
      el.classList.toggle('on', !!P.fueling); el.classList.toggle('err', this.pumpErrT > 0);
      document.getElementById('pp-hose').style.visibility = P.nozzle ? 'visible' : 'hidden';
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
      if (this.mapNeon) x.drawImage(this.mapNeon, 0, 0, w.W, w.H);
      this.drawTurf(x, 1, 0, 0, 0.16);
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
        if (a.kind === 'crew') x.fillStyle = '#3ddc84';
        else if (a.kind === 'cop') { x.fillStyle = '#4f9bff'; }
        else if (a.state === 'hostile') x.fillStyle = '#ff2a2a';
        else if ((a.kind === 'guard' || a.kind === 'bodyguard' || a.kind === 'gang') && known) x.fillStyle = '#ffb000';
        else continue;
        x.beginPath(); x.arc(mx, my, 5, 0, 6.3); x.fill();
      }
      // your cars and the car service driver
      x.font = '17px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (const car of w.cars) {
        if (car.dead || car.driver === 'player') continue;
        if (car.owned) { const [mx, my] = toM(car.x, car.y); if (mx < 0 || my < 0 || mx > S || my > S) continue; if (car.service) { x.fillStyle = '#3b82f6'; x.beginPath(); x.arc(mx, my, 8, 0, 6.3); x.fill(); } x.fillText('🚗', mx, my); }
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
        case 'waypoint': this.g.waypoint = { x: e.x, y: e.y }; break;
        case 'pump': if (e.broke) { this.pumpErrT = 1.8; } if (e.done) { this.pumpDone = { ...e.done, t: 1.5 }; } break;
        case 'turf': this.turfTex = null; break;
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
