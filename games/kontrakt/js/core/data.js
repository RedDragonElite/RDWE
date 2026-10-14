/* RDE // KONTRAKT — game data: tiles, weapons, items, outfits, shops, buildings, skills */
(function (K) {
  'use strict';

  // ------------------------------------------------------------------ tiles
  const T = K.T = {
    WATER: 0, ROAD: 1, WALK: 2, GRASS: 3, PLAZA: 4, WOOD: 5, TILEF: 6, CARPET: 7, CONC: 8, MARBLE: 9,
    WALL: 10, WINDOW: 11, DOOR: 12, FENCE: 13, DIRT: 14, DOCK: 15, QUAY: 16, PARK: 17, HEDGE: 18, SAND: 19, POOL: 20, GATE: 21,
  };
  // flags: 1 solid for walking, 2 opaque (blocks sight), 4 stops bullets, 8 interior floor, 16 water
  const F = K.TF = new Uint8Array(32);
  F[T.WATER] = 1 | 16; F[T.POOL] = 1 | 16;
  F[T.WALL] = 1 | 2 | 4; F[T.WINDOW] = 1; F[T.FENCE] = 1; F[T.HEDGE] = 1 | 2; F[T.GATE] = 0;
  for (const t of [T.WOOD, T.TILEF, T.CARPET, T.CONC, T.MARBLE]) F[t] = 8;
  F[T.DOOR] = 8;

  // ------------------------------------------------------------------ weapons
  // dmg per hit/pellet · rate = seconds between shots · spread rad · noise = hearing radius in tiles
  K.WEAPONS = {
    fists:    { name: 'Fäuste', type: 'fist', dmg: 13, range: 30, arc: 1.1, rate: 0.3, noise: 5, w: 0 },
    wire:     { name: 'Klaviersaite', type: 'wire', dmg: 0, range: 26, rate: 0.5, noise: 0, w: 0.1, price: 400, desc: 'Lautlose Takedowns von hinten [F]. Keine Blutspur.' },
    knife:    { name: 'Kampfmesser', type: 'melee', dmg: 42, range: 34, arc: 1.1, rate: 0.36, noise: 2, bleed: 1, sharp: true, w: 0.3, price: 350 },
    bat:      { name: 'Baseballschläger', type: 'melee', dmg: 32, range: 44, arc: 1.6, rate: 0.62, noise: 6, blunt: true, w: 1, price: 120 },
    crowbar:  { name: 'Brecheisen', type: 'melee', dmg: 36, range: 40, arc: 1.4, rate: 0.6, noise: 6, blunt: true, w: 1.5, price: 90, desc: 'Knackt Türen schneller.' },
    machete:  { name: 'Machete', type: 'melee', dmg: 58, range: 42, arc: 1.5, rate: 0.55, noise: 4, bleed: 2, sharp: true, w: 0.9, price: 650 },
    katana:   { name: 'Katana', type: 'melee', dmg: 85, range: 50, arc: 1.9, rate: 0.5, noise: 4, bleed: 3, sharp: true, w: 1.2, price: 4800 },
    syringe:  { name: 'Giftspritze', type: 'syringe', lethal: true, dmg: 0, range: 28, rate: 0.6, noise: 0, w: 0.1, price: 1800, consumable: true, desc: 'Tötet lautlos nach Sekunden. Zählt als Unfall.' },
    sedative: { name: 'Betäubungsspritze', type: 'syringe', lethal: false, dmg: 0, range: 28, rate: 0.6, noise: 0, w: 0.1, price: 450, consumable: true, desc: 'Schickt jeden sofort schlafen.' },
    p9:       { name: 'P9 Kompakt', type: 'gun', ammo: '9mm', mag: 15, dmg: 30, rate: 0.17, spread: 0.045, reload: 1.3, speed: 1900, noise: 24, recoil: 0.05, w: 0.8, price: 900, canSup: true, cls: 'pistol' },
    silber:   { name: 'Silberbaron .45 SD', type: 'gun', ammo: '45', mag: 10, dmg: 50, rate: 0.24, spread: 0.022, reload: 1.4, speed: 2000, noise: 24, recoil: 0.07, w: 1.1, price: 7800, sup: true, canSup: true, cls: 'pistol', desc: 'Die Signatur. Werkseitig schallgedämpft.' },
    magnum:   { name: 'Magnum .357', type: 'gun', ammo: '357', mag: 6, dmg: 78, rate: 0.48, spread: 0.035, reload: 2.1, speed: 2200, noise: 30, recoil: 0.16, w: 1.3, price: 2400, cls: 'pistol' },
    mpk:      { name: 'MP-K', type: 'gun', ammo: '9mm', mag: 30, dmg: 24, rate: 0.072, spread: 0.075, reload: 1.8, speed: 1900, noise: 26, recoil: 0.035, auto: true, w: 2.4, price: 4200, canSup: true, cls: 'smg' },
    pump:     { name: 'Pump-12', type: 'gun', ammo: '12g', mag: 6, dmg: 17, pellets: 9, rate: 0.85, spread: 0.2, reload: 0.42, perShell: true, speed: 1600, noise: 34, recoil: 0.22, w: 3.4, price: 3600, cls: 'shotgun', falloff: 0.55 },
    k47:      { name: 'K-47 Sturmgewehr', type: 'gun', ammo: '762', mag: 30, dmg: 40, rate: 0.1, spread: 0.055, reload: 2.2, speed: 2300, noise: 34, recoil: 0.06, auto: true, w: 3.6, price: 9500, canSup: true, cls: 'rifle' },
    jaeger:   { name: 'Jäger 700', type: 'gun', ammo: '308', mag: 5, dmg: 170, rate: 1.25, spread: 0.004, reload: 2.6, speed: 3200, noise: 38, recoil: 0.25, scope: true, w: 4.5, price: 16000, canSup: true, cls: 'sniper', pierce: 1 },
    coin:     { name: 'Münze', type: 'throw', rate: 0.5, noise: 7, w: 0.01, price: 1, stack: true, consumable: true, desc: 'Werfen lenkt ab. Wachen gehen nachsehen.' },
    grenade:  { name: 'Granate', type: 'throw', explosive: true, rate: 0.9, noise: 45, w: 0.4, price: 900, consumable: true },
    c4:       { name: 'C4-Sprengladung', type: 'throw', place: true, explosive: true, rate: 0.6, noise: 50, w: 0.6, price: 2500, consumable: true, desc: 'Platzieren, mit [G] fernzünden.' },
  };
  for (const k in K.WEAPONS) K.WEAPONS[k].id = k;

  K.AMMO = {
    '9mm': { name: '9mm', box: 30, price: 45 },
    '45': { name: '.45 ACP', box: 20, price: 70 },
    '357': { name: '.357 Mag', box: 12, price: 80 },
    '12g': { name: 'Kaliber 12', box: 12, price: 60 },
    '762': { name: '7.62mm', box: 30, price: 120 },
    '308': { name: '.308 Win', box: 10, price: 160 },
  };

  // ------------------------------------------------------------------ items
  // food/water/energy deltas in %, hp heal, drunk 0..1
  K.ITEMS = {
    apple:    { name: 'Apfel', e: '🍎', food: 10, water: 4, price: 2, w: 0.2 },
    sandwich: { name: 'Sandwich', e: '🥪', food: 28, price: 6, w: 0.3 },
    burger:   { name: 'Burger', e: '🍔', food: 40, water: -4, price: 9, w: 0.4 },
    doener:   { name: 'Döner', e: '🌯', food: 55, water: -6, price: 8, w: 0.5 },
    pizza:    { name: 'Pizza', e: '🍕', food: 35, price: 5, w: 0.4 },
    steak:    { name: 'Steak-Menü', e: '🍖', food: 70, hp: 10, price: 38, w: 0.6 },
    water:    { name: 'Wasser', e: '💧', water: 45, price: 2, w: 0.5 },
    cola:     { name: 'Cola', e: '🥤', water: 30, energy: 6, price: 3, w: 0.4 },
    coffee:   { name: 'Kaffee', e: '☕', water: 10, energy: 28, price: 4, w: 0.3 },
    energy:   { name: 'Energy-Drink', e: '⚡', water: 20, energy: 40, hp: -2, price: 6, w: 0.4 },
    beer:     { name: 'Bier', e: '🍺', water: 15, drunk: 0.22, price: 4, w: 0.5 },
    whiskey:  { name: 'Whiskey', e: '🥃', water: 5, drunk: 0.45, energy: -5, price: 28, w: 0.8 },
    bandage:  { name: 'Verband', g: 'bandage', hp: 15, stopBleed: true, price: 25, w: 0.1 },
    medkit:   { name: 'Medkit', g: 'medkit', hp: 65, stopBleed: true, price: 180, w: 0.8 },
    pills:    { name: 'Schmerzmittel', e: '💊', painkiller: 300, hp: 5, price: 60, w: 0.1, desc: '-30% Schaden für 5 Min.' },
    vest:     { name: 'Schutzweste', g: 'vest', armor: 100, price: 1500, w: 3, desc: 'Fängt Kugeln ab.' },
    lockpick: { name: 'Dietrich', g: 'lockpick', price: 150, w: 0.05, desc: 'Öffnet verschlossene Türen [E halten].' },
    flashlight: { name: 'Taschenlampe', e: '🔦', price: 40, w: 0.3, desc: '[L] schaltet sie ein.' },
    silencer: { name: 'Schalldämpfer', g: 'silencer', price: 2200, w: 0.3, desc: 'Benutzen: montiert auf die aktive Waffe (P9, MP-K, K-47, Jäger).' },
    wallet:   { name: 'Brieftasche', e: '👛', price: 0, w: 0.1, sellOnly: true },
    watch:    { name: 'Goldene Uhr', e: '⌚', price: 0, sell: 450, w: 0.1, sellOnly: true },
    keycard:  { name: 'Schlüsselkarte', g: 'keycard', price: 0, w: 0.01, quest: true },
  };
  for (const k in K.ITEMS) K.ITEMS[k].id = k;

  // ------------------------------------------------------------------ outfits / disguises
  // role → which restricted zones accept it · enforcer: NPC kind that can see through it
  K.OUTFITS = {
    suit:     { name: 'Anzug „Kontrakt“', body: '#141519', trim: '#c8102e', pants: '#0d0e11', role: 'civ', price: 0, sig: true },
    suitgrey: { name: 'Anzug Grau', body: '#5b6068', trim: '#2b2f37', pants: '#3a3e45', role: 'civ', price: 900 },
    casual:   { name: 'Freizeit', body: '#3f5d7a', trim: '#e6e1d5', pants: '#2e3542', role: 'civ', price: 120 },
    hoodie:   { name: 'Hoodie', body: '#2b2d31', trim: '#77797f', pants: '#1f2a3a', role: 'civ', hood: true, price: 90 },
    leather:  { name: 'Lederjacke', body: '#3a2418', trim: '#b8b0a2', pants: '#222', role: 'civ', price: 480 },
    tux:      { name: 'Smoking', body: '#0a0a0c', trim: '#f2f2f2', pants: '#0a0a0c', role: 'vip', price: 2600, desc: 'Lässt dich in den Club-VIP-Bereich.' },
    police:   { name: 'Polizei', body: '#1d3567', trim: '#d4af37', pants: '#16213b', hat: 'cap', hatC: '#12244a', role: 'police', disguise: true },
    guard:    { name: 'Sicherheitsdienst', body: '#25272b', trim: '#e0b000', pants: '#1a1b1e', role: 'guard', disguise: true, hat: 'ear' },
    waiter:   { name: 'Kellner', body: '#efefea', trim: '#111', pants: '#141414', role: 'staff', disguise: true },
    chef:     { name: 'Koch', body: '#f4f4f0', trim: '#888', pants: '#2a2a2a', hat: 'chef', hatC: '#fff', role: 'staff', disguise: true },
    worker:   { name: 'Bauarbeiter', body: '#ff7a00', trim: '#e9ff3a', pants: '#2c3b55', hat: 'hard', hatC: '#ffd400', role: 'worker', disguise: true },
    doctor:   { name: 'Arzt', body: '#e9f3f6', trim: '#2aa1b8', pants: '#99b9c4', role: 'medic', disguise: true },
    gang:     { name: 'Hafen-Crew', body: '#5b0f14', trim: '#111', pants: '#1b1b1b', hat: 'band', hatC: '#b3121b', role: 'gang', disguise: true },
    bouncer:  { name: 'Türsteher', body: '#111', trim: '#555', pants: '#111', role: 'guard', disguise: true, hat: 'ear' },
    under:    { name: 'Unterwäsche', body: '#d8cfc0', trim: '#d8cfc0', pants: '#a7b4c6', role: 'none', bare: true },
    // civilian looks
    civ1: { body: '#7a3b3b', trim: '#ddd', pants: '#333a46', role: 'civ' },
    civ2: { body: '#3b6b4f', trim: '#e8e2cf', pants: '#4b4237', role: 'civ' },
    civ3: { body: '#8a7350', trim: '#3b2f22', pants: '#2b2b2b', role: 'civ' },
    civ4: { body: '#56487a', trim: '#cfcfe8', pants: '#252836', role: 'civ' },
    civ5: { body: '#b0a99f', trim: '#504a42', pants: '#3e4d63', role: 'civ' },
    civ6: { body: '#a0475f', trim: '#f1d6de', pants: '#2d2d33', role: 'civ', dress: true },
    civ7: { body: '#2f7f8f', trim: '#e9f2f3', pants: '#1f262e', role: 'civ' },
    civ8: { body: '#c9a227', trim: '#3b3018', pants: '#3a3f4a', role: 'civ', dress: true },
    rich: { body: '#d8d2c4', trim: '#7a1420', pants: '#c8c0b0', role: 'vip' },
  };
  for (const k in K.OUTFITS) K.OUTFITS[k].id = k;
  K.CIV_OUTFITS = ['civ1', 'civ2', 'civ3', 'civ4', 'civ5', 'civ6', 'civ7', 'civ8', 'casual', 'hoodie', 'leather', 'suitgrey'];
  K.SKINS = ['#f1c9a5', '#e0ac85', '#c68863', '#9a6544', '#6e4430', '#f5d6bf', '#d9a07a'];
  K.HAIR = ['#1b1410', '#3a2618', '#6b4423', '#a8743a', '#d9c08a', '#8c8c8c', '#e6e6e6', '#7a2a1a', null];

  // ------------------------------------------------------------------ shops
  K.SHOPS = {
    gun: { name: 'Waffen Krause & Söhne', open: [9, 21], keeper: 'guard', items: ['p9', 'magnum', 'mpk', 'pump', 'k47', 'knife', 'bat', 'crowbar', 'machete', 'a:9mm', 'a:45', 'a:357', 'a:12g', 'a:762', 'vest', 'silencer'] },
    black: { name: 'Schwarzmarkt „Der Kran“', open: [20, 6], keeper: 'gang', buysAll: true, items: ['silber', 'jaeger', 'katana', 'wire', 'syringe', 'sedative', 'c4', 'grenade', 'lockpick', 'a:45', 'a:308', 'a:762', 'o:police', 'o:guard', 'silencer'] },
    food: { name: 'Späti 24/7', open: [0, 24], keeper: 'civ', items: ['apple', 'sandwich', 'pizza', 'water', 'cola', 'coffee', 'energy', 'beer', 'coin', 'flashlight', 'bandage'] },
    pharmacy: { name: 'Stadt-Apotheke', open: [7, 22], keeper: 'medic', items: ['bandage', 'medkit', 'pills', 'energy', 'water', 'sedative'] },
    cloth: { name: 'Boutique Noir', open: [10, 20], keeper: 'civ', items: ['o:suitgrey', 'o:casual', 'o:hoodie', 'o:leather', 'o:tux', 'o:suit'] },
    diner: { name: 'Diner „Zur Laterne“', open: [6, 23], keeper: 'staff', eat: true, items: ['burger', 'steak', 'doener', 'pizza', 'coffee', 'cola', 'water'] },
    bar: { name: 'Bar „Blauer Engel“', open: [17, 4], keeper: 'staff', eat: true, items: ['beer', 'whiskey', 'cola', 'water', 'sandwich'] },
    hospital: { name: 'St. Marien Klinik', open: [0, 24], keeper: 'medic', heal: 250, items: ['medkit', 'bandage', 'pills'] },
  };

  // ------------------------------------------------------------------ buildings
  // floor, roof style, restricted roles
  K.BTYPES = {
    house:     { name: 'Wohnhaus', floor: 'WOOD', roof: 'gable', colors: ['#7a3b2e', '#5a4a3c', '#3e4a5a', '#6b2f2f', '#4a5a3a'] },
    flat:      { name: 'Mietshaus', floor: 'WOOD', roof: 'flat', colors: ['#5c5a55', '#4b4f56', '#6b625a'] },
    office:    { name: 'Bürohaus', floor: 'CARPET', roof: 'flat', colors: ['#3a4048', '#2f353d', '#454b54'], restricted: ['guard', 'worker', 'police'] },
    hotel:     { name: 'Grand Hotel Meridian', floor: 'MARBLE', roof: 'flat', colors: ['#5a4630'], restricted: ['staff', 'guard'] },
    villa:     { name: 'Villa', floor: 'MARBLE', roof: 'hip', colors: ['#8c3a24', '#7a2f1f'], restricted: ['guard', 'staff'] },
    warehouse: { name: 'Lagerhalle', floor: 'CONC', roof: 'metal', colors: ['#4c5560', '#5d4a3a', '#3f4c45'], restricted: ['gang', 'worker'] },
    police:    { name: 'Polizeirevier', floor: 'TILEF', roof: 'flat', colors: ['#2b3a55'], restricted: ['police'] },
    hospital:  { name: 'St. Marien Klinik', floor: 'TILEF', roof: 'flat', colors: ['#d9d9d4'], shop: 'hospital' },
    gun:       { name: 'Waffen Krause & Söhne', floor: 'CONC', roof: 'flat', colors: ['#3d3a35'], shop: 'gun' },
    food:      { name: 'Späti 24/7', floor: 'TILEF', roof: 'flat', colors: ['#4a5a4a'], shop: 'food' },
    pharmacy:  { name: 'Stadt-Apotheke', floor: 'TILEF', roof: 'flat', colors: ['#3d5a52'], shop: 'pharmacy' },
    cloth:     { name: 'Boutique Noir', floor: 'MARBLE', roof: 'flat', colors: ['#2a2a30'], shop: 'cloth' },
    diner:     { name: 'Diner „Zur Laterne“', floor: 'TILEF', roof: 'flat', colors: ['#6b3a2a'], shop: 'diner', restricted: ['staff'] },
    bar:       { name: 'Bar „Blauer Engel“', floor: 'WOOD', roof: 'gable', colors: ['#2a3550'], shop: 'bar' },
    club:      { name: 'Club „Nachtfalter“', floor: 'CONC', roof: 'flat', colors: ['#24182e'], restricted: ['guard', 'vip', 'staff'] },
    black:     { name: 'Hafenschuppen', floor: 'CONC', roof: 'metal', colors: ['#3b3226'], shop: 'black' },
  };

  // purchasable properties (assigned to buildings by citygen)
  K.PROPERTIES = [
    { id: 'bude', name: 'Bude Altstadt', price: 0, btype: 'house', district: 'old', income: 0, start: true, desc: 'Deine Absteige. Klein, ehrlich, mit Bett.' },
    { id: 'altbau', name: 'Altbauwohnung Kanalstraße', price: 18000, btype: 'house', district: 'res', income: 0, desc: 'Großes Bett, große Waffenkammer.' },
    { id: 'loft', name: 'Penthouse-Loft Mitte', price: 65000, btype: 'flat', district: 'down', income: 0, desc: 'Skyline, Marmor, Stil.' },
    { id: 'lager', name: 'Lagerhalle Kai 3', price: 42000, btype: 'warehouse', district: 'docks', income: 400, desc: 'Versteck + Schmuggel-Einnahmen 400$/Tag.' },
    { id: 'barkauf', name: 'Bar „Blauer Engel“', price: 90000, btype: 'bar', district: 'old', income: 1500, desc: 'Gehört dir die Bar, gehört dir die Nacht. +1.500$/Tag.' },
    { id: 'villa', name: 'Villa Sonnenhang', price: 240000, btype: 'villa', district: 'hill', income: 0, desc: 'Das Endgame. Pool, Personal, Ruhe.' },
  ];

  // ------------------------------------------------------------------ skills
  K.SKILLS = {
    stealth: { name: 'Schleichen', e: '👣', desc: '-12% Entdeckung, leisere Schritte' },
    marksman: { name: 'Schütze', e: '🎯', desc: '-10% Streuung, +8% Nachladetempo' },
    melee: { name: 'Nahkampf', e: '👊', desc: '+15% Nahkampfschaden, schnellere Takedowns' },
    fitness: { name: 'Kondition', e: '❤', desc: '+10 Max-HP, +15% Ausdauer' },
    disguise: { name: 'Tarnung', e: '🎭', desc: 'Verkleidungen halten länger, -4% Ladenpreise' },
    survival: { name: 'Überleben', e: '🌿', desc: '-10% Hunger/Durst, schnellere Heilung' },
  };

  // ------------------------------------------------------------------ contracts
  K.PROFESSIONS = [
    { t: 'Bankier', o: 'suitgrey', hat: null, place: ['office', 'hotel', 'villa'], d: 'wäscht Geld für drei Kartelle und hat einen Zeugen verschwinden lassen.' },
    { t: 'Kunsthändler', o: 'rich', place: ['hotel', 'club', 'villa'], d: 'verkauft gestohlene Meisterwerke – und Menschen.' },
    { t: 'Korrupter Kommissar', o: 'police', place: ['police', 'bar', 'diner'], d: 'deckt den Hafenschmuggel und hat einen Informanten verraten.' },
    { t: 'Waffenhändler', o: 'leather', place: ['warehouse', 'black', 'bar'], d: 'beliefert beide Seiten eines Bürgerkriegs.' },
    { t: 'Clubbesitzer', o: 'tux', place: ['club', 'bar', 'villa'], d: 'führt hinter dem Tanzsaal ein Erpressungsimperium.' },
    { t: 'Politikerin', o: 'suitgrey', place: ['office', 'hotel', 'diner'], d: 'hat die Wahl gekauft – und den Auftraggeber verraten.' },
    { t: 'Hacker', o: 'hoodie', place: ['flat', 'diner', 'food'], d: 'hat die Liste aller Agenten der Zentrale gestohlen.' },
    { t: 'Chefkoch', o: 'chef', place: ['diner', 'hotel', 'club'], d: 'vergiftet Rivalen seines Bosses – nun ist er selbst dran.' },
    { t: 'Hafenboss', o: 'gang', place: ['warehouse', 'black', 'bar'], d: 'kontrolliert jeden Container, der die Stadt betritt.' },
    { t: 'Chirurg', o: 'doctor', place: ['hospital', 'villa', 'diner'], d: 'handelt mit Organen von Obdachlosen.' },
  ];
  K.BONUSES = [
    { id: 'silent', name: 'Lautloser Assassine', desc: 'Nie entdeckt, keine Leiche gefunden', v: 0.5 },
    { id: 'onlytarget', name: 'Nur das Ziel', desc: 'Keine anderen Toten', v: 0.25 },
    { id: 'accident', name: 'Tragischer Unfall', desc: 'Mit Giftspritze erledigt', v: 0.4 },
    { id: 'weapon', name: 'Signaturwaffe', desc: 'Mit vorgegebener Waffe', v: 0.3 },
    { id: 'headshot', name: 'Präzision', desc: 'Kopfschuss', v: 0.2 },
    { id: 'disguise', name: 'Im Kostüm', desc: 'In Verkleidung getötet', v: 0.2 },
  ];
})(globalThis.K = globalThis.K || {});
