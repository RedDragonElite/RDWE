/* RDE // KONTRAKT — menus: phone apps, inventory, shops, stash, wardrobe, sleep, map, title, pause, results */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE, W8 = K.WEAPONS;
  const $ = (s) => document.querySelector(s);
  const esc = U.esc;
  /** one hotbar / inventory tile (weapon or item) */
  K.slotIcon = (t, id) => {
    if (t === 'w') return `<img src="${K.iconURL(id)}">`;
    const it = K.ITEMS[id]; if (!it) return '';
    return it.g ? `<img src="${K.iconURL(it.g)}">` : `<i class="emo">${it.e || '•'}</i>`;
  };
  K.hotbarHTML = (w, drag) => {
    const P = w.P, hb = w.hotbar(), down = P.handsDown && P.slot === 0, curId = !down && P.weapons[P.slot] ? P.weapons[P.slot].id : null;
    return hb.map((e, i) => {
      if (!e) return `<div class="hb empty" data-hb="${i}"><span>${i + 1}</span></div>`;
      const n = e.t === 'w' ? (P.weapons.find((q) => q.id === e.id) || {}).n : P.inv[e.id] || 0;
      const on = (e.t === 'w' && e.id === curId) || (e.id === 'mask' && P.masked);
      return `<div class="hb ${on ? 'on' : ''} ${e.t === 'i' && !n ? 'out' : ''}" data-hb="${i}" ${drag ? 'data-drag="hb"' : ''} data-t="${e.t}" data-id="${e.id}"><span>${i + 1}</span>${K.slotIcon(e.t, e.id)}${e.t === 'i' || n > 1 ? `<b>${n}</b>` : ''}</div>`;
    }).join('');
  };
  const icon = (key) => {
    if (W8[key]) return `<img src="${K.iconURL(key)}">`;
    if (key.startsWith('a:')) return '<span style="font:600 13px Oswald;color:#d4a63a">▮▮▮</span>';
    if (key.startsWith('o:')) return '👔';
    const it = K.ITEMS[key]; if (!it) return '';
    return it.g ? `<img src="${K.iconURL(it.g)}">` : it.e;
  };

  class Menus {
    constructor(game) {
      this.g = game;
      this.phoneApp = 'home';
      this.panelKind = null;
      // phone buttons
      $('#ph-close').onclick = () => this.closePhone();
      $('#ph-homebtn').onclick = () => this.phone('home');
      $('#ph-back').onclick = () => this.phone('home');
      $('#panel .pn-x').onclick = () => this.closePanel();
      $('#panel').addEventListener('mousedown', (e) => { if (e.target.id === 'panel') this.closePanel(); });
      $('#mapview').addEventListener('mousedown', (e) => { if (e.target.id === 'mapview') this.closeMap(); });
      // title
      $('#t-new').onclick = () => { this.g.audio.unlock(); this.g.newGame(); };
      $('#t-continue').onclick = () => { this.g.audio.unlock(); this.g.continueGame(); };
      $('#t-controls').onclick = () => this.controls();
      $('#t-settings').onclick = () => this.settings();
      document.querySelectorAll('#pause [data-p]').forEach((b) => (b.onclick = () => this.pauseAction(b.dataset.p)));
      const bm = $('#bigmap');
      bm.addEventListener('mousedown', (e) => {
        const r = bm.getBoundingClientRect(), m = this.mapMeta; if (!m) return;
        const x = ((e.clientX - r.left) * (bm.width / r.width) - m.ox) / m.s * TILE, y = ((e.clientY - r.top) * (bm.height / r.height) - m.oy) / m.s * TILE;
        if (e.button === 2) this.g.waypoint = null; else this.g.waypoint = { x, y };
        this.g.audio.ui('click'); this.drawMap();
      });
      bm.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('mouseover', (e) => { if (e.target.closest && e.target.closest('button')) this.g.audio.ui('hover'); });
    }
    anyOpen() { return !$('#phone').classList.contains('hidden') || !$('#panel').classList.contains('hidden') || !$('#mapview').classList.contains('hidden') || !$('#pause').classList.contains('hidden') || !$('#result').classList.contains('hidden') || !$('#dead').classList.contains('hidden') || !$('#title').classList.contains('hidden'); }
    sync() { document.body.classList.toggle('menu', this.anyOpen()); this.g.paused = this.anyOpen(); }
    closeAll() { this.closePhone(); this.closePanel(); this.closeMap(); $('#pause').classList.add('hidden'); this.sync(); }

    // ============================================================ phone
    openPhone(app = 'home') { this.closePanel(); this.closeMap(); $('#phone').classList.remove('hidden'); this.g.audio.ui('click'); this.phone(app); this.sync(); }
    closePhone() { $('#phone').classList.add('hidden'); this.sync(); }
    togglePhone() { if ($('#phone').classList.contains('hidden')) this.openPhone(); else this.closePhone(); }
    phone(app) {
      this.phoneApp = app;
      const w = this.g.world, P = w.P, body = $('#ph-body');
      $('#ph-time').textContent = U.clock(w.time);
      const c = w.contract;
      if (app === 'home') {
        const badge = w.offers.length;
        body.innerHTML = `<div class="ph-wall"><b>${U.clock(w.time)}</b><span>${U.weekday(w.time)} · Tag ${U.day(w.time)} · Krähenburg</span></div>
          <div class="apps">
            <button class="app" data-a="jobs"><i style="background:linear-gradient(135deg,#e0182d,#5a0a12)">🎯</i>Aufträge${badge ? `<span class="badge">${badge}</span>` : ''}</button>
            <button class="app" data-a="map"><i style="background:linear-gradient(135deg,#2b6bd8,#0e2a5a)">🗺️</i>Karte</button>
            <button class="app" data-a="profile"><i style="background:linear-gradient(135deg,#d4a63a,#5a4210)">🕴️</i>Profil${P.sp ? `<span class="badge">${P.sp}</span>` : ''}</button>
            <button class="app" data-a="estate"><i style="background:linear-gradient(135deg,#3d8a4a,#123a1a)">🏠</i>Immobilien</button>
            <button class="app" data-a="msgs"><i style="background:linear-gradient(135deg,#8a4ac8,#2a1240)">💬</i>Nachrichten</button>
            <button class="app" data-a="bank"><i style="background:linear-gradient(135deg,#5fd38d,#14482a)">💰</i>Konto</button>
            <button class="app" data-a="org"><i style="background:linear-gradient(135deg,#e0182d,#1a0507)">♛</i>Organisation</button>
            <button class="app" data-a="props"><i style="background:linear-gradient(135deg,#8b5cf6,#1e1b4b)">🛋️</i>Einrichtung</button>
            <button class="app" data-a="cars"><i style="background:linear-gradient(135deg,#3b82f6,#0f172a)">🚘</i>Car Service</button>
            <button class="app" data-a="inv"><i style="background:linear-gradient(135deg,#6b6f78,#22252b)">🎒</i>Inventar</button>
            <button class="app" data-a="settings"><i style="background:linear-gradient(135deg,#444,#111)">⚙️</i>Optionen</button>
            <button class="app" data-a="help"><i style="background:linear-gradient(135deg,#c98a1e,#4a3008)">❓</i>Hilfe</button>
          </div>
          ${c && c.status === 'active' ? `<div class="card active" style="margin-top:18px"><div class="sub">Aktiver Auftrag</div><h4>${esc(c.name)}</h4><div class="meta"><span>${esc(c.title)}</span><b>${U.money(c.reward)}</b></div></div>` : ''}`;
        this.g.phoneBadge = 0;
      } else if (app === 'jobs') {
        let h = '<div class="ph-h">AUFTRÄGE</div>';
        if (c && c.status === 'active') {
          const cost = Math.round(c.reward * 0.1 / 50) * 50;
          const b0 = w.buildings[c.stops[c.stopI % c.stops.length]];
          h += `<div class="card active"><div class="row"><canvas width="112" height="112" data-p="active"></canvas><div><div class="sub">AKTIV · ${esc(c.client)}</div><h4>${esc(c.name)}</h4><div class="sub">${esc(c.title)}</div></div></div>
            <p>${esc(c.bio)}</p>
            <div>${c.bonuses.map((b) => `<span class="pill red">${esc(b.name)}: ${esc(b.desc)}</span>`).join('')}</div>
            <p><b>Intel:</b> ${c.intel ? `Aktueller Ort: <b>${esc(b0.name)}</b> (${esc(K.DISTRICTS[b0.district] || '')}). Routine: ${c.stops.map((i) => esc(w.buildings[i].name)).join(' → ')}. Leibwächter: ${c.guards}.` : 'Nur grobe Position bekannt (roter Kreis auf der Karte).'}</p>
            <div class="meta"><span>Frist ${Math.floor((c.deadline - w.time) / 60)}h</span><b>${U.money(c.reward)}</b></div>
            <div class="btns">${c.intel ? '' : `<button class="btn" data-x="intel">Intel kaufen ${U.money(cost)}</button>`}<button class="btn ghost" data-x="locate">Auf Karte</button><button class="btn ghost" data-x="abort">Abbrechen</button></div></div>`;
        }
        if (!w.offers.length) h += '<div class="card"><p>Keine neuen Angebote. Die Zentrale meldet sich.</p></div>';
        w.offers.forEach((o, i) => {
          h += `<div class="card"><div class="row"><canvas width="112" height="112" data-p="${i}"></canvas><div><div class="sub">${esc(o.client)} · ${'◆'.repeat(o.diff)}</div><h4>${esc(o.name)}</h4><div class="sub">${esc(o.title)}</div></div></div>
            <p>${esc(o.bio)}</p>
            <div>${o.bonuses.map((b) => `<span class="pill">${esc(b.name)}</span>`).join('')}${o.guards ? `<span class="pill red">${o.guards} Leibwächter</span>` : ''}</div>
            <div class="meta"><span>Frist ${Math.floor((o.deadline - w.time) / 60)}h</span><b>${U.money(o.reward)}</b></div>
            <div class="btns"><button class="btn red" data-acc="${i}" ${c && c.status === 'active' ? 'disabled' : ''}>Annehmen</button></div></div>`;
        });
        body.innerHTML = h;
        body.querySelectorAll('canvas[data-p]').forEach((cv) => K.portrait(cv, cv.dataset.p === 'active' ? c : w.offers[+cv.dataset.p]));
      } else if (app === 'profile') {
        const need = w.xpNeed(P.level);
        let h = `<div class="ph-h">PROFIL · STUFE ${P.level}</div><div class="xpbar"><i style="width:${(P.xp / need) * 100}%"></i></div><div class="sub" style="font-size:11px;color:#999;margin-top:-8px;margin-bottom:10px">${P.xp} / ${need} XP · ${P.sp} Fähigkeitspunkte</div>`;
        for (const k in K.SKILLS) {
          const s = K.SKILLS[k], lv = P.skills[k] || 0;
          h += `<div class="skill"><i>${s.e}</i><div class="sk-n">${s.name}<small>${s.desc}</small></div><div class="pips">${[0, 1, 2, 3, 4].map((n) => `<u class="${n < lv ? 'on' : ''}"></u>`).join('')}</div><button data-sk="${k}" ${P.sp > 0 && lv < 5 ? '' : 'disabled'}>+</button></div>`;
        }
        const S = P.stats;
        const R = P.record || {}, rk = Object.keys(R);
        h += `<div class="ph-h" style="margin-top:16px;font-size:15px">STRAFREGISTER</div>` + (rk.length ? rk.map((k) => `<div class="stat"><span>${K.CRIMES[k] ? K.CRIMES[k].name : k}</span><b>${R[k]}×</b></div>`).join('') : '<div class="stat"><span>Weiße Weste.</span><b>—</b></div>');
        if (P.deal && P.deal.sold) h += `<div class="ph-h" style="margin-top:16px;font-size:15px">GESCHÄFTE</div><div class="stat"><span>Dealer-Ruf</span><b>${P.deal.rep}</b></div><div class="stat"><span>Verkauft</span><b>${P.deal.sold} g</b></div><div class="stat"><span>Pflanzen</span><b>${(P.plants || []).length}</b></div>`;
        h += `<div class="ph-h" style="margin-top:16px;font-size:15px">STATISTIK</div>` + [['Aufträge erfüllt', S.contracts], ['Lautlose Assassinen', S.silent], ['Verdient', U.money(S.earned)], ['Ausgeschaltet', S.kills], ['Kopfschüsse', S.headshots], ['Takedowns', S.takedowns], ['Zivile Opfer', S.civKills], ['Tage in Krähenburg', U.day(w.time)]].map(([a, b]) => `<div class="stat"><span>${a}</span><b>${b}</b></div>`).join('');
        body.innerHTML = h;
      } else if (app === 'estate') {
        let h = '<div class="ph-h">IMMOBILIEN</div>';
        for (const d of K.PROPERTIES) {
          const own = P.owned.includes(d.id), b = w.propertyBuilding(d.id);
          if (!b) continue;
          h += `<div class="card ${own ? 'active' : ''}"><div class="sub">${esc(K.DISTRICTS[b.district] || '')}${d.income ? ` · +${U.money(d.income)}/Tag` : ''}</div><h4>${esc(d.name)}</h4><p>${esc(d.desc)}</p>
            <div class="meta"><span>${own ? (P.home === d.id ? '★ Zuhause' : 'Dein Besitz') : 'Zu verkaufen'}</span><b>${own ? '✔' : U.money(d.price)}</b></div>
            <div class="btns"><button class="btn ghost" data-loc="${d.id}">Wegpunkt</button>${own ? '' : `<button class="btn red" data-buy="${d.id}" ${P.money >= d.price ? '' : 'disabled'}>Kaufen</button>`}</div></div>`;
        }
        body.innerHTML = h;
      } else if (app === 'msgs') {
        const log = this.g.ui.feedLog;
        body.innerHTML = '<div class="ph-h">NACHRICHTEN</div>' + `<div class="msg"><small>Vesna · Zentrale</small>Willkommen zurück in Krähenburg. Deine Bude in der Altstadt steht bereit. Aufträge kommen aufs Handy. Bleib unsichtbar.</div>` + log.slice(0, 40).map((l) => `<div class="msg"><small>${l.t}</small>${esc(l.text)}</div>`).join('');
      } else if (app === 'bank') {
        let inc = 0; for (const id of P.owned) inc += w.propertyDef(id).income || 0;
        body.innerHTML = `<div class="ph-h">KONTO</div><div class="card"><div class="sub">Bargeld</div><h4 style="font-size:30px;color:#9ff0b8">${U.money(P.money)}</h4></div><div class="card"><div class="sub">Konto · Sparkasse</div><h4 style="font-size:26px;color:#7fb7a0">${U.money(P.bank || 0)}</h4><p>Ein- und Auszahlen am Geldautomaten.</p></div>
          <div class="card"><div class="sub">Passives Einkommen</div><h4>${U.money(inc)} / Tag</h4><p>Zahlt jeden Morgen um 08:00 aus.</p></div>
          <div class="card"><div class="sub">Verdient mit Aufträgen</div><h4>${U.money(P.stats.earned)}</h4></div>`;
      } else if (app === 'props') { this.propsApp(body); return; }
      else if (app === 'org' || app.startsWith('org:')) { this.orgApp(body, app.split(':')[1] || 'home'); return; }
      else if (app === 'cars' || app.startsWith('cars:')) { this.carApp(body, app.split(':')[1] || 'start'); return; }
      else if (app === 'map') { this.closePhone(); this.openMap(); return; }
      else if (app === 'inv') { this.closePhone(); this.inventory(); return; }
      else if (app === 'settings') { this.closePhone(); this.settings(); return; }
      else if (app === 'help') { this.closePhone(); this.controls(); return; }
      body.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => { this.g.audio.ui('click'); this.phone(b.dataset.a); }));
      body.querySelectorAll('[data-acc]').forEach((b) => (b.onclick = () => { w.acceptContract(w.offers[+b.dataset.acc]); this.phone('jobs'); }));
      body.querySelectorAll('[data-x]').forEach((b) => (b.onclick = () => {
        const x = b.dataset.x;
        if (x === 'intel') w.buyIntel();
        if (x === 'abort') w.abortContract();
        if (x === 'locate') { const t = w.targetActor(); if (t) this.g.waypoint = c.intel ? { x: t.x, y: t.y } : { ...c.ping }; this.closePhone(); this.openMap(); return; }
        this.phone('jobs');
      }));
      body.querySelectorAll('[data-sk]').forEach((b) => (b.onclick = () => { w.learn(b.dataset.sk); this.phone('profile'); }));
      body.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => { if (w.buyProperty(b.dataset.buy)) this.g.save(true); this.phone('estate'); }));
      body.querySelectorAll('[data-loc]').forEach((b) => (b.onclick = () => { const bb = w.propertyBuilding(b.dataset.loc); this.g.waypoint = { x: (bb.entrance.x + 0.5) * TILE, y: (bb.entrance.y + 0.5) * TILE }; this.g.ui.feed('Wegpunkt gesetzt.'); }));
    }

    // ============================================================ panels
    panel(title, html, kind) {
      this.closePhone();
      this.panelKind = kind;
      $('#pn-title').textContent = title;
      $('#pn-body').innerHTML = html;
      $('#panel').classList.remove('hidden');
      this.sync();
      return $('#pn-body');
    }
    closePanel() { if (this.tunePrev) { this.tunePrev.undo(); this.tunePrev = null; } $('#panel').classList.add('hidden'); this.panelKind = null; this.sync(); }
    openFromWorld(e) {
      if (e.open === 'shop') this.shop(e.shop, e.b);
      else if (e.open === 'stash') this.stash(e.prop);
      else if (e.open === 'wardrobe') this.wardrobe();
      else if (e.open === 'sleep') this.sleep(e.prop);
      else if (e.open === 'property') this.property(e.id);
      else if (e.open === 'bank') this.bank();
      else if (e.open === 'recruit') this.recruit();
      else if (e.open === 'crew') this.crew();
      else if (e.open === 'tag') this.tagEditor();
      else if (e.open === 'dealer') this.dealer(e.kind);
      else if (e.open === 'tuning') this.tuning(e.car);
      else if (e.open === 'container') this.container(e.uid);
      else if (e.open === 'corner') this.corner(e.uid);
      else if (e.open === 'station') this.station(e.uid);
    }

    // ============================================================ cars
    /** draw a car big into a canvas (preview), optionally with a fake override */
    carPreview(cv, car, o = {}) {
      const x = cv.getContext('2d'), S = cv.width, H = cv.height;
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, S, H);
      const g = x.createRadialGradient(S / 2, H / 2, 10, S / 2, H / 2, S * 0.7); g.addColorStop(0, '#2a2d34'); g.addColorStop(1, '#0d0e12');
      x.fillStyle = g; x.fillRect(0, 0, S, H);
      x.strokeStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < S; i += 24) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
      const k = o.scale || Math.min(S / (car.l + 30), H / (car.w + 40)) * 0.95;
      x.save(); x.translate(S / 2, H / 2); x.scale(k, k);
      K.drawCar(x, { ...car, x: 0, y: 0, a: o.a != null ? o.a : 0, steer: 0, brake: 0, lightsOn: true }, this.g.renderer ? this.g.renderer.time : 0, { sx: 4, sy: 6, preview: true });
      x.restore();
    }
    carStats(kind, tune) {
      const d = K.CARK[kind], m = K.CARMODELS[kind];
      const fake = { kind, tune: tune || {}, eng: 100, temp: 85, tires: [100, 100, 100, 100], engineOn: true, fuel: 50 };
      const mods = this.g.world.carMods(fake);
      const top = Math.round(d.max * mods.max * K.KMH), acc = d.acc * mods.acc, grip = mods.grip;
      const bar = (name, v, max, txt) => `<div class="sk"><span>${name}</span><i><b style="width:${Math.min(100, v / max * 100)}%;background:#f59e0b"></b></i><em>${txt}</em></div>`;
      return `<div class="skills carstats">${bar('Spitze', top, 260, top + ' km/h')}${bar('Beschl.', acc, 900, Math.round(acc))}${bar('Handling', grip, 1.5, grip.toFixed(2))}${bar('Bremsen', mods.brake, 1.6, '×' + mods.brake.toFixed(1))}${bar('Verbrauch', K.CARCLS[m.cls].fuel, 0.4, m.cls === 'ev' ? 'elektrisch' : K.CARCLS[m.cls].fuel.toFixed(2) + '%/s')}</div>`;
    }
    dealer(sel) {
      const w = this.g.world, list = Object.entries(K.CARMODELS).filter(([, m]) => !m.hidden).sort((a, b) => a[1].price - b[1].price);
      sel = sel && K.CARMODELS[sel] ? sel : this.dealerSel || list[0][0]; this.dealerSel = sel;
      const M = K.CARMODELS[sel], cols = K.CARK[sel].colors.concat(['#111214', '#e6e6e0', '#c8102e', '#1f3b63', '#a9b0b8']).filter((c, i, a) => a.indexOf(c) === i);
      this.dealerCol = cols.includes(this.dealerCol) ? this.dealerCol : cols[0];
      const owned = w.ownedCars().filter((r) => r.kind === sel).length;
      const h = `<div class="dealer"><div class="dl-list">${list.map(([k, m]) => `<button class="dl-it ${k === sel ? 'on' : ''}" data-car="${k}"><b>${esc(m.name)}</b><small>${U.money(m.price)} · ${esc(K.CARCLS[m.cls] ? m.cls : '')}</small></button>`).join('')}</div>
        <div class="dl-main"><canvas id="dl-cv" width="560" height="260"></canvas>
          <h3>${esc(M.name)} <small>${esc(M.cls.toUpperCase())}</small></h3><p>${esc(M.desc || '')}</p>${this.carStats(sel)}
          <div class="sub">Farbe ab Werk</div><div class="sw">${cols.map((c) => `<i data-col="${c}" class="${c === this.dealerCol ? 'on' : ''}" style="background:${c}"></i>`).join('')}</div>
          <div class="btns"><button class="btn" id="dl-buy">Kaufen · ${U.money(M.price)}</button>${owned ? `<span class="tag">${owned}× in deinem Besitz</span>` : ''}</div>
          <p style="color:#888;font-size:12px">Bezahlt wird bar oder per Karte. Der Wagen steht danach vor dem Autohaus. Tuning gibt's in der Werkstatt „Schraubstock“, Lieferung per Car-Service-App.</p></div></div>`;
      const body = this.panel('AUTOHAUS KRÄHENBURG', h, 'dealer');
      const draw = () => this.carPreview(body.querySelector('#dl-cv'), { kind: sel, l: K.CARK[sel].l, w: K.CARK[sel].w, color: this.dealerCol, tune: {}, hp: 100 });
      draw();
      body.querySelectorAll('[data-car]').forEach((b) => (b.onclick = () => this.dealer(b.dataset.car)));
      body.querySelectorAll('[data-col]').forEach((b) => (b.onclick = () => { this.dealerCol = b.dataset.col; body.querySelectorAll('[data-col]').forEach((q) => q.classList.toggle('on', q === b)); draw(); }));
      body.querySelector('#dl-buy').onclick = () => { if (w.buyCar(sel, this.dealerCol)) { this.closePanel(); this.g.save(true); } };
    }
    tuning(carId, cat, prev) {
      const w = this.g.world, c = w.cars.find((q) => q.id === carId);
      if (!c) return this.closePanel();
      // revert an unbought preview when navigating
      if (this.tunePrev && this.tunePrev.car === carId && !prev) { this.tunePrev.undo(); this.tunePrev = null; }
      cat = cat || this.tuneCat || 'perf'; this.tuneCat = cat;
      const G = K.TUNING.find((g) => g.cat === cat), q = w.repairQuote(c), M = K.carModel(c);
      const cur = (part) => part.id === 'color' ? c.color : (c.tune || {})[part.id] || 0;
      let h = `<div class="tune"><div class="tn-left"><canvas id="tn-cv" width="420" height="230"></canvas>
          <h3>${esc(M.name)} <small>${esc(c.plate || '')}</small></h3>${this.carStats(c.kind, c.tune)}
          <div class="card tn-rep">${q ? `<b>🔧 Reparatur</b><p>Motor ${Math.round(c.eng)}% · Karosserie ${Math.round(c.bodyHP)}% · Reifen ${c.tires.filter((t) => t < 20).length ? c.tires.filter((t) => t < 20).length + ' platt' : 'ok'}</p><button class="btn" id="tn-rep" ${w.repairJob ? 'disabled' : ''}>${w.repairJob ? 'Wird repariert…' : `Reparieren · ${U.money(q.price)} · ~${Math.round(q.dur)} s`}</button>` : '<b>🔧 Kein Schaden</b><p>Der Wagen ist in Schuss.</p>'}</div></div>
        <div class="tn-right"><div class="tn-cats">${K.TUNING.map((g) => `<button class="${g.cat === cat ? 'on' : ''}" data-cat="${g.cat}" style="--c:${g.col}">${g.icon} ${g.name}</button>`).join('')}</div>`;
      for (const part of G.parts) {
        h += `<div class="tn-part"><div class="sub">${esc(part.name)}${part.desc ? ` <small>· ${esc(part.desc)}</small>` : ''}</div><div class="tn-opts">`;
        part.opts.forEach((o, i) => {
          const on = cur(part) === o.v || (part.id === 'color' && c.color === o.v);
          const sw = typeof o.v === 'string' && o.v[0] === '#' ? `<i style="background:${o.v}"></i>` : '';
          const pv = this.tunePrev && this.tunePrev.part === part.id && this.tunePrev.i === i;
          h += `<button class="tn-o ${on ? 'cur' : ''} ${pv ? 'pv' : ''}" data-part="${part.id}" data-i="${i}">${sw}${esc(o.name)}${on ? ' ✓' : `<small>${U.money(K.tunePrice(c, part, o))}</small>`}</button>`;
        });
        h += '</div></div>';
      }
      h += `</div></div>${this.tunePrev ? `<div class="tn-buy"><span>Vorschau: <b>${esc(this.tunePrev.label)}</b></span><button class="btn" id="tn-ok">✅ Kaufen · ${U.money(this.tunePrev.price)}</button><button class="btn ghost" id="tn-no">❌ Abbrechen</button></div>` : ''}`;
      const body = this.panel('WERKSTATT „SCHRAUBSTOCK“', h, 'tuning');
      this.carPreview(body.querySelector('#tn-cv'), c);
      body.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => this.tuning(carId, b.dataset.cat)));
      const rep = body.querySelector('#tn-rep'); if (rep) rep.onclick = () => { if (w.startRepair(c)) { this.closePanel(); } };
      body.querySelectorAll('[data-part]').forEach((b) => (b.onclick = () => {
        const part = G.parts.find((p) => p.id === b.dataset.part), o = part.opts[+b.dataset.i];
        if (cur(part) === o.v) return;
        if (this.tunePrev) this.tunePrev.undo();
        const snap = { color: c.color, tune: { ...c.tune }, nos: c.nos };
        w.applyTune(c, part.id, o);
        this.tunePrev = { car: carId, part: part.id, i: +b.dataset.i, label: `${part.name}: ${o.name}`, price: K.tunePrice(c, part, o), undo: () => { c.color = snap.color; c.tune = snap.tune; c.nos = snap.nos; } };
        this.tuning(carId, cat, true);
      }));
      const ok = body.querySelector('#tn-ok');
      if (ok) ok.onclick = () => { const t = this.tunePrev; t.undo(); this.tunePrev = null; w.buyTune(c, t.part, G.parts.find((p) => p.id === t.part).opts[t.i]); this.tuning(carId, cat, true); };
      const no = body.querySelector('#tn-no');
      if (no) no.onclick = () => { this.tunePrev.undo(); this.tunePrev = null; this.tuning(carId, cat, true); };
    }
    /** the Car Service phone app (rde_carservice) */
    carApp(body, tab) {
      const w = this.g.world, R = w.ownedCars(), s = w.svc && w.svc.stage !== 'done' ? w.svc : null;
      this.phoneApp = 'cars:' + tab;
      const tabs = `<div class="cs-tabs">${[['start', 'Start'], ['garage', 'Garage'], ['pickup', 'Abholen']].map(([k, n]) => `<button class="${k === tab ? 'on' : ''}" data-ct="${k}">${n}</button>`).join('')}</div>`;
      let h = `<div class="cs"><div class="cs-head"><b>🚘 KRÄHENBURG CAR SERVICE</b><small>Premium-Lieferung & Abholung</small></div>${tabs}`;
      if (tab === 'start') {
        h += s ? `<div class="cs-card blue"><b>${s.kind === 'deliver' ? 'Lieferung läuft' : 'Abholung läuft'}</b><p>${{ driving: `Fahrer unterwegs · Ankunft in ~${w.serviceEta()} s`, parking: 'Fahrer parkt…', handover: 'Fahrer bringt dir die Schlüssel', walking: 'Fahrer läuft zu deinem Auto', leaving: 'Fahrer bringt den Wagen in die Garage' }[s.stage] || ''}</p><button class="btn red" data-cs="cancel">Service stornieren</button></div>`
          : '<div class="cs-card"><b>Kein aktiver Auftrag</b><p>Dein Wagen kommt zu dir — oder wir parken ihn sicher in der Garage.</p></div>';
        h += `<div class="cs-card"><b>Preise</b><div class="stat"><span>Lieferung</span><b style="color:#3b82f6">${U.money(K.SERVICE.deliver)}</b></div><div class="stat"><span>Abholung</span><b style="color:#10b981">${U.money(K.SERVICE.pickup)}</b></div><div class="stat"><span>Versicherung (Totalschaden)</span><b>${Math.round(K.SERVICE.insure * 100)}% vom Neupreis</b></div></div>`;
      } else if (tab === 'garage') {
        if (!R.length) h += '<div class="cs-card"><p>Du besitzt noch kein Auto. Autohaus Krähenburg, Mitte.</p></div>';
        for (const r of R) {
          const st = { stored: 'In der Garage', out: 'Geparkt in der Stadt', destroyed: 'Totalschaden' }[r.state] || r.state;
          h += `<div class="cs-car"><div><b>${esc(r.name)}</b><small>${esc(r.plate)} · ${st}${r.state !== 'destroyed' ? ` · ⛽ ${Math.round(r.fuel != null ? r.fuel : 100)}%` : ''}</small></div>
            ${r.state === 'stored' ? `<button class="btn" data-cs="deliver" data-id="${r.id}" ${s ? 'disabled' : ''}>Liefern · ${U.money(K.SERVICE.deliver)}</button>` : r.state === 'destroyed' ? `<button class="btn ghost" data-cs="insure" data-id="${r.id}">Versicherung · ${U.money(Math.round(K.CARMODELS[r.kind].price * K.SERVICE.insure / 10) * 10)}</button>` : `<button class="btn ghost" data-cs="locate" data-id="${r.id}">Orten</button>`}</div>`;
        }
      } else {
        h += `<div class="cs-card green"><b>Auto abholen lassen</b><p>Ein Fahrer holt dein nächstes geparktes Auto (bis ca. 25 m Umkreis) und bringt es sicher in die Garage.</p><button class="btn" data-cs="pickup" ${s ? 'disabled' : ''}>Fahrzeug einlagern · ${U.money(K.SERVICE.pickup)}</button></div>`;
      }
      body.innerHTML = h + '</div>';
      body.querySelectorAll('[data-ct]').forEach((b) => (b.onclick = () => this.carApp(body, b.dataset.ct)));
      body.querySelectorAll('[data-cs]').forEach((b) => (b.onclick = () => {
        const a = b.dataset.cs, id = +b.dataset.id;
        if (a === 'deliver') w.serviceDeliver(id); else if (a === 'pickup') w.servicePickup(); else if (a === 'cancel') w.serviceCancel(); else if (a === 'insure') w.insureCar(id);
        else if (a === 'locate') { const r = R.find((q) => q.id === id), c = r && w.worldCarOf(r); if (c) { this.g.waypoint = { x: c.x, y: c.y }; this.g.ui.feed('Wegpunkt zu deinem Auto gesetzt.'); } }
        this.carApp(body, a === 'deliver' || a === 'pickup' ? 'start' : tab);
      }));
    }
    gangSection() {
      const w = this.g.world, P = w.P, G = K.GANGS;
      if (!P.gang) return `<div class="sec">Gang & Revier</div><div class="card"><p>Du hast noch keine eigene Gang. Gründe eine (${U.money(K.GANG_FOUND_FEE)}), zeichne dein Tag und sprüh es auf Tag-Spots, um Blöcke zu übernehmen. Jeder Block bringt ${U.money(K.TURF_INCOME)}/Tag, Dealen im eigenen Revier +25%.</p><div class="btns"><button class="btn" data-gang="found">Gang gründen…</button></div></div>`;
      let h = `<div class="sec">Gang & Revier <small>Tag-Spots sind auf der Karte als Blöcke eingefärbt</small></div><div class="card gangcard"><div class="gangtag" style="border-color:${P.gang.col}">${P.gang.tag ? `<img src="${P.gang.tag}">` : `<b style="color:${P.gang.col}">${esc(P.gang.name)}</b>`}</div><div><h4 style="color:${P.gang.col}">${esc(P.gang.name)}</h4><p>${w.playerBlocks()} Blöcke · +${U.money(w.playerBlocks() * K.TURF_INCOME)}/Tag · 🎨 ${P.inv.spray || 0} Sprühdosen</p><div class="btns"><button class="btn ghost" data-gang="tag">Tag neu zeichnen</button></div></div></div><div class="ganglist">`;
      for (const [k, g] of Object.entries(G)) {
        const war = P.wars[k], n = w.gangBlocks(k);
        h += `<div class="card ganrow" style="border-left:4px solid ${g.col}"><b style="color:${g.col}">${g.name}</b><span>${n} Blöcke</span><span>${war ? '<b style="color:#ff3b4e">⚔ KRIEG</b>' : 'Frieden'}</span>${n === 0 ? '<span style="color:#888">zerschlagen</span>' : war ? `<button class="btn ghost" data-peace="${k}">Frieden kaufen · ${U.money(w.peacePrice(k))}</button>` : `<button class="btn red" data-war="${k}">Krieg erklären</button>`}</div>`;
      }
      return h + '</div>';
    }
    bindGang(body, again) {
      const w = this.g.world;
      body.querySelectorAll('[data-gang]').forEach((b) => (b.onclick = () => this.tagEditor(b.dataset.gang === 'found')));
      body.querySelectorAll('[data-war]').forEach((b) => (b.onclick = () => { if (b.dataset.sure) { w.declareWar(b.dataset.war); again(); } else { b.dataset.sure = 1; b.textContent = 'Wirklich? Die schießen.'; } }));
      body.querySelectorAll('[data-peace]').forEach((b) => (b.onclick = () => { w.makePeace(b.dataset.peace); again(); }));
    }
    /** freehand tag editor: caps, colours, undo — the result is stored as a PNG */
    tagEditor(found) {
      const w = this.g.world, P = w.P;
      const cols = ['#c8102e', '#ff6a00', '#f2c14e', '#3ddc84', '#1fb5ff', '#a855f7', '#ff4fd8', '#f4f4f4', '#111111'];
      const caps = [['Skinny', 2, 0], ['Soft', 5, 4], ['NY', 8, 0], ['Standard', 12, 1], ['Fat', 20, 8], ['Ultra Fat', 32, 12]];
      const g = P.gang || { name: '', col: '#c8102e' };
      const h = `<div class="tagwrap"><div class="tagside">
        <label>Name<input id="tg-name" maxlength="24" value="${esc(g.name)}" placeholder="z. B. Rote Drachen"></label>
        <div class="sub">Gangfarbe</div><div class="sw" id="tg-gcol">${cols.slice(0, 7).map((c) => `<i data-gc="${c}" style="background:${c}" class="${c === g.col ? 'on' : ''}"></i>`).join('')}</div>
        <div class="sub">Sprühfarbe</div><div class="sw" id="tg-col">${cols.map((c, i) => `<i data-c="${c}" style="background:${c}" class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
        <div class="sub">Cap</div><div class="caps">${caps.map(([n, wd, bl], i) => `<button class="btn ghost ${i === 3 ? 'on' : ''}" data-cap="${i}">${n}</button>`).join('')}</div>
        <div class="btns"><button class="btn ghost" id="tg-undo">↶ Rückgängig [Z]</button><button class="btn ghost" id="tg-clear">Leeren</button></div>
        <button class="btn" id="tg-save">${P.gang ? 'Speichern' : 'Gang gründen · ' + U.money(K.GANG_FOUND_FEE)}</button>
      </div><canvas id="tg-cv" width="384" height="128"></canvas></div><p style="color:#888;font-size:12px">Mal mit der Maus. Dein Tag erscheint auf jedem Tag-Spot, den du besprühst — und auf der Karte in deiner Gangfarbe.</p>`;
      const body = this.panel(P.gang ? 'TAG ZEICHNEN' : 'GANG GRÜNDEN', h, 'tag');
      const cv = body.querySelector('#tg-cv'), x = cv.getContext('2d');
      const strokes = []; let cur = null, col = cols[0], cap = caps[3], gcol = g.col;
      this.tagBase = null;
      if (P.gang && P.gang.tag) { const im = new Image(); im.onload = () => { this.tagBase = im; full(); }; im.src = P.gang.tag; }
      const base = () => { if (this.tagBase && P.gang && P.gang.tag) x.drawImage(this.tagBase, 0, 0, cv.width, cv.height); };
      const full = () => { x.clearRect(0, 0, cv.width, cv.height); base(); const ss = strokes; x.lineCap = 'round'; x.lineJoin = 'round'; for (const s of ss.concat(cur ? [cur] : [])) { x.strokeStyle = s.col; x.lineWidth = s.w; x.shadowColor = s.col; x.shadowBlur = s.bl; x.beginPath(); s.pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); if (s.pts.length === 1) x.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]); x.stroke(); } x.shadowBlur = 0; };
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * cv.width, (e.clientY - r.top) / r.height * cv.height]; };
      cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); cur = { col, w: cap[1], bl: cap[2], pts: [pos(e)] }; full(); };
      cv.onpointermove = (e) => { if (!cur) return; cur.pts.push(pos(e)); full(); };
      cv.onpointerup = () => { if (cur) strokes.push(cur); cur = null; full(); };
      const undo = () => { strokes.pop(); full(); };
      body.querySelector('#tg-undo').onclick = undo;
      body.querySelector('#tg-clear').onclick = () => { strokes.length = 0; this.tagBase = null; full(); };
      this.tagKeys = (e) => { if (e.key.toLowerCase() === 'z' && document.activeElement.id !== 'tg-name') { e.stopPropagation(); undo(); } };
      body.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { col = b.dataset.c; body.querySelectorAll('[data-c]').forEach((q) => q.classList.toggle('on', q === b)); }));
      body.querySelectorAll('[data-gc]').forEach((b) => (b.onclick = () => { gcol = b.dataset.gc; body.querySelectorAll('[data-gc]').forEach((q) => q.classList.toggle('on', q === b)); }));
      body.querySelectorAll('[data-cap]').forEach((b) => (b.onclick = () => { cap = caps[+b.dataset.cap]; body.querySelectorAll('[data-cap]').forEach((q) => q.classList.toggle('on', q === b)); }));
      body.querySelector('#tg-save').onclick = () => {
        const name = body.querySelector('#tg-name').value.trim() || 'Rote Drachen';
        const empty = !strokes.length && !(this.tagBase && P.gang && P.gang.tag);
        const png = empty ? null : cv.toDataURL('image/png');
        if (w.foundGang(name, gcol, png)) { this.g.save(true); this.crew(); }
      };
    }
    crewCard(m, buttons) {
      const C = K.CREW, rar = C.rarities.find((x) => x.key === m.rarity) || C.rarities[0];
      const bars = Object.entries(C.skills).map(([k, n]) => `<div class="sk"><span>${n}</span><i><b style="width:${m.skills[k]}%;background:${rar.col}"></b></i><em>${m.skills[k]}</em></div>`).join('');
      let meta = `<div class="sub" style="color:${rar.col}">${rar.name} · ${C.pers[m.pers].name}</div>`;
      if (m.level) {
        const t = C.tiers[K.crewTier(m)], mo = K.crewMorale(m);
        const st = m.state === 'active' ? '🟢 im Einsatz' : m.state === 'down' ? `🏥 Klinik (bis ${U.clock(m.downUntil)})` : '⚪ bereit';
        meta += `<div class="crewmeta"><span>Stufe ${m.level}</span><span style="color:${t.col}">♥ ${t.name}</span><span style="color:${mo.col}">${mo.name} (${Math.round(m.morale)})</span><span>${st}</span><span>☠ ${m.kills}</span><span>🩹 ${m.kits}</span><span>${esc(W8[m.weapon] ? W8[m.weapon].name : m.weapon)}</span><span>Lohn ${U.money(m.wage)}/Tag</span></div>`;
      } else meta += `<div class="crewmeta"><span>${esc(W8[m.weapon].name)}</span><span>Lohn ${U.money(m.wage)}/Tag</span></div>`;
      return `<div class="card crewcard" style="border-color:${rar.col}55"><canvas class="crewpic" data-pic="${m.id || 'o' + m.name}" width="96" height="96"></canvas><div class="cbody"><h4>${esc(m.name)}</h4>${meta}<div class="skills">${bars}</div><div class="btns">${buttons}</div></div></div>`;
    }
    drawCrewPics(body, list) {
      body.querySelectorAll('canvas.crewpic').forEach((cv, i) => {
        const m = list[i]; if (!m || !K.portrait) return;
        try { K.portrait(cv, { outfit: m.outfit, skin: m.skin, hair: m.hair, female: m.female }); } catch (e) { /* portrait is cosmetic */ }
      });
    }
    recruit() {
      const w = this.g.world, P = w.P, offers = w.crewOffers(), R = w.crewRoster();
      let h = `<p class="lead">„Gute Leute kosten. Die besten noch mehr. Jeden Tag hab ich drei neue Gesichter.“ — Kralle</p><div class="sec">Heute verfügbar</div><div class="crewgrid">`;
      offers.forEach((c, i) => { h += this.crewCard(c, c.hired ? '<span class="tag">Vergeben</span>' : `<button class="btn" data-hire="${i}">Anheuern · ${U.money(c.price)}</button>`); });
      h += `</div><div class="sec">Deine Crew <small>${R.length}/${K.CREW.maxOwned} · max. ${K.CREW.maxActive} gleichzeitig · Lohn wird täglich fällig</small></div><div class="crewgrid">`;
      R.forEach((m) => { h += this.crewCard(m, this.rosterButtons(m)); });
      if (!R.length) h += '<p style="color:#888">Noch niemand. Allein ist man schnell tot.</p>';
      h += '</div>' + this.gangSection();
      const body = this.panel('CREW ANHEUERN', h, 'recruit');
      this.drawCrewPics(body, [...offers, ...R]);
      body.querySelectorAll('[data-hire]').forEach((b) => (b.onclick = () => { w.hireCrew(+b.dataset.hire); this.recruit(); }));
      this.bindRoster(body, () => this.recruit());
      this.bindGang(body, () => this.recruit());
    }
    rosterButtons(m) {
      if (m.state === 'down') return `<button class="btn" data-rev="${m.id}">Sofort entlassen · ${U.money(this.g.world.crewHospitalFee(m))}</button><button class="btn ghost" data-fire="${m.id}">Rauswerfen</button>`;
      return (m.state === 'active' ? `<button class="btn ghost" data-home="${m.id}">Heimschicken</button><button class="btn ghost" data-give="${m.id}">Aktuelle Waffe geben</button>` : `<button class="btn" data-call="${m.id}">Rufen</button>`) + `<button class="btn ghost" data-fire="${m.id}">Rauswerfen</button>`;
    }
    bindRoster(body, again) {
      const w = this.g.world;
      body.querySelectorAll('[data-call]').forEach((b) => (b.onclick = () => { w.callCrew(+b.dataset.call); again(); }));
      body.querySelectorAll('[data-home]').forEach((b) => (b.onclick = () => { w.sendHome(+b.dataset.home); again(); }));
      body.querySelectorAll('[data-give]').forEach((b) => (b.onclick = () => { w.crewCommand('give', +b.dataset.give); again(); }));
      body.querySelectorAll('[data-rev]').forEach((b) => (b.onclick = () => { w.crewRevive(+b.dataset.rev); again(); }));
      body.querySelectorAll('[data-fire]').forEach((b) => (b.onclick = () => { if (b.dataset.sure) { w.fireCrew(+b.dataset.fire); again(); } else { b.dataset.sure = 1; b.textContent = 'Sicher?'; } }));
    }
    crew() {
      const w = this.g.world, P = w.P, R = w.crewRoster(), C = K.CREW;
      const form = P.crewForm || 'follow', stance = P.crewStance || 'defensive', mode = P.crewMode || 'follow';
      const cmd = (c, label, on, arg) => `<button class="btn ${on ? '' : 'ghost'}" data-cmd="${c}"${arg ? ` data-arg="${arg}"` : ''}>${label}</button>`;
      let h = this.gangSection() + `<div class="sec">Befehle <small>[V] im Spiel: Ziel unterm Fadenkreuz angreifen</small></div><div class="btns cmdrow">
        ${cmd('follow', '🚶 Folgen', mode === 'follow')}${cmd('stay', '🛑 Position halten', mode === 'stay')}${cmd('formation', '◇ Formation: ' + C.formations[form].name, true)}
        ${cmd('attackAll', '⚔ Alles angreifen')}${cmd('heal', '🩹 Mich verarzten')}${cmd('holster', P.crewHolster ? '🔫 Waffen ziehen' : '✋ Waffen weg')}${cmd('dismissAll', '🏠 Alle heimschicken')}</div>
        <div class="sec">Haltung</div><div class="btns cmdrow">${Object.entries(C.stances).map(([k, n]) => cmd('stance', n, stance === k, k)).join('')}</div>
        <p style="color:#888;font-size:12px">Friedlich: wehren sich nur. Defensiv: schützen dich vor allem, was dich angreift. Aggressiv: gehen auch auf Gangs und Räuber los.</p>
        <div class="sec">Crew <small>Neue Leute gibt es beim Vermittler in der Bar „Blauer Engel“</small></div><div class="crewgrid">`;
      R.forEach((m) => { h += this.crewCard(m, this.rosterButtons(m)); });
      if (!R.length) h += '<p style="color:#888">Du hast noch keine Crew. Sprich mit Kralle in der Bar „Blauer Engel“.</p>';
      h += '</div>';
      const body = this.panel('CREW', h, 'crew');
      this.drawCrewPics(body, R);
      body.querySelectorAll('[data-cmd]').forEach((b) => (b.onclick = () => { w.crewCommand(b.dataset.cmd, b.dataset.arg); this.crew(); }));
      this.bindRoster(body, () => this.crew());
      this.bindGang(body, () => this.crew());
    }
    bank() {
      const w = this.g.world, P = w.P;
      const h = `<div class="cols"><div class="card"><div class="sub">Bargeld</div><h4 style="font-size:30px;color:#9ff0b8">${U.money(P.money)}</h4><p>Bargeld verlierst du beim Tod (15%). Schwarzmarkt und Dealer nehmen nur Bares.</p>
        <div class="btns"><button class="btn" data-dep="100">+100 einzahlen</button><button class="btn" data-dep="1000">+1.000</button><button class="btn red" data-dep="1e12">Alles einzahlen</button></div></div>
        <div class="card"><div class="sub">Konto · Krähenburger Sparkasse</div><h4 style="font-size:30px;color:#7fb7a0">${U.money(P.bank || 0)}</h4><p>Auftragshonorare und Geschäftseinnahmen landen hier. Legale Läden nehmen Karte.</p>
        <div class="btns"><button class="btn" data-wd="100">100 abheben</button><button class="btn" data-wd="1000">1.000</button><button class="btn" data-wd="5000">5.000</button><button class="btn ghost" data-wd="1e12">Alles</button></div></div></div>`;
      const b = this.panel('GELDAUTOMAT', h, 'bank');
      b.querySelectorAll('[data-dep]').forEach((x) => (x.onclick = () => { w.bankDeposit(+x.dataset.dep); this.bank(); }));
      b.querySelectorAll('[data-wd]').forEach((x) => (x.onclick = () => { w.bankWithdraw(+x.dataset.wd); this.bank(); }));
    }
    showJail(e) {
      const el = $('#dead');
      const h = Math.floor(e.min / 60), m = e.min % 60;
      el.innerHTML = `<div class="res-box"><div class="k">AMTSGERICHT KRÄHENBURG · SCHNELLVERFAHREN</div><h1 style="color:#ff9a4a">${h}h ${String(m).padStart(2, '0')}m HAFT</h1><h3>${e.surrendered ? 'Geständig und kooperativ — 30% Strafnachlass' : 'Festgenommen'}</h3>
        ${e.charges.map((c, i) => `<div class="ln" style="animation-delay:${0.2 + i * 0.15}s"><span>${esc(c.name)}${c.n > 1 ? ' ×' + c.n : ''}</span><b>${Math.round(c.min / 6) / 10}h</b></div>`).join('')}
        ${e.lost.length ? `<div class="ln" style="animation-delay:${0.3 + e.charges.length * 0.15}s"><span>Beschlagnahmt</span><b style="font-size:12px;max-width:60%;text-align:right">${esc(e.lost.join(', '))}</b></div>` : ''}
        <div class="tot" style="color:#ff9a4a"><span>KAUTION</span><span>${U.money(e.bail)}</span></div>
        <p style="color:#999;font-size:12px">In der Zelle läuft die Zeit 14× schneller. Zahl die Kaution mit <b>K</b> oder knack die Zellentür mit <b>E</b>, wenn kein Wärter hinsieht.</p>
        <div class="btns" style="justify-content:center;margin-top:12px"><button class="btn" id="dead-ok">In die Zelle</button></div></div>`;
      el.classList.remove('hidden'); this.sync();
      el.querySelector('#dead-ok').onclick = () => { el.classList.add('hidden'); this.sync(); this.g.fadeIn(); };
    }
    inventory() {
      const w = this.g.world, P = w.P, hb = w.hotbar();
      const wl = w.carried(), lim = w.weightLimit();
      const tile = (t, id, extra, sub) => {
        const inHb = hb.findIndex((e) => e && e.t === t && e.id === id);
        return `<div class="tile ${this.invSel && this.invSel.t === t && this.invSel.id === id ? 'sel' : ''}" data-drag="${t}" data-t="${t}" data-id="${id}" title="${esc(t === 'w' ? W8[id].name : K.ITEMS[id].name)}">${K.slotIcon(t, id)}${extra ? `<b>${extra}</b>` : ''}${inHb >= 0 ? `<u>${inHb + 1}</u>` : ''}<small>${esc(sub)}</small></div>`;
      };
      let h = `<div class="inv2"><div class="inv-left"><div class="sec">Waffen <small>in die Hotbar ziehen</small></div><div class="tiles">`;
      for (const x of P.weapons) {
        if (x.id === 'fists') continue;
        const d = W8[x.id];
        h += tile('w', x.id, d.type === 'gun' ? `${x.mag}` : x.n > 1 ? `×${x.n}` : '', d.name);
      }
      h += `</div><div class="sec" style="margin-top:12px">Gegenstände <small>${wl.toFixed(1)} / ${lim} kg</small></div><div class="tiles">`;
      const keys = Object.keys(P.inv);
      if (!keys.length) h += '<p style="color:#888">Leer.</p>';
      for (const k of keys) h += tile('i', k, `×${P.inv[k]}`, K.ITEMS[k].name);
      h += `</div><div class="sec" style="margin-top:12px">Munition</div><div class="ammo">`;
      const cals = Object.keys(P.ammo).filter((k) => P.ammo[k] > 0);
      h += cals.length ? cals.map((k) => `<span>${K.AMMO[k].name} <b>${P.ammo[k]}</b></span>`).join('') : '<span>Keine Munition.</span>';
      h += `</div></div><div class="inv-right"><div class="sec">Details</div><div id="inv-det" class="card">${this.invDetails(w)}</div>
        <div class="sec">Outfit & Status</div><div class="stat"><span>${esc(K.OUTFITS[P.outfit].name)}</span><b>${K.OUTFITS[P.outfit].disguise ? 'Verkleidung' : 'Zivil'}</b></div>
        <div class="stat"><span>Gesundheit</span><b>${Math.ceil(w.player.hp)} / ${w.maxHp()}</b></div><div class="stat"><span>Hunger · Durst · Energie</span><b>${Math.round(P.hunger)}% · ${Math.round(P.thirst)}% · ${Math.round(P.energy)}%</b></div><div class="stat"><span>Weste</span><b>${Math.round(w.player.armor)}%</b></div></div></div>
        <div class="sec" style="margin-top:12px">Hotbar <small>ziehen = belegen · Slots tauschen · rausziehen/Rechtsklick = leeren · Maus über Kachel + 1–9</small></div>
        <div class="inv-hb">${K.hotbarHTML(w, true)}</div>
        <div class="inv-zones"><div class="zone" data-zone="use">✋ Benutzen / Ausrüsten</div><div class="zone" data-zone="holster">🫳 Alles wegstecken</div><div class="zone bad" data-zone="drop">🗑 Wegwerfen</div></div>`;
      const b = this.panel('INVENTAR', h, 'inv');
      this.bindInventoryDnD(b);
    }
    invDetails(w) {
      const P = w.P, s = this.invSel;
      if (!s || (s.t === 'w' ? !P.weapons.some((q) => q.id === s.id) : !P.inv[s.id])) return '<p style="color:#888">Klick auf eine Kachel für Details. Doppelklick benutzt sie.</p>';
      if (s.t === 'w') {
        const d = W8[s.id], x = P.weapons.find((q) => q.id === s.id);
        const st = d.type === 'gun' ? `${K.AMMO[d.ammo].name} · Magazin ${x.mag}/${d.mag} · Reserve ${P.ammo[d.ammo] || 0} · Schaden ${d.dmg}${d.pellets ? '×' + d.pellets : ''}${x.sup ? ' · gedämpft' : ''}` : d.desc || `Schaden ${d.dmg}`;
        return `<div class="det-h">${K.slotIcon('w', s.id)}<h4>${esc(d.name)}</h4></div><p>${esc(st)}</p><div class="btns"><button class="btn" data-act="use">Ausrüsten</button><button class="btn ghost" data-act="drop">Ablegen</button></div>`;
      }
      const it = K.ITEMS[s.id], usable = !it.sellOnly && !it.quest && s.id !== 'lockpick';
      const st = [it.food ? `Hunger +${it.food}` : '', it.water ? `Durst +${it.water}` : '', it.energy ? `Energie +${it.energy}` : '', it.hp ? `HP +${it.hp}` : '', it.desc || '', it.hot ? 'Heiße Ware' : ''].filter(Boolean).join(' · ');
      const label = s.id === 'mask' ? (P.masked ? 'Abnehmen' : 'Aufsetzen') : s.id === 'growkit' || s.id === 'seed' ? 'Pflanzen' : s.id === 'bud' ? 'Rauchen' : it.place ? 'Platzieren' : 'Benutzen';
      return `<div class="det-h">${K.slotIcon('i', s.id)}<h4>${esc(it.name)} <small>×${P.inv[s.id]}</small></h4></div><p>${esc(st || '—')}</p><div class="btns">${usable ? `<button class="btn" data-act="use">${label}</button>` : ''}<button class="btn ghost" data-act="drop">Wegwerfen</button></div>`;
    }
    /** act on a dragged/selected thing: use · drop · put into hotbar slot */
    invAct(t, id, act, slot) {
      const w = this.g.world, P = w.P;
      if (act === 'use') { if (t === 'w') w.equipWeapon(id); else { w.useItem(id); if (w.placing) { this.closePanel(); return; } } }
      else if (act === 'holster') w.holsterAll();
      else if (act === 'drop') {
        if (t === 'w') { const i = P.weapons.findIndex((q) => q.id === id); if (i > 0) { const wi = P.weapons[i]; w.dropItem({ kind: 'weapon', wid: wi.id, mag: wi.mag, sup: wi.sup }, w.player.x + U.rnd(-10, 10), w.player.y + U.rnd(-10, 10)); w.removeWeaponAt(i); } }
        else if (w.takeItem(id)) w.dropItem({ kind: 'item', item: id }, w.player.x + U.rnd(-10, 10), w.player.y + U.rnd(-10, 10));
      } else if (act === 'slot') w.hotbarSet(slot, { t, id });
      this.g.audio.ui('click');
      this.inventory();
    }
    bindInventoryDnD(b) {
      const w = this.g.world;
      b.querySelectorAll('[data-act]').forEach((x) => (x.onclick = () => this.invAct(this.invSel.t, this.invSel.id, x.dataset.act)));
      b.querySelectorAll('.inv-hb [data-hb]').forEach((x) => (x.oncontextmenu = (e) => { e.preventDefault(); w.hotbarSet(+x.dataset.hb, null); this.inventory(); }));
      b.querySelectorAll('[data-drag]').forEach((el) => {
        el.addEventListener('mouseenter', () => (this.invHover = { t: el.dataset.t, id: el.dataset.id }));
        el.addEventListener('mouseleave', () => (this.invHover = null));
        el.ondblclick = () => this.invAct(el.dataset.t, el.dataset.id, 'use');
        el.onpointerdown = (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          const src = { t: el.dataset.t, id: el.dataset.id, hb: el.dataset.drag === 'hb' ? +el.dataset.hb : -1 }, x0 = e.clientX, y0 = e.clientY;
          let ghost = null, over = null;
          const move = (ev) => {
            if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
            if (!ghost) { ghost = document.createElement('div'); ghost.className = 'drag-ghost'; ghost.innerHTML = K.slotIcon(src.t, src.id); document.body.appendChild(ghost); el.classList.add('dragging'); }
            ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
            const tg = document.elementFromPoint(ev.clientX, ev.clientY), t2 = tg && tg.closest('[data-hb],[data-zone]');
            if (over !== t2) { if (over) over.classList.remove('over'); over = t2; if (over) over.classList.add('over'); }
          };
          const up = (ev) => {
            window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
            if (over) over.classList.remove('over');
            el.classList.remove('dragging');
            if (!ghost) { this.invSel = { t: src.t, id: src.id }; const det = b.querySelector('#inv-det'); if (det) { det.innerHTML = this.invDetails(w); det.querySelectorAll('[data-act]').forEach((x) => (x.onclick = () => this.invAct(src.t, src.id, x.dataset.act))); } b.querySelectorAll('.tile').forEach((q) => q.classList.toggle('sel', q.dataset.t === src.t && q.dataset.id === src.id)); return; }
            ghost.remove();
            const tg = document.elementFromPoint(ev.clientX, ev.clientY), t2 = tg && tg.closest('[data-hb],[data-zone]');
            if (t2 && t2.dataset.hb != null) { if (src.hb >= 0) { w.hotbarSwap(src.hb, +t2.dataset.hb); this.g.audio.ui('click'); this.inventory(); } else this.invAct(src.t, src.id, 'slot', +t2.dataset.hb); }
            else if (t2 && t2.dataset.zone) { if (src.hb >= 0 && t2.dataset.zone === 'drop') { w.hotbarSet(src.hb, null); this.inventory(); } else this.invAct(src.t, src.id, t2.dataset.zone); }
            else if (src.hb >= 0) { w.hotbarSet(src.hb, null); this.inventory(); }   // dragged off the bar → slot cleared
          };
          window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
        };
      });
    }
    /** inventory open + mouse over a tile + number key → put it into that slot */
    assignHover(n) {
      if (!this.invHover) return false;
      this.g.world.hotbarSet(n, this.invHover); this.g.audio.ui('click'); this.inventory();
      return true;
    }
    shop(id, bid, tab = 'buy') {
      const w = this.g.world, P = w.P, s = K.SHOPS[id];
      let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div class="tabs"><button data-tab="buy" class="${tab === 'buy' ? 'on' : ''}">Kaufen</button>${s.buysAll || id === 'gun' ? `<button data-tab="sell" class="${tab === 'sell' ? 'on' : ''}">Verkaufen</button>` : ''}</div><div class="wallet">${U.money(P.money)}</div></div>`;
      if (s.heal) h += `<div class="it on"><div class="ic">🏥</div><div class="nm">Vollständige Behandlung<small>Heilt alle Wunden und stoppt Blutungen.</small></div><div class="pr">${U.money(s.heal)}</div><button class="btn red" data-heal>Behandeln</button></div><div style="height:10px"></div>`;
      h += '<div class="list">';
      if (tab === 'buy') {
        for (const key of s.items) {
          const { price, name } = w.priceOf(key);
          let sub = '', owned = false;
          if (W8[key]) { const d = W8[key]; sub = d.type === 'gun' ? `${K.AMMO[d.ammo].name} · ${d.mag} Schuss · Schaden ${d.dmg}${d.pellets ? '×' + d.pellets : ''}${d.sup ? ' · gedämpft' : d.canSup ? ' · Dämpfer möglich' : ''}` : d.desc || (d.type === 'melee' ? `Nahkampf · Schaden ${d.dmg}` : ''); owned = !d.stack && !d.consumable && P.weapons.some((x) => x.id === key); }
          else if (key.startsWith('a:')) sub = `Du hast: ${P.ammo[key.slice(2)] || 0}`;
          else if (key.startsWith('o:')) { const o = K.OUTFITS[key.slice(2)]; sub = o.desc || (o.disguise ? `Verkleidung · Zugang: ${o.role}` : 'Zivile Kleidung'); owned = P.outfits.includes(key.slice(2)); }
          else { const it = K.ITEMS[key]; sub = [it.food ? `Hunger +${it.food}` : '', it.water ? `Durst +${it.water}` : '', it.energy ? `Energie +${it.energy}` : '', it.hp ? `HP +${it.hp}` : '', it.desc || ''].filter(Boolean).join(' · '); }
          const eat = s.eat && K.ITEMS[key] && (K.ITEMS[key].food || K.ITEMS[key].water);
          h += `<div class="it"><div class="ic">${icon(key)}</div><div class="nm">${esc(name)}<small>${esc(sub)}</small></div><div class="pr ${P.money < price ? 'bad' : ''}">${U.money(price)}</div>${eat ? `<button class="btn ghost" data-eat="${key}" ${P.money < price ? 'disabled' : ''}>Hier essen</button>` : ''}<button class="btn" data-buy="${key}" ${owned || P.money < price ? 'disabled' : ''}>${owned ? 'Besitzt' : 'Kaufen'}</button></div>`;
        }
      } else {
        P.weapons.forEach((x, i) => { if (!i) return; const v = Math.round((W8[x.id].price || 0) * 0.4) * (x.n || 1); h += `<div class="it"><div class="ic">${icon(x.id)}</div><div class="nm">${esc(W8[x.id].name)}</div><div class="pr">${U.money(v)}</div><button class="btn" data-sellw="${i}">Verkaufen</button></div>`; });
        if (s.buysAll) for (const k in P.inv) { const v = w.priceOf(k, true); if (!v) continue; const n = P.inv[k]; h += `<div class="it"><div class="ic">${icon(k)}</div><div class="nm">${esc(K.ITEMS[k].name)} ×${n}<small>${K.ITEMS[k].hot ? 'Hehlerware' : K.ITEMS[k].drug ? 'Großhandel — sicherer als die Straße, aber billiger' : ''}</small></div><div class="pr">${U.money(v)}${n > 1 ? '/Stk' : ''}</div><button class="btn" data-selli="${k}">1</button>${n > 1 ? `<button class="btn red" data-sellall="${k}">Alle ${U.money(v * n)}</button>` : ''}</div>`; }
      }
      h += '</div>';
      const b = this.panel(s.name, h, 'shop');
      b.querySelectorAll('[data-tab]').forEach((x) => (x.onclick = () => this.shop(id, bid, x.dataset.tab)));
      b.querySelectorAll('[data-buy]').forEach((x) => (x.onclick = () => { w.buy(x.dataset.buy, id); this.shop(id, bid, tab); }));
      b.querySelectorAll('[data-eat]').forEach((x) => (x.onclick = () => { w.eatHere(x.dataset.eat); this.shop(id, bid, tab); }));
      b.querySelectorAll('[data-sellw]').forEach((x) => (x.onclick = () => { w.sellWeapon(+x.dataset.sellw); this.shop(id, bid, 'sell'); }));
      b.querySelectorAll('[data-selli]').forEach((x) => (x.onclick = () => { w.sellItem(x.dataset.selli); this.shop(id, bid, 'sell'); }));
      b.querySelectorAll('[data-sellall]').forEach((x) => (x.onclick = () => { w.sellItem(x.dataset.sellall, 1e9); this.shop(id, bid, 'sell'); }));
      const hb = b.querySelector('[data-heal]'); if (hb) hb.onclick = () => { w.heal(); this.shop(id, bid, tab); };
    }
    /** a placed container: your stuff ⇄ its slots, capacity bars, code lock */
    container(uid) {
      const w = this.g.world, P = w.P, rec = w.placedRec(uid); if (!rec) return this.closePanel();
      const d = K.PLACE[rec.id], S = rec.store, cap = d.store, u = w.storeUsed(rec), only = cap.only;
      const row = (ic, nm, q, attr, lbl) => `<div class="it"><div class="ic">${ic}</div><div class="nm">${nm}</div><div class="q">${q}</div><button class="btn ghost" ${attr}>${lbl}</button></div>`;
      let h = `<div class="ctr-cap"><span>Fächer ${u.slots}/${cap.slots}</span><div class="bar"><i style="width:${(u.slots / cap.slots) * 100}%"></i></div><span>${u.kg.toFixed(1)}/${cap.kg} kg</span><div class="bar"><i style="width:${Math.min(100, (u.kg / cap.kg) * 100)}%"></i></div></div>`;
      if (d.lock) h += `<div class="ctr-lock">🔒 <span>Zahlenschloss · Code <b>${esc(rec.code)}</b></span><input data-code maxlength="4" placeholder="neu" inputmode="numeric"><button class="btn ghost" data-setcode>Ändern</button><small style="margin-left:auto;color:#a5b4fc">${['', 'Einfaches Schloss', 'Tresorschloss', 'Hochsicherheit'][d.lock]}</small></div>`;
      else h += '<div class="ctr-lock" style="border-color:rgba(244,63,94,.4);background:rgba(244,63,94,.08)">🔓 <span>Unverschlossen — Einbrecher bedienen sich.</span></div>';
      h += '<div class="cols"><div><div class="sec">Bei dir</div><div class="list">';
      P.weapons.forEach((x, i) => { if (i) h += row(icon(x.id), esc(W8[x.id].name), x.n ? '×' + x.n : '', `data-pw="${i}"`, 'Rein ▶'); });
      if (only !== 'w') {
        for (const k in P.ammo) if (P.ammo[k] > 0) h += row(icon('a:' + k), K.AMMO[k].name, P.ammo[k], `data-pa="${k}"`, 'Rein ▶');
        for (const k in P.inv) h += row(icon(k), esc(K.ITEMS[k].name), '×' + P.inv[k], `data-pi="${k}"`, 'Rein ▶');
      }
      h += `</div></div><div><div class="sec">${esc(d.name)}</div><div class="list">`;
      S.weapons.forEach((x, i) => (h += row(icon(x.id), esc(W8[x.id].name), x.n ? '×' + x.n : '', `data-sw="${i}"`, '◀ Raus')));
      for (const k in S.ammo) if (S.ammo[k] > 0) h += row(icon('a:' + k), K.AMMO[k].name, S.ammo[k], `data-sa="${k}"`, '◀ Raus');
      for (const k in S.items) if (S.items[k] > 0) h += row(icon(k), esc(K.ITEMS[k].name), '×' + S.items[k], `data-si="${k}"`, '◀ Raus');
      if (!u.slots) h += '<div class="it"><div class="nm"><small>Leer.</small></div></div>';
      h += '</div></div></div>';
      const b = this.panel(d.name.toUpperCase(), h, 'container');
      const re = () => this.container(uid);
      b.querySelectorAll('[data-pw]').forEach((x) => (x.onclick = () => { w.storePut(rec, 'w', +x.dataset.pw); re(); }));
      b.querySelectorAll('[data-pa]').forEach((x) => (x.onclick = () => { w.storePut(rec, 'a', x.dataset.pa); re(); }));
      b.querySelectorAll('[data-pi]').forEach((x) => (x.onclick = () => { w.storePut(rec, 'i', x.dataset.pi); re(); }));
      b.querySelectorAll('[data-sw]').forEach((x) => (x.onclick = () => { w.storeTake(rec, 'w', +x.dataset.sw); re(); }));
      b.querySelectorAll('[data-sa]').forEach((x) => (x.onclick = () => { w.storeTake(rec, 'a', x.dataset.sa); re(); }));
      b.querySelectorAll('[data-si]').forEach((x) => (x.onclick = () => { w.storeTake(rec, 'i', x.dataset.si); re(); }));
      const sc = b.querySelector('[data-setcode]'); if (sc) sc.onclick = () => { if (w.setCode(rec, b.querySelector('[data-code]').value.trim())) re(); };
    }
    /** your street dealer: hand over product, take it back, collect the cash, let them go */
    corner(uid) {
      const w = this.g.world, P = w.P, rec = w.org().dealers.find((d) => d.uid === uid); if (!rec) return this.closePanel();
      const drugs = ['bud', 'meth', 'coke', 'weedbrick'].filter((k) => K.ITEMS[k]);
      let h = `<div class="ctr-cap"><span>${esc(K.DISTRICTS[w.districtAt(rec.x, rec.y)] || '')} · ${w.ownTurfAt(rec.x, rec.y) ? 'dein Revier (+30% Absatz)' : 'fremdes Pflaster'}</span><span>Verkauft: ${rec.sold}</span><span>Anteil Dealer: ${Math.round(K.ORG.dealerCut * 100)}%</span></div>`;
      h += `<div class="job"><b>Kasse: ${U.money(rec.cash)}</b><div class="btns" style="margin-top:8px"><button class="btn red" data-dc ${rec.cash ? '' : 'disabled'}>Kassieren</button><button class="btn ghost" data-df>Feuern</button></div></div>`;
      h += '<div class="cols"><div><div class="sec">Bei dir</div><div class="list">';
      for (const k of drugs) if (P.inv[k]) h += `<div class="it"><div class="ic">${icon(k)}</div><div class="nm">${esc(K.ITEMS[k].name)}</div><div class="q">×${P.inv[k]}</div><button class="btn ghost" data-dg="${k}">Alles geben ▶</button></div>`;
      h += '</div></div><div><div class="sec">Ware an der Ecke</div><div class="list">';
      for (const k in rec.stock) h += `<div class="it"><div class="ic">${icon(k)}</div><div class="nm">${esc(K.ITEMS[k].name)}</div><div class="q">×${rec.stock[k]}</div><button class="btn ghost" data-dt="${k}">◀ Zurück</button></div>`;
      if (!Object.keys(rec.stock).length) h += '<div class="it"><div class="nm"><small>Nichts mehr da. Ohne Ware kein Geschäft.</small></div></div>';
      h += '</div></div></div><p style="font-size:12px;color:#9ca3af">Nachts und in belebten Vierteln läuft mehr. Razzien sind in Mitte häufiger, im eigenen Revier seltener; in fremdem Revier wird eher geraubt.</p>';
      const b = this.panel(`ECKE · ${rec.name.toUpperCase()}`, h, 'corner');
      const re = () => this.corner(uid);
      b.querySelectorAll('[data-dg]').forEach((x) => (x.onclick = () => { w.dealerGive(rec, x.dataset.dg, 1e9); re(); }));
      b.querySelectorAll('[data-dt]').forEach((x) => (x.onclick = () => { w.dealerTake(rec, x.dataset.dt); re(); }));
      b.querySelector('[data-dc]').onclick = () => { w.dealerCollect(rec); re(); };
      b.querySelector('[data-df]').onclick = () => { w.dealerFire(rec); this.closePanel(); };
    }
    /** phone: the organisation */
    orgApp(body, tab) {
      const w = this.g.world, P = w.P, O = w.org();
      this.phoneApp = 'org:' + tab;
      const r = w.orgRank(), next = K.ORG.ranks[r + 1], cur = K.ORG.ranks[r][0];
      const tabs = `<div class="cs-tabs">${[['home', 'Übersicht'], ['racket', 'Schutzgeld'], ['corners', 'Ecken'], ['biz', 'Geschäfte']].map(([k, n]) => `<button class="${k === tab ? 'on' : ''}" data-ot="${k}">${n}</button>`).join('')}</div>`;
      let h = `<div class="ph-h">ORGANISATION</div><div class="org-rank"><b>${esc(K.ORG.ranks[r][1])}</b><small>${P.gang ? esc(P.gang.name) : 'ohne Gang'} · Ruf ${Math.floor(O.rep)}${next ? ' / ' + next[0] : ''}</small><div class="xpbar"><i style="width:${next ? ((O.rep - cur) / (next[0] - cur)) * 100 : 100}%"></i></div></div>${tabs}`;
      const rk = Object.entries(O.racket), dl = O.dealers.filter((d) => !d.gone);
      let biz = 0; for (const id of P.owned) biz += Math.round((w.propertyDef(id).income || 0) * w.bizMult(id));
      if (tab === 'home') {
        const rDay = rk.reduce((s, [, R]) => s + R.rate, 0), turf = w.playerBlocks ? w.playerBlocks() * K.TURF_INCOME : 0;
        h += `<div class="card"><div class="sub">Tageseinnahmen (geschätzt)</div>
          <div class="stat"><span>Legale Geschäfte</span><b>${U.money(biz)}</b></div>
          <div class="stat"><span>Reviere (${w.playerBlocks ? w.playerBlocks() : 0} Blöcke)</span><b>${U.money(turf)}</b></div>
          <div class="stat"><span>Schutzgeld (${rk.length} Läden)</span><b>${U.money(rDay)}</b></div>
          <div class="stat"><span>Dealer heute (${dl.length}/${w.maxDealers()})</span><b>${U.money(O.today.dealers || 0)}</b></div></div>
          <div class="card"><p>Fordere Schutzgeld direkt im Laden [T] — mit gezogener Waffe, deiner Crew oder im eigenen Revier geben sie eher nach. Eröffne Ecken für Dealer und versorge sie mit Ware. Höherer Rang = mehr Ecken.</p></div>`;
      } else if (tab === 'racket') {
        if (!rk.length) h += '<div class="card"><p>Noch kein Laden zahlt dir. Geh in einen Laden und sprich den Inhaber an [T].</p></div>';
        for (const [bid, R] of rk) { const b = w.buildings[bid]; h += `<div class="card"><div class="sub">${esc(K.DISTRICTS[b.district] || '')}${w.ownTurfAt(b.x * TILE, b.y * TILE) ? ' · dein Revier: Gang kassiert automatisch' : ''}</div><h4>${esc(R.name)}</h4><div class="meta"><span>${U.money(R.rate)}/Tag${R.unpaid > 2 ? ` · ⚠ ${R.unpaid} Tage nicht abgeholt` : ''}</span><b>${R.owed ? 'offen ' + U.money(R.owed) : '✔'}</b></div><div class="btns"><button class="btn ghost" data-oloc="${bid}">Wegpunkt</button></div></div>`; }
      } else if (tab === 'corners') {
        h += `<div class="card"><p>Stell dich auf die Straße, wo die Ecke sein soll. Ein Dealer kostet ${U.money(K.ORG.dealerFee)} Startgeld und behält ${Math.round(K.ORG.dealerCut * 100)}%.</p><div class="btns"><button class="btn red" data-oopen ${dl.length >= w.maxDealers() ? 'disabled' : ''}>Hier eine Ecke eröffnen</button></div></div>`;
        for (const d of dl) h += `<div class="card"><div class="sub">${esc(K.DISTRICTS[w.districtAt(d.x, d.y)] || '')}</div><h4>${esc(d.name)}</h4><div class="meta"><span>Ware: ${w.dealerUnits(d)} · verkauft ${d.sold}</span><b>${U.money(d.cash)}</b></div><div class="btns"><button class="btn ghost" data-oway="${d.uid}">Wegpunkt</button></div></div>`;
      } else {
        const mine = P.owned.filter((id) => w.propertyDef(id).income);
        if (!mine.length) h += '<div class="card"><p>Du besitzt noch kein Geschäft. Immobilien-App: Bar, Diner, Tankstelle, Werkstatt, Clubs.</p></div>';
        for (const id of mine) { const d = w.propertyDef(id), lv = w.bizLevel(id), up = K.ORG.bizUp[lv]; h += `<div class="card"><h4>${esc(d.name)}</h4><div class="meta"><span>${U.money(Math.round(d.income * w.bizMult(id)))}/Tag · Ausbau ${lv}/${K.ORG.bizUp.length}</span><b>${lv ? '+' + Math.round((w.bizMult(id) - 1) * 100) + '%' : ''}</b></div>${up ? `<div class="btns"><button class="btn" data-oup="${id}" ${P.money >= w.bizUpgradeCost(id) ? '' : 'disabled'}>${esc(up.name)} · ${U.money(w.bizUpgradeCost(id))}</button></div>` : '<p style="color:#10b981">Voll ausgebaut.</p>'}</div>`; }
      }
      body.innerHTML = h;
      body.querySelectorAll('[data-ot]').forEach((b) => (b.onclick = () => this.orgApp(body, b.dataset.ot)));
      body.querySelectorAll('[data-oloc]').forEach((b) => (b.onclick = () => { const bb = w.buildings[b.dataset.oloc]; this.g.waypoint = { x: (bb.entrance.x + 0.5) * TILE, y: (bb.entrance.y + 0.5) * TILE }; this.g.ui.feed('Wegpunkt gesetzt.'); }));
      body.querySelectorAll('[data-oway]').forEach((b) => (b.onclick = () => { const d = O.dealers.find((q) => q.uid === +b.dataset.oway); if (d) { this.g.waypoint = { x: d.x, y: d.y }; this.g.ui.feed('Wegpunkt gesetzt.'); } }));
      const op = body.querySelector('[data-oopen]'); if (op) op.onclick = () => { w.openCorner(); this.orgApp(body, 'corners'); };
      body.querySelectorAll('[data-oup]').forEach((b) => (b.onclick = () => { w.bizUpgrade(b.dataset.oup); this.orgApp(body, 'biz'); }));
    }
    /** a crafting station: recipes with what you have, the running batch, collect */
    station(uid) {
      const w = this.g.world, P = w.P, rec = w.placedRec(uid); if (!rec) return this.closePanel();
      const d = K.PLACE[rec.id], R = w.recipesOf(rec), j = rec.job;
      const nm = (k) => (k.startsWith('a:') ? K.AMMO[k.slice(2)].name : K.ITEMS[k].name);
      let h = '';
      if (j) {
        const r = R.find((q) => q.id === j.rid), k = U.clamp((w.time - j.start) / Math.max(1, j.end - j.start), 0, 1), done = w.time >= j.end;
        h += `<div class="job"><b>${esc(r ? r.name : '?')}</b> — ${done ? 'fertig!' : `noch ${Math.ceil(j.end - w.time)} Spielminuten`}<div class="bar"><i style="width:${k * 100}%"></i></div>${done ? '<button class="btn red" data-collect>Abholen</button>' : '<small style="color:#a5b4fc">Die Station arbeitet auch, wenn du weg bist oder schläfst.</small>'}</div>`;
      }
      for (const r of R) {
        const ins = Object.entries(r.in).map(([k, n]) => `<span class="${(P.inv[k] || 0) >= n ? 'have' : 'miss'}">${n}× ${esc(nm(k))} (${P.inv[k] || 0})</span>`).join(' + ');
        const outs = Object.entries(r.out).map(([k, n]) => `${n}× ${esc(nm(k))}`).join(', ');
        h += `<div class="rcp"><div><b>${esc(r.name)}</b><small>${ins} → ${outs} · ${r.min} min${r.risk ? ' · ⚠ Explosionsgefahr' : ''}${r.smell ? ' · 👃 riecht' : ''}</small></div><button class="btn" data-start="${r.id}" ${j || !w.canCraft(r) ? 'disabled' : ''}>Starten</button></div>`;
      }
      const b = this.panel(d.name.toUpperCase(), h, 'station');
      b.querySelectorAll('[data-start]').forEach((x) => (x.onclick = () => { w.startCraft(rec, x.dataset.start); this.station(uid); }));
      const c = b.querySelector('[data-collect]'); if (c) c.onclick = () => { w.collectCraft(rec); this.station(uid); };
    }
    /** phone: furniture & gear catalogue (legal stuff, delivered by courier) + what you have placed */
    propsApp(body) {
      const w = this.g.world, P = w.P;
      this.phoneApp = 'props';
      let h = '<div class="fx-app"><div class="ph-h">EINRICHTUNG</div><p style="font-size:12px;color:#a5b4fc;margin-top:-6px">Kurier liefert sofort ins Inventar. Platzieren: Item benutzen (Inventar oder Hotbar).</p>';
      for (const cat of ['home', 'store', 'street']) {
        h += `<div class="cat">${K.PLACE_CATS[cat]}</div>`;
        for (const d of Object.values(K.PLACE)) if (d.cat === cat && !d.black) {
          const n = P.inv['pl_' + d.id] || 0, placed = w.placedList().filter((r) => r.id === d.id).length;
          h += `<div class="pi"><i>${d.e}</i><div><b>${esc(d.name)}</b><small>${d.store ? `${d.store.slots} Fächer · ${d.store.kg} kg${d.lock ? ' · 🔒' : ''}` : d.where === 'own' ? 'Nur in eigener Immobilie' : 'Straße oder Immobilie'}${n || placed ? ` · ${n} im Inventar, ${placed} platziert` : ''}</small></div><button class="btn" data-pbuy="${d.id}" ${P.money >= d.price ? '' : 'disabled'}>${U.money(d.price)}</button></div>`;
        }
      }
      h += `<div class="cat">Stationen</div><p style="font-size:12px;color:#9ca3af">Labore und Werkbank gibt es nur auf dem Schwarzmarkt am Hafen.</p><div class="cat">Platziert: ${w.placedList().length}/${K.PLACE_MAX}</div></div>`;
      body.innerHTML = h;
      body.querySelectorAll('[data-pbuy]').forEach((b) => (b.onclick = () => {
        const d = K.PLACE[b.dataset.pbuy];
        if (!w.pay(d.price)) return w.notify('Zu wenig Bargeld.', 'bad');
        w.addItem('pl_' + d.id); w.emit('sfx', { s: 'purchase' }); w.notify(`${d.name} geliefert.`, 'good');
        this.propsApp(body);
      }));
    }
    stash(propId) {
      const w = this.g.world, P = w.P, S = P.stash[propId] || (P.stash[propId] = { items: {}, weapons: [], ammo: {}, money: 0 });
      const row = (ic, nm, q, attr, lbl) => `<div class="it"><div class="ic">${ic}</div><div class="nm">${nm}</div><div class="q">${q}</div><button class="btn ghost" ${attr}>${lbl}</button></div>`;
      let h = '<div class="cols"><div><div class="sec">Bei dir</div><div class="list">';
      P.weapons.forEach((x, i) => { if (i) h += row(icon(x.id), esc(W8[x.id].name), x.n ? '×' + x.n : '', `data-pw="${i}"`, 'Einlagern ▶'); });
      for (const k in P.ammo) if (P.ammo[k] > 0) h += row(icon('a:' + k), K.AMMO[k].name, P.ammo[k], `data-pa="${k}"`, 'Einlagern ▶');
      for (const k in P.inv) h += row(icon(k), esc(K.ITEMS[k].name), '×' + P.inv[k], `data-pi="${k}"`, 'Einlagern ▶');
      h += '</div></div><div><div class="sec">Lager · ' + esc(w.propertyDef(propId).name) + '</div><div class="list">';
      S.weapons.forEach((x, i) => (h += row(icon(x.id), esc(W8[x.id].name), x.n ? '×' + x.n : '', `data-sw="${i}"`, '◀ Nehmen')));
      for (const k in S.ammo) if (S.ammo[k] > 0) h += row(icon('a:' + k), K.AMMO[k].name, S.ammo[k], `data-sa="${k}"`, '◀ Nehmen');
      for (const k in S.items) if (S.items[k] > 0) h += row(icon(k), esc(K.ITEMS[k].name), '×' + S.items[k], `data-si="${k}"`, '◀ Nehmen');
      if (!S.weapons.length && !Object.keys(S.items).length && !Object.values(S.ammo).some((v) => v > 0)) h += '<div class="it"><div class="nm"><small>Leer.</small></div></div>';
      h += '</div></div></div>';
      const b = this.panel('WAFFENKAMMER & LAGER', h, 'stash');
      const re = () => this.stash(propId);
      b.querySelectorAll('[data-pw]').forEach((x) => (x.onclick = () => { const i = +x.dataset.pw; S.weapons.push(P.weapons[i]); w.removeWeaponAt(i); re(); }));
      b.querySelectorAll('[data-pa]').forEach((x) => (x.onclick = () => { const k = x.dataset.pa; S.ammo[k] = (S.ammo[k] || 0) + P.ammo[k]; P.ammo[k] = 0; re(); }));
      b.querySelectorAll('[data-pi]').forEach((x) => (x.onclick = () => { const k = x.dataset.pi; S.items[k] = (S.items[k] || 0) + P.inv[k]; delete P.inv[k]; re(); }));
      b.querySelectorAll('[data-sw]').forEach((x) => (x.onclick = () => { const i = +x.dataset.sw, wp = S.weapons[i]; if (P.weapons.length >= 16) return w.notify('Kein Platz mehr für Waffen (max. 15).', 'bad'); const d = W8[wp.id]; if (!d.stack && !d.consumable && P.weapons.some((q) => q.id === wp.id)) return w.notify('Hast du schon dabei.', 'bad'); if (d.stack || d.consumable) w.addWeapon(wp.id, { n: wp.n }); else { P.weapons.push(wp); w.hotbarAdd('w', wp.id); } S.weapons.splice(i, 1); re(); }));
      b.querySelectorAll('[data-sa]').forEach((x) => (x.onclick = () => { const k = x.dataset.sa; P.ammo[k] = (P.ammo[k] || 0) + S.ammo[k]; S.ammo[k] = 0; re(); }));
      b.querySelectorAll('[data-si]').forEach((x) => (x.onclick = () => { const k = x.dataset.si; w.addItem(k, S.items[k]); delete S.items[k]; re(); }));
    }
    wardrobe() {
      const w = this.g.world, P = w.P;
      let h = '<div class="outfits">';
      for (const o of P.outfits) h += `<div class="outfit ${o === P.outfit ? 'on' : ''}"><canvas width="160" height="160" data-o="${o}"></canvas><div>${esc(K.OUTFITS[o].name)}</div><button class="btn ${o === P.outfit ? 'ghost' : ''}" data-wear="${o}" ${o === P.outfit ? 'disabled' : ''}>${o === P.outfit ? 'Getragen' : 'Anziehen'}</button></div>`;
      h += '</div><p style="font-size:12px;color:#999;margin-top:14px">Tipp: Ein Outfitwechsel ohne Zeugen senkt die Fahndung um 2 Sterne. Neue Kleidung gibt es in der Boutique Noir.</p>';
      const b = this.panel('KLEIDERSCHRANK', h, 'wardrobe');
      b.querySelectorAll('canvas[data-o]').forEach((cv) => K.portrait(cv, { outfit: cv.dataset.o, skin: w.player.skin, hair: null, female: false }));
      b.querySelectorAll('[data-wear]').forEach((x) => (x.onclick = () => { w.setOutfit(x.dataset.wear); this.wardrobe(); }));
    }
    sleep(propId) {
      const w = this.g.world, h0 = w.hour();
      const toMorning = ((7 - h0 + 24) % 24) || 24;
      const h = `<p style="color:#cfc9be">Schlaf stellt Energie und Gesundheit wieder her und speichert das Spiel. Hunger und Durst laufen weiter.</p><div class="btns">
        <button class="btn red" data-h="${toMorning.toFixed(2)}">Bis 07:00 (${Math.round(toMorning)}h)</button><button class="btn" data-h="8">8 Stunden</button><button class="btn ghost" data-h="4">Nickerchen (4h)</button><button class="btn ghost" data-home>Als Zuhause festlegen</button></div>`;
      const b = this.panel('SCHLAFEN', h, 'sleep');
      b.querySelectorAll('[data-h]').forEach((x) => (x.onclick = () => { this.closePanel(); this.g.doSleep(+x.dataset.h, propId); }));
      b.querySelector('[data-home]').onclick = () => { w.P.home = propId; w.notify('Neues Zuhause festgelegt.', 'good'); this.closePanel(); };
    }
    property(id) {
      const w = this.g.world, d = w.propertyDef(id), P = w.P;
      const h = `<p style="color:#cfc9be;font-size:15px">${esc(d.desc)}</p><div class="stat"><span>Preis</span><b>${U.money(d.price)}</b></div>${d.income ? `<div class="stat"><span>Einnahmen</span><b>+${U.money(d.income)} / Tag</b></div>` : ''}<div class="stat"><span>Ausstattung</span><b>Bett · Kleiderschrank · Waffenkammer</b></div><div class="btns" style="margin-top:14px"><button class="btn red" data-buy ${P.money >= d.price ? '' : 'disabled'}>Kaufen</button><span class="wallet" style="margin-left:auto">${U.money(P.money)}</span></div>`;
      const b = this.panel(d.name, h, 'property');
      b.querySelector('[data-buy]').onclick = () => { if (w.buyProperty(id)) { this.closePanel(); this.g.save(true); } };
    }

    // ============================================================ map
    openMap() { this.closePhone(); this.closePanel(); $('#mapview').classList.remove('hidden'); this.sync(); requestAnimationFrame(() => this.drawMap()); if (document.fonts && !this.fontReady) document.fonts.load('600 40px "Oswald"').then(() => { this.fontReady = true; if (!$('#mapview').classList.contains('hidden')) this.drawMap(); }).catch(() => {}); }
    closeMap() { $('#mapview').classList.add('hidden'); this.sync(); }
    toggleMap() { if ($('#mapview').classList.contains('hidden')) this.openMap(); else this.closeMap(); }
    drawMap() {
      const w = this.g.world, cv = $('#bigmap'), ui = this.g.ui;
      const r = cv.getBoundingClientRect();
      cv.width = r.width * 1.5; cv.height = r.height * 1.5;
      const x = cv.getContext('2d');
      if (!ui.mapTex) ui.buildMapTex();
      const s = Math.min(cv.width / w.W, cv.height / w.H), ox = (cv.width - w.W * s) / 2, oy = (cv.height - w.H * s) / 2;
      this.mapMeta = { s, ox, oy };
      // dossier table: graphite with a fine survey grid
      x.fillStyle = '#0c0e11'; x.fillRect(0, 0, cv.width, cv.height);
      x.strokeStyle = 'rgba(255,255,255,0.035)'; x.lineWidth = 1;
      for (let gx = ox % (s * 8); gx < cv.width; gx += s * 8) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, cv.height); x.stroke(); }
      for (let gy = oy % (s * 8); gy < cv.height; gy += s * 8) { x.beginPath(); x.moveTo(0, gy); x.lineTo(cv.width, gy); x.stroke(); }
      x.save(); x.shadowColor = 'rgba(0,0,0,0.8)'; x.shadowBlur = 30; x.fillStyle = '#000'; x.fillRect(ox, oy, w.W * s, w.H * s); x.restore();
      x.imageSmoothingEnabled = false; x.drawImage(ui.mapTex, ox, oy, w.W * s, w.H * s); x.imageSmoothingEnabled = true;
      if (ui.mapNeon) x.drawImage(ui.mapNeon, ox, oy, w.W * s, w.H * s);
      ui.drawTurf(x, s, ox, oy, 0.22);
      const toM = (wx, wy) => [ox + wx / TILE * s, oy + wy / TILE * s];
      // district labels
      x.font = `600 ${Math.round(s * 2.6)}px "Oswald", sans-serif`; x.textAlign = 'center';
      if ('letterSpacing' in x) x.letterSpacing = `${Math.round(s * 0.9)}px`;
      const seen = new Set();
      for (const bl of w.city.blocks) { if (seen.has(bl.d)) continue; seen.add(bl.d); const [mx, my] = toM((bl.ox + 11) * TILE, (bl.oy + 11) * TILE); x.save(); x.shadowColor = 'rgba(0,0,0,0.9)'; x.shadowBlur = 6; x.fillStyle = 'rgba(240,238,232,0.82)'; x.fillText(K.DISTRICTS[bl.d].toUpperCase(), mx, my); x.restore(); }
      { const [mx, my] = toM(40 * TILE, (w.city.W + 3) * TILE); x.save(); x.font = `500 ${Math.round(s * 2)}px "Oswald", sans-serif`; x.fillStyle = 'rgba(240,238,232,0.55)'; x.fillText('OCEAN DRIVE', mx, my - s * 5.5); x.restore(); }
      if ('letterSpacing' in x) x.letterSpacing = '0px';
      x.font = `${Math.round(s * 4.2)}px sans-serif`; x.textBaseline = 'middle';
      for (const q of ui.poiIcons()) { const [mx, my] = toM(q.x, q.y); if (!q.small) { x.fillStyle = 'rgba(10,11,14,0.88)'; x.beginPath(); x.arc(mx, my, s * 3, 0, 6.3); x.fill(); x.strokeStyle = q.c || 'rgba(240,238,232,0.7)'; x.lineWidth = 1.5; x.stroke(); } x.fillStyle = '#fff'; x.fillText(q.e, mx, my + 1); }
      const c = w.contract, tgt = w.targetActor();
      if (c && tgt) {
        if (c.intel) { const [mx, my] = toM(tgt.x, tgt.y); x.fillStyle = '#ff2030'; x.beginPath(); x.arc(mx, my, s * 2, 0, 6.3); x.fill(); }
        else if (c.ping) { const [mx, my] = toM(c.ping.x, c.ping.y); x.strokeStyle = '#ff2030'; x.fillStyle = 'rgba(255,32,48,.2)'; x.lineWidth = 3; x.beginPath(); x.arc(mx, my, s * 8, 0, 6.3); x.fill(); x.stroke(); }
      }
      if (this.g.waypoint) { const [mx, my] = toM(this.g.waypoint.x, this.g.waypoint.y); x.strokeStyle = '#ffd34d'; x.lineWidth = 4; x.beginPath(); x.arc(mx, my, s * 2.5, 0, 6.3); x.stroke(); }
      const p = w.player; const [px, py] = toM(p.x, p.y);
      x.save(); x.translate(px, py); x.rotate(p.angle); x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 3; x.beginPath(); x.moveTo(s * 3, 0); x.lineTo(-s * 2, -s * 2); x.lineTo(-s, 0); x.lineTo(-s * 2, s * 2); x.closePath(); x.stroke(); x.fill(); x.restore();
      $('#mv-legend').innerHTML = '<div>🏠 Dein Besitz · 🏷️ Zu verkaufen<br>🔫 Waffen · 💀 Schwarzmarkt · 🛒 Späti<br>💊 Apotheke · 👔 Boutique · 🍔 Diner · 🍸 Bar<br>🏥 Klinik · 🚓 Polizei · 🎵 Club<br>🌱 Growshop · 🏧 Geldautomat · 🏦 Bank · 💎 Juwelier<br>⛽ Tankstelle · 🚗 Autohaus · 🔧 Werkstatt<br>🍹 Beachclub · 💃 Stripclub · <span style="color:#ff2030">●</span> Ziel</div><div>Reviere: ' + Object.entries(K.GANGS).map(([k, g]) => `<span style="color:${g.col}">■</span> ${g.name}`).join(' · ') + (w.P.gang ? ` · <span style="color:${w.P.gang.col}">■</span> ${U.esc(w.P.gang.name)}` : '') + ' · ⚔ Krieg</div>';
    }

    // ============================================================ title / pause / results
    controls() {
      const k = [['W A S D', 'Bewegen', 'Maus', 'Zielen / Blickrichtung'], ['Shift', 'Sprinten', 'LMB', 'Angriff / Schießen / Werfen'], ['C', 'Ducken (leiser, schwerer zu sehen)', 'RMB', 'Präzise zielen (Scope)'], ['E', 'Interagieren / Leiche ziehen', 'R', 'Nachladen'], ['F', 'Takedown von hinten / Auto', 'T', 'Verkleidung vom Körper nehmen'], ['Q (halten)', 'Instinkt: durch Wände sehen', 'G', 'C4 zünden'], ['1–9 / Mausrad', 'Hotbar: Waffe ziehen/wegstecken, Item benutzen', 'H / 0', 'Alles wegstecken · Fäuste'], ['TAB', 'Inventar: Drag & Drop in die Hotbar', 'Maus über Kachel + 1–9', 'Slot direkt belegen'], ['TAB', 'Inventar', 'P', 'Handy (Aufträge, Profil…)'], ['M', 'Stadtkarte', 'L', 'Taschenlampe'], ['Z', 'Zoomstufe', 'ESC', 'Pause / Schließen'], ['Leertaste', 'Handbremse (Auto)', 'F11', 'Vollbild'], ['X', 'Ergeben (bei Fahndung)', 'K', 'Kaution zahlen (im Knast)'], ['RMB + Waffe auf Person', 'Überfall: Hände hoch!', 'E / T bei Passanten', 'Klauen, Ausrauben, Dealen'], ['Im Auto: B / N', 'Gurt an/aus · Motor an/aus', 'Im Auto: X / L', 'Tempomat · Licht (Abblend/Fern)'], ['Im Auto: Q / E', 'Blinker links / rechts (beide = Warnblinker)', 'Im Auto: Shift / T', 'Nitro · Werkstatt-Aktion'], ['Im Auto: LMB / RMB', 'Drive-by oder Bord-MG · Raketen', 'Im Auto: F / H', 'Aussteigen · Hupe'], ['B', 'Crew-Menü (Befehle, Formation, Haltung)', 'V', 'Crew: Ziel unterm Fadenkreuz angreifen'], ['E / T an Tresortür', 'Keycard / Thermobohrer (oder C4)', 'T an Vitrine', 'Juwelier: Vitrine einschlagen'], ['RMB mit Zielfernrohr', 'Scope · Shift: Atem anhalten', 'Prop-Item benutzen', 'Platzieren: R/Mausrad drehen, LMB setzen, RMB abbrechen'], ['E am Prop', 'Container öffnen · Station · Schlafen', 'T halten am Prop', 'Abbauen (zurück ins Inventar)']];
      const h = `<div class="kbd-grid">${k.map((r) => `<kbd>${r[0]}</kbd><span>${r[1]}</span><kbd>${r[2]}</kbd><span>${r[3]}</span>`).join('')}</div>
        <div class="sec" style="margin-top:18px">So spielst du</div>
        <p style="font-size:13px;color:#cfc9be;line-height:1.6">Aufträge kommen aufs <b>Handy (P)</b>. Finde das Ziel — mit gekauftem Intel wird es markiert, sonst kennst du nur grob den Bereich. Nimm Verkleidungen von bewusstlosen oder toten Wachen (<b>T</b>), um in Sperrgebiete zu kommen. Wirf <b>Münzen</b>, um Wachen wegzulocken, und erledige Ziele lautlos von hinten (<b>F</b>) mit der Klaviersaite. Leichen versteckst du in Containern und Schränken (<b>E</b>). Zeugen rufen die Polizei — wechsle das Outfit ungesehen, um die Fahndung zu senken. Willst du nicht sterben, ergib dich mit <b>X</b>: weniger Haft, aber Knast ist Knast. Halt Passanten oder Ladenbesitzer mit gezogener Waffe (<b>RMB</b>) in Schach und raub sie aus, zieh Brieftaschen von hinten, durchwühl fremde Wohnungen, hack Geldautomaten. Mit einer Sturmhaube erkennt dich niemand. Im Growshop gibt es Samen und Töpfe — pflanz in deiner Bude, gieß, dünge, ernte und verkauf an Passanten (<b>T</b>) oder am Schwarzmarkt. Iss, trink, schlaf in deinem eigenen Bett, kauf Waffen, Häuser und Geschäfte. Krähenburg lebt — Tag und Nacht, Regen und Nebel.</p>`;
      if (!$('#title').classList.contains('hidden')) this.titlePanel('STEUERUNG', h);
      else this.panel('STEUERUNG', h, 'help');
    }
    titlePanel(t, h) { $('#title').classList.add('hidden'); const b = this.panel(t, h, 'title-sub'); this.backToTitle = true; return b; }
    settings() {
      const g = this.g, s = g.settings;
      const tog = (k, name, sub) => `<div class="set"><div>${name}<small>${sub}</small></div><button class="tog ${s[k] ? 'on' : ''}" data-t="${k}"></button></div>`;
      const h = `${tog('post', 'Post-FX (WebGL)', 'Bloom, Farbkorrektur, Chromatic Aberration, Film-Grain')}${tog('vice', 'Kino-Look', 'Filmisches Grading: kühle Schatten, warme Lichter, wärmer zur goldenen Stunde')}${tog('fov', 'Sichtfeld-Schatten', 'Nur was du siehst ist sichtbar — für Stealth')}${tog('gore', 'Blut & Gore', 'Blutspritzer, Lachen, Körperteile')}${tog('music', 'Dynamische Musik', 'Noir-Jazz, Spannung & Kampf passen sich an')}${tog('voice', 'NPC-Stimmen', 'Sprachausgabe für wichtige Rufe (Browser-TTS)')}${tog('barks', 'Sprechblasen', 'Was NPCs sagen')}${tog('weather', 'Wetter-Effekte', 'Regen, Nebel, Gewitter')}${tog('clouds', 'Wolkenschatten', '')}${tog('shake', 'Kamera-Wackeln', '')}
        <div class="set"><div>Lautstärke</div><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-r="volume"></div>
        <div class="set"><div>Musik</div><input type="range" min="0" max="1" step="0.05" value="${s.musicVol}" data-r="musicVol"></div>
        <div class="set"><div>Auflösung<small>Weniger = schneller</small></div><select data-s="res"><option value="1" ${s.res == 1 ? 'selected' : ''}>100%</option><option value="0.8" ${s.res == 0.8 ? 'selected' : ''}>80%</option><option value="0.65" ${s.res == 0.65 ? 'selected' : ''}>65%</option><option value="0.5" ${s.res == 0.5 ? 'selected' : ''}>50%</option></select></div>
        <div class="set"><div>Schwierigkeit<small>Schaden, den du nimmst</small></div><select data-s="difficulty"><option value="0.6" ${s.difficulty == 0.6 ? 'selected' : ''}>Tourist</option><option value="1" ${s.difficulty == 1 ? 'selected' : ''}>Profi</option><option value="1.5" ${s.difficulty == 1.5 ? 'selected' : ''}>Meisterassassine</option></select></div>`;
      const b = !$('#title').classList.contains('hidden') ? this.titlePanel('EINSTELLUNGEN', h) : this.panel('EINSTELLUNGEN', h, 'settings');
      b.querySelectorAll('[data-t]').forEach((x) => (x.onclick = () => { s[x.dataset.t] = !s[x.dataset.t]; x.classList.toggle('on', s[x.dataset.t]); g.applySettings(); }));
      b.querySelectorAll('[data-r]').forEach((x) => (x.oninput = () => { s[x.dataset.r] = +x.value; g.applySettings(); }));
      b.querySelectorAll('[data-s]').forEach((x) => (x.onchange = () => { s[x.dataset.s] = +x.value; g.applySettings(); }));
    }
    pause() { if (this.g.world && !this.anyOpen()) { $('#pause').classList.remove('hidden'); this.sync(); } }
    pauseAction(a) {
      $('#pause').classList.add('hidden'); this.sync();
      if (a === 'save') { if (this.g.save()) this.g.ui.toast('GESPEICHERT'); }
      if (a === 'settings') this.settings();
      if (a === 'controls') this.controls();
      if (a === 'title') this.g.toTitle();
    }
    escape() {
      if (this.g.world && this.g.world.placing && $('#panel').classList.contains('hidden') && $('#phone').classList.contains('hidden')) { this.g.world.cancelPlace(); return; }
      if (this.backToTitle && !$('#panel').classList.contains('hidden')) { this.closePanel(); this.backToTitle = false; $('#title').classList.remove('hidden'); this.sync(); return; }
      if (!$('#result').classList.contains('hidden') || !$('#dead').classList.contains('hidden') || !$('#title').classList.contains('hidden')) return;
      if (!$('#phone').classList.contains('hidden')) return this.closePhone();
      if (!$('#panel').classList.contains('hidden')) return this.closePanel();
      if (!$('#mapview').classList.contains('hidden')) return this.closeMap();
      if (!$('#pause').classList.contains('hidden')) { $('#pause').classList.add('hidden'); this.sync(); return; }
      this.pause();
    }
    showResult(e) {
      const el = $('#result');
      const c = e.c;
      el.innerHTML = `<div class="res-box"><div class="k">AUFTRAG ABGESCHLOSSEN</div><h1>${esc(e.rating)}</h1><h3>${esc(c.name)} · ${esc(c.title)}</h3>
        ${e.lines.map((l, i) => `<div class="ln ${l.bonus && !l.ok ? 'no' : ''} ${l.v < 0 ? 'neg' : ''}" style="animation-delay:${0.25 + i * 0.22}s"><span>${l.bonus ? (l.ok ? '✔ ' : '✕ ') : ''}${esc(l.t)}</span><b>${l.v < 0 ? '−' + U.money(-l.v) : U.money(l.v)}</b></div>`).join('')}
        <div class="tot"><span>AUSZAHLUNG</span><span>${U.money(e.pay)}</span></div><div style="color:#9fd2ff;margin-top:6px;font-family:Oswald">+${e.xp} XP</div>
        <div class="btns" style="justify-content:center;margin-top:20px"><button class="btn red" id="res-ok">Weiter</button></div></div>`;
      el.classList.remove('hidden'); this.sync();
      el.querySelector('#res-ok').onclick = () => { el.classList.add('hidden'); this.sync(); this.g.save(true); };
    }
    showDead(e) {
      const el = $('#dead');
      const why = { bullet: 'Erschossen', melee: 'Erstochen', fist: 'Totgeprügelt', explosion: 'In die Luft gesprengt', car: 'Überfahren', bleed: 'Verblutet', hunger: 'Verhungert', thirst: 'Verdurstet' }[e.kind] || 'Ausgeschaltet';
      el.innerHTML = `<div class="res-box"><div class="k">KRÄHENBURG VERGISST NIEMANDEN</div><h1>${why.toUpperCase()}</h1><h3>Du wachst in der St. Marien Klinik auf.</h3><p style="color:#999;font-size:13px">Die Klinik berechnet 15% deines Bargelds. Bei Fahndung ab 2 Sternen beschlagnahmt die Polizei deine Schusswaffen.</p><div class="btns" style="justify-content:center;margin-top:16px"><button class="btn red" id="dead-ok">Aufwachen</button></div></div>`;
      el.classList.remove('hidden'); this.sync();
      el.querySelector('#dead-ok').onclick = () => { el.classList.add('hidden'); this.g.world.respawnAtHospital(); this.sync(); this.g.fadeIn(); };
    }
    showArrest(e) {
      const el = $('#dead');
      el.innerHTML = `<div class="res-box"><div class="k">POLIZEIREVIER KRÄHENBURG</div><h1 style="color:#6fa8ff">VERHAFTET</h1><h3>Eine Nacht in der Zelle.</h3><div class="ln" style="animation-delay:.2s"><span>Geldstrafe</span><b>−${U.money(e.fine)}</b></div><div class="ln" style="animation-delay:.4s"><span>Beschlagnahmte Schusswaffen</span><b>${e.lost}</b></div><div class="btns" style="justify-content:center;margin-top:16px"><button class="btn" id="dead-ok">Entlassen</button></div></div>`;
      el.classList.remove('hidden'); this.sync();
      el.querySelector('#dead-ok').onclick = () => { el.classList.add('hidden'); this.sync(); this.g.fadeIn(); };
    }
  }
  K.Menus = Menus;
})(globalThis.K = globalThis.K || {});
