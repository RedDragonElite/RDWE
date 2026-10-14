/* RDE // KONTRAKT — menus: phone apps, inventory, shops, stash, wardrobe, sleep, map, title, pause, results */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE, W8 = K.WEAPONS;
  const $ = (s) => document.querySelector(s);
  const esc = U.esc;
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
      } else if (app === 'map') { this.closePhone(); this.openMap(); return; }
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
    closePanel() { $('#panel').classList.add('hidden'); this.panelKind = null; this.sync(); }
    openFromWorld(e) {
      if (e.open === 'shop') this.shop(e.shop, e.b);
      else if (e.open === 'stash') this.stash(e.prop);
      else if (e.open === 'wardrobe') this.wardrobe();
      else if (e.open === 'sleep') this.sleep(e.prop);
      else if (e.open === 'property') this.property(e.id);
      else if (e.open === 'bank') this.bank();
      else if (e.open === 'recruit') this.recruit();
      else if (e.open === 'crew') this.crew();
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
      h += '</div>';
      const body = this.panel('CREW ANHEUERN', h, 'recruit');
      this.drawCrewPics(body, [...offers, ...R]);
      body.querySelectorAll('[data-hire]').forEach((b) => (b.onclick = () => { w.hireCrew(+b.dataset.hire); this.recruit(); }));
      this.bindRoster(body, () => this.recruit());
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
      let h = `<div class="sec">Befehle <small>[V] im Spiel: Ziel unterm Fadenkreuz angreifen</small></div><div class="btns cmdrow">
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
      const w = this.g.world, P = w.P;
      const wl = w.carried(), lim = w.weightLimit();
      let h = `<div class="cols"><div><div class="sec">Waffen <small>1–9 wählen</small></div><div class="list">`;
      P.weapons.forEach((x, i) => {
        const d = W8[x.id];
        const am = d.type === 'gun' ? `${x.mag}/${P.ammo[d.ammo] || 0}${x.sup ? ' · gedämpft' : ''}` : x.n ? `×${x.n}` : '';
        h += `<div class="it ${i === P.slot ? 'on' : ''}"><div class="ic">${icon(x.id)}</div><div class="nm">${i + 1}. ${esc(d.name)}<small>${esc(am)} ${d.desc ? '· ' + esc(d.desc) : ''}</small></div>${i ? `<button class="btn ghost" data-eq="${i}">Wählen</button><button class="btn ghost" data-dropw="${i}">Ablegen</button>` : ''}</div>`;
      });
      h += `</div><div class="sec" style="margin-top:14px">Munition</div><div class="list">`;
      const cals = Object.keys(P.ammo).filter((k) => P.ammo[k] > 0);
      h += cals.length ? cals.map((k) => `<div class="it"><div class="ic">${icon('a:' + k)}</div><div class="nm">${K.AMMO[k].name}</div><div class="q">${P.ammo[k]}</div></div>`).join('') : '<div class="it"><div class="nm"><small>Keine Munition.</small></div></div>';
      h += `</div></div><div><div class="sec">Gegenstände <small>${wl.toFixed(1)} / ${lim} kg</small></div><div class="list">`;
      const keys = Object.keys(P.inv);
      if (!keys.length) h += '<div class="it"><div class="nm"><small>Leer.</small></div></div>';
      for (const k of keys) {
        const it = K.ITEMS[k];
        const usable = !it.sellOnly && !it.quest && k !== 'lockpick';
        const stats = [it.food ? `Hunger +${it.food}` : '', it.water ? `Durst +${it.water}` : '', it.energy ? `Energie +${it.energy}` : '', it.hp ? `HP +${it.hp}` : '', it.desc || ''].filter(Boolean).join(' · ');
        h += `<div class="it"><div class="ic">${icon(k)}</div><div class="nm">${esc(it.name)}<small>${esc(stats)}</small></div><div class="q">×${P.inv[k]}</div>${usable ? `<button class="btn" data-use="${k}">${k === 'mask' ? (P.masked ? 'Abnehmen' : 'Aufsetzen') : k === 'growkit' || k === 'seed' ? 'Pflanzen' : k === 'bud' ? 'Rauchen' : 'Benutzen'}</button>` : ''}<button class="btn ghost" data-drop="${k}">✕</button></div>`;
      }
      h += `</div><div class="sec" style="margin-top:14px">Outfit</div><div class="it"><div class="ic">👔</div><div class="nm">${esc(K.OUTFITS[P.outfit].name)}<small>${K.OUTFITS[P.outfit].disguise ? 'Verkleidung — Zugang: ' + K.OUTFITS[P.outfit].role : 'Zivil'}</small></div></div>
        <div class="sec" style="margin-top:14px">Status</div>
        <div class="stat"><span>Gesundheit</span><b>${Math.ceil(w.player.hp)} / ${w.maxHp()}</b></div><div class="stat"><span>Hunger · Durst · Energie</span><b>${Math.round(P.hunger)}% · ${Math.round(P.thirst)}% · ${Math.round(P.energy)}%</b></div><div class="stat"><span>Weste</span><b>${Math.round(w.player.armor)}%</b></div></div></div>`;
      const b = this.panel('INVENTAR', h, 'inv');
      b.querySelectorAll('[data-use]').forEach((x) => (x.onclick = () => { w.useItem(x.dataset.use); this.inventory(); }));
      b.querySelectorAll('[data-drop]').forEach((x) => (x.onclick = () => { const k = x.dataset.drop; if (w.takeItem(k)) w.dropItem({ kind: 'item', item: k }, w.player.x + U.rnd(-10, 10), w.player.y + U.rnd(-10, 10)); this.inventory(); }));
      b.querySelectorAll('[data-eq]').forEach((x) => (x.onclick = () => { P.slot = +x.dataset.eq; w.player.wi = w.curWeapon(); this.inventory(); }));
      b.querySelectorAll('[data-dropw]').forEach((x) => (x.onclick = () => { const i = +x.dataset.dropw, wi = P.weapons[i]; w.dropItem({ kind: 'weapon', wid: wi.id, mag: wi.mag, sup: wi.sup }, w.player.x + U.rnd(-10, 10), w.player.y + U.rnd(-10, 10)); w.removeWeaponAt(i); this.inventory(); }));
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
      b.querySelectorAll('[data-sw]').forEach((x) => (x.onclick = () => { const i = +x.dataset.sw, wp = S.weapons[i]; if (P.weapons.length >= 9) return w.notify('Kein Platz mehr.', 'bad'); const d = W8[wp.id]; if (!d.stack && !d.consumable && P.weapons.some((q) => q.id === wp.id)) return w.notify('Hast du schon dabei.', 'bad'); if (d.stack || d.consumable) w.addWeapon(wp.id, { n: wp.n }); else P.weapons.push(wp); S.weapons.splice(i, 1); re(); }));
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
    openMap() { this.closePhone(); this.closePanel(); $('#mapview').classList.remove('hidden'); this.sync(); requestAnimationFrame(() => this.drawMap()); }
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
      x.fillStyle = '#08090c'; x.fillRect(0, 0, cv.width, cv.height);
      x.imageSmoothingEnabled = false; x.drawImage(ui.mapTex, ox, oy, w.W * s, w.H * s); x.imageSmoothingEnabled = true;
      const toM = (wx, wy) => [ox + wx / TILE * s, oy + wy / TILE * s];
      // district labels
      x.font = `600 ${Math.round(s * 3)}px Oswald, sans-serif`; x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,0.35)';
      const seen = new Set();
      for (const bl of w.city.blocks) { if (seen.has(bl.d)) continue; seen.add(bl.d); const [mx, my] = toM((bl.ox + 11) * TILE, (bl.oy + 11) * TILE); x.fillText(K.DISTRICTS[bl.d].toUpperCase(), mx, my); }
      x.font = `${Math.round(s * 4.2)}px sans-serif`; x.textBaseline = 'middle';
      for (const q of ui.poiIcons()) { const [mx, my] = toM(q.x, q.y); x.fillText(q.e, mx, my); }
      const c = w.contract, tgt = w.targetActor();
      if (c && tgt) {
        if (c.intel) { const [mx, my] = toM(tgt.x, tgt.y); x.fillStyle = '#ff2030'; x.beginPath(); x.arc(mx, my, s * 2, 0, 6.3); x.fill(); }
        else if (c.ping) { const [mx, my] = toM(c.ping.x, c.ping.y); x.strokeStyle = '#ff2030'; x.fillStyle = 'rgba(255,32,48,.2)'; x.lineWidth = 3; x.beginPath(); x.arc(mx, my, s * 8, 0, 6.3); x.fill(); x.stroke(); }
      }
      if (this.g.waypoint) { const [mx, my] = toM(this.g.waypoint.x, this.g.waypoint.y); x.strokeStyle = '#ffd34d'; x.lineWidth = 4; x.beginPath(); x.arc(mx, my, s * 2.5, 0, 6.3); x.stroke(); }
      const p = w.player; const [px, py] = toM(p.x, p.y);
      x.save(); x.translate(px, py); x.rotate(p.angle); x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 3; x.beginPath(); x.moveTo(s * 3, 0); x.lineTo(-s * 2, -s * 2); x.lineTo(-s, 0); x.lineTo(-s * 2, s * 2); x.closePath(); x.stroke(); x.fill(); x.restore();
      $('#mv-legend').innerHTML = '🏠 Dein Besitz · 🏷️ Zu verkaufen<br>🔫 Waffen · 💀 Schwarzmarkt · 🛒 Späti<br>💊 Apotheke · 👔 Boutique · 🍔 Diner · 🍸 Bar<br>🏥 Klinik · 🚓 Polizei · 🎵 Club<br>🌱 Growshop · 🏧 Geldautomat · <span style="color:#ff2030">●</span> Ziel';
    }

    // ============================================================ title / pause / results
    controls() {
      const k = [['W A S D', 'Bewegen', 'Maus', 'Zielen / Blickrichtung'], ['Shift', 'Sprinten', 'LMB', 'Angriff / Schießen / Werfen'], ['C', 'Ducken (leiser, schwerer zu sehen)', 'RMB', 'Präzise zielen (Scope)'], ['E', 'Interagieren / Leiche ziehen', 'R', 'Nachladen'], ['F', 'Takedown von hinten / Auto', 'T', 'Verkleidung vom Körper nehmen'], ['Q (halten)', 'Instinkt: durch Wände sehen', 'G', 'C4 zünden'], ['1–9 / Mausrad', 'Waffe wählen', 'H', 'Waffe holstern'], ['TAB', 'Inventar', 'P', 'Handy (Aufträge, Profil…)'], ['M', 'Stadtkarte', 'L', 'Taschenlampe'], ['Z', 'Zoomstufe', 'ESC', 'Pause / Schließen'], ['Leertaste', 'Handbremse (Auto)', 'F11', 'Vollbild'], ['X', 'Ergeben (bei Fahndung)', 'K', 'Kaution zahlen (im Knast)'], ['RMB + Waffe auf Person', 'Überfall: Hände hoch!', 'E / T bei Passanten', 'Klauen, Ausrauben, Dealen'], ['B', 'Crew-Menü (Befehle, Formation, Haltung)', 'V', 'Crew: Ziel unterm Fadenkreuz angreifen'], ['E / T an Tresortür', 'Keycard / Thermobohrer (oder C4)', 'T an Vitrine', 'Juwelier: Vitrine einschlagen']];
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
      const h = `${tog('post', 'Post-FX (WebGL)', 'Bloom, Farbkorrektur, Chromatic Aberration, Film-Grain')}${tog('fov', 'Sichtfeld-Schatten', 'Nur was du siehst ist sichtbar — für Stealth')}${tog('gore', 'Blut & Gore', 'Blutspritzer, Lachen, Körperteile')}${tog('music', 'Dynamische Musik', 'Noir-Jazz, Spannung & Kampf passen sich an')}${tog('voice', 'NPC-Stimmen', 'Sprachausgabe für wichtige Rufe (Browser-TTS)')}${tog('barks', 'Sprechblasen', 'Was NPCs sagen')}${tog('weather', 'Wetter-Effekte', 'Regen, Nebel, Gewitter')}${tog('clouds', 'Wolkenschatten', '')}${tog('shake', 'Kamera-Wackeln', '')}
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
