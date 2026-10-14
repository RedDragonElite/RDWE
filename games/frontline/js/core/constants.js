/* RDE // FRONTLINE — NEXT GEN — shared constants & balancing (sim + client)
 * All economy numbers are PER TICK (10 ticks = 1 second) unless noted. */
(function (BW) {
  'use strict';

  const T = { DEEP: 0, SHALLOW: 1, BEACH: 2, PLAINS: 3, FOREST: 4, HILLS: 5, MOUNTAIN: 6, SNOW: 7 };

  BW.C = {
    VERSION: '2.0.0',
    TICK_MS: 100,
    SPAWN_TICKS: 120,
    WIN_SHARE: 0.8,
    WONDER_HOLD: 3000,      // hold a finished wonder 5 min → victory
    SPAWN_RADIUS: 4,
    START_TROOPS: 2500,
    MAX_BOATS: 3,
    DAY_TICKS: 2400,        // one day/night cycle = 4 min (visual only)
    T,
    TERRAIN: [
      { name: 'Tiefsee',   water: true,  cost: 0 },
      { name: 'Küste',     water: true,  cost: 0 },
      { name: 'Strand',    water: false, cost: 1.0 },
      { name: 'Ebene',     water: false, cost: 1.0 },
      { name: 'Wald',      water: false, cost: 1.35 },
      { name: 'Hügel',     water: false, cost: 1.7 },
      { name: 'Gebirge',   water: false, cost: 2.4 },
      { name: 'Gletscher', water: false, cost: 3.0 },
    ],

    GOLD: { e: '🪙', name: 'Gold' },
    // tradable resources (+ sci which is not tradable)
    RES: {
      food:    { e: '🌾', name: 'Nahrung',    price: 2 },
      wood:    { e: '🪵', name: 'Holz',       price: 3 },
      iron:    { e: '🔩', name: 'Eisen',      price: 7 },
      silver:  { e: '🥈', name: 'Silber',     price: 15 },
      gems:    { e: '💎', name: 'Edelsteine', price: 60 },
      oil:     { e: '🛢️', name: 'Öl',         price: 11 },
      uranium: { e: '☢️', name: 'Uran',       price: 45 },
      sci:     { e: '🧪', name: 'Forschung',  price: 0, noTrade: true },
    },
    TRADE_RES: ['food', 'wood', 'iron', 'silver', 'gems', 'oil', 'uranium'],

    // map deposits: res = what they yield (gold → p.gold)
    DEPOSITS: {
      iron:    { e: '🔩', name: 'Eisenerz',      res: 'iron',    yield: 0.05,  w: 28, on: [T.HILLS, T.MOUNTAIN] },
      silver:  { e: '🥈', name: 'Silberader',    res: 'silver',  yield: 0.03,  w: 18, on: [T.MOUNTAIN, T.HILLS] },
      gold:    { e: '🥇', name: 'Goldader',      res: 'gold',    yield: 0.9,   w: 14, on: [T.HILLS, T.PLAINS, T.BEACH] },
      gems:    { e: '💎', name: 'Edelsteinmine', res: 'gems',    yield: 0.008, w: 9,  on: [T.MOUNTAIN, T.SNOW, T.HILLS] },
      oil:     { e: '🛢️', name: 'Ölfeld',        res: 'oil',     yield: 0.04,  w: 18, on: [T.PLAINS, T.BEACH, T.FOREST] },
      uranium: { e: '☢️', name: 'Uranvorkommen', res: 'uranium', yield: 0.012, w: 9,  on: [T.HILLS, T.MOUNTAIN, T.SNOW] },
    },

    // cat: eco | mil | special.  scale: 'double' → ×2^n (max 16), number → ×(1 + n*scale)
    BUILD: {
      city:     { e: '🏙️', name: 'Stadt',       cat: 'eco', cost: { gold: 5000, wood: 30 },  scale: 'double', key: 'C', time: 60,
                  desc: '+25K max. Truppen · +10 🪙/s · +Forschung' },
      farm:     { e: '🌾', name: 'Farm',        cat: 'eco', cost: { gold: 1200, wood: 10 },  scale: 0.4, key: 'V', time: 30, terrain: [T.PLAINS, T.BEACH],
                  desc: '+2.5 🌾/s · nur auf Ebene' },
      sawmill:  { e: '🪓', name: 'Sägewerk',    cat: 'eco', cost: { gold: 1500 },            scale: 0.4, key: 'B', time: 30, terrain: [T.FOREST],
                  desc: '+3 🪵/s · nur im Wald' },
      mine:     { e: '⛏️', name: 'Mine',        cat: 'eco', cost: { gold: 3000, wood: 25 },  scale: 0.35, key: 'J', time: 50, deposit: ['iron', 'silver', 'gold', 'gems', 'uranium'],
                  desc: '×4 Ertrag einer Lagerstätte (🔩🥈🥇💎☢️)' },
      derrick:  { e: '⛽', name: 'Bohrturm',    cat: 'eco', cost: { gold: 4000, iron: 15 },  scale: 0.35, key: 'O', time: 50, deposit: ['oil'],
                  desc: '×4 Ertrag eines Ölfelds' },
      port:     { e: '⚓', name: 'Hafen',       cat: 'eco', cost: { gold: 4000, wood: 40 },  scale: 'double', key: 'H', time: 50, coastal: true,
                  desc: '+30 🪙/s · Handelsschiffe · schnellere Boote' },
      market:   { e: '🏪', name: 'Markt',       cat: 'eco', cost: { gold: 6000, wood: 40 },  scale: 0.6, key: 'K', time: 60,
                  desc: '+20 🪙/s · Börsengebühr 25% → 12%' },
      bank:     { e: '🏦', name: 'Bank',        cat: 'eco', cost: { gold: 10000, silver: 30 }, scale: 0.6, key: 'Y', time: 80,
                  desc: 'Zinsen auf dein Gold (max. 300 🪙/s je Bank)' },
      fort:     { e: '🏰', name: 'Festung',     cat: 'mil', cost: { gold: 2500, iron: 10 },  scale: 1, key: 'F', time: 40, radius: 11,
                  desc: 'Angreifer zahlen 2.5× im Umkreis' },
      barracks: { e: '⛺', name: 'Kaserne',     cat: 'mil', cost: { gold: 4000, iron: 20, food: 30 }, scale: 0.7, key: 'U', time: 50,
                  desc: '+12% Truppenwachstum (max. 5)' },
      bunker:   { e: '🧱', name: 'Bunker',      cat: 'mil', cost: { gold: 6000, iron: 50 },  scale: 0.7, key: 'Z', time: 60, radius: 14,
                  desc: 'Schützt Land & Gebäude im Umkreis vor Atomwaffen' },
      radar:    { e: '📡', name: 'Radar',       cat: 'mil', cost: { gold: 5000, iron: 25, silver: 10 }, scale: 0.7, key: 'I', time: 50, radius: 70,
                  desc: '+15% Abfangchance für Abwehr im Umkreis' },
      sam:      { e: '🛰️', name: 'Abwehr',      cat: 'mil', cost: { gold: 12000, iron: 40, oil: 10 }, scale: 1, key: 'G', time: 80, radius: 50,
                  desc: 'Fängt Raketen ab' },
      silo:     { e: '🚀', name: 'Raketensilo', cat: 'special', cost: { gold: 15000, iron: 60, oil: 20 }, scale: 1, key: 'R', time: 120, tech: 'fission',
                  desc: 'Startrampe für Raketen' },
      lab:      { e: '🔬', name: 'Labor',       cat: 'special', cost: { gold: 8000, silver: 20, gems: 3 }, scale: 0.6, key: 'L', time: 80,
                  desc: '+2.5 🧪/s' },
      wonder:   { e: '🏛️', name: 'Weltwunder',  cat: 'special', cost: { gold: 150000, gems: 120, silver: 150, wood: 300, iron: 200 }, scale: 99, key: 'T', time: 1500, tech: 'arch', max: 1,
                  desc: '+30% 🪙 · +20% Truppen · Halte es 5 Min. = SIEG' },
    },

    NUKES: {
      atom:  { e: '☢️', name: 'Atombombe',        short: 'Atom',    cost: { gold: 25000, uranium: 25, oil: 15 }, radius: 14, key: 'N', intercept: 0.85, tech: 'fission' },
      hydro: { e: '💥', name: 'Wasserstoffbombe', short: 'H-Bombe', cost: { gold: 90000, uranium: 90, oil: 40 }, radius: 32, key: 'X', intercept: 0.55, tech: 'fusion' },
      emp:   { e: '⚡', name: 'EMP-Rakete',       short: 'EMP',     cost: { gold: 20000, silver: 30, oil: 25 },  radius: 26, key: '', intercept: 0.7, tech: 'elec', emp: 600 },
    },

    TECH: {
      agri:    { e: '🌱', name: 'Agrarwirtschaft',  tier: 1, cost: { sci: 50 },               req: [], desc: '+35% Nahrung' },
      mining:  { e: '⚒️', name: 'Bergbau',          tier: 1, cost: { sci: 50 },               req: [], desc: '+35% Ertrag aus Lagerstätten' },
      steel:   { e: '⚔️', name: 'Stahlklingen',     tier: 1, cost: { sci: 70, iron: 30 },     req: [], desc: 'Angriffe kosten 12% weniger Truppen' },
      nav:     { e: '🧭', name: 'Navigation',       tier: 1, cost: { sci: 70, wood: 60 },     req: [], desc: '+1 Boot · Schiffe 30% schneller' },
      fort2:   { e: '🛡️', name: 'Befestigungskunst', tier: 2, cost: { sci: 150, iron: 60 },   req: ['steel'], desc: 'Festungen 3.5× statt 2.5×' },
      econ:    { e: '💹', name: 'Ökonomie',         tier: 2, cost: { sci: 150, silver: 40 },  req: ['mining'], desc: '+25% Gold · Börse −5% Gebühr' },
      logi:    { e: '🚂', name: 'Logistik',         tier: 2, cost: { sci: 180, oil: 30 },     req: ['nav'], desc: 'Fronten rücken 30% schneller vor' },
      med:     { e: '🧬', name: 'Medizin',          tier: 2, cost: { sci: 180, food: 120 },   req: ['agri'], desc: '+15% max. Truppen · immun gegen Seuchen' },
      fission: { e: '⚛️', name: 'Kernspaltung',     tier: 3, cost: { sci: 320, uranium: 20 }, req: ['econ'], desc: 'Raketensilo & Atombombe' },
      elec:    { e: '⚡', name: 'Elektronik',       tier: 3, cost: { sci: 300, silver: 60, iron: 60 }, req: ['fort2'], desc: 'Abwehr +15% & +20 Reichweite · EMP-Rakete' },
      arch:    { e: '📐', name: 'Baukunst',         tier: 3, cost: { sci: 350, gems: 20 },    req: ['econ'], desc: 'Gebäude 25% billiger · Weltwunder' },
      elite:   { e: '🎖️', name: 'Elitetruppen',     tier: 3, cost: { sci: 350, iron: 100 },   req: ['med', 'steel'], desc: 'Feinde zahlen +25% für dein Land' },
      fusion:  { e: '☀️', name: 'Kernfusion',       tier: 4, cost: { sci: 650, uranium: 80 }, req: ['fission'], desc: 'Wasserstoffbombe' },
      empire:  { e: '👑', name: 'Weltmacht',        tier: 4, cost: { sci: 800, gems: 60 },    req: ['arch', 'elite'], desc: '+20% Truppenwachstum & Gold' },
    },

    EVENTS: {
      meteor:   { e: '☄️', name: 'Meteoritenschauer', w: 3, desc: 'Einschläge verwüsten Land – und hinterlassen Edelsteine!' },
      volcano:  { e: '🌋', name: 'Vulkanausbruch',    w: 2, desc: 'Lava verschlingt das Umland. Neue Erzadern entstehen.' },
      goldrush: { e: '💰', name: 'Goldrausch',        w: 3, desc: 'Eine Lagerstätte liefert 90 s lang den dreifachen Ertrag!' },
      plague:   { e: '🦠', name: 'Seuche',            w: 2, desc: 'Die größte Nation verliert ein Viertel ihrer Truppen.' },
      supply:   { e: '📦', name: 'Versorgungsabwurf', w: 4, desc: 'Eine Kiste voller Ressourcen. Wer das Feld erobert, bekommt sie!' },
      storm:    { e: '🌪️', name: 'Supersturm',        w: 2, desc: 'Ein Sturm zieht über die Welt. Schiffe darin kommen kaum voran.' },
    },

    DIFFICULTY: {
      easy:   { label: 'Leicht', think: [30, 60], growth: 0.75, aggr: 0.25, nukes: false, betray: 0,    eco: 0.8 },
      normal: { label: 'Normal', think: [18, 40], growth: 0.95, aggr: 0.45, nukes: true,  betray: 0.02, eco: 1.0 },
      hard:   { label: 'Brutal', think: [10, 24], growth: 1.15, aggr: 0.7,  nukes: true,  betray: 0.05, eco: 1.25 },
    },
    MAP_SIZES: {
      small:  { label: 'Klein',  W: 480, H: 270 },
      medium: { label: 'Mittel', W: 640, H: 360 },
      large:  { label: 'Groß',   W: 800, H: 450 },
    },
    MAP_TYPES: {
      continents:  { label: 'Kontinente' },
      archipelago: { label: 'Archipel' },
      pangaea:     { label: 'Pangaea' },
      highlands:   { label: 'Hochland' },
    },
    EMBLEMS: ['🐉', '🦅', '🐺', '🦁', '🐻', '🦂', '🐍', '🦈', '🐗', '🦉', '🦊', '🐯', '🦬', '🐙', '🦇', '🐆',
      '🦌', '🐘', '🦏', '🐊', '🦍', '🕷️', '🐝', '🦄', '🐧', '🦀', '🐋', '🐎', '🦚', '🐓', '🐸', '🦖', '🐲', '🦩', '🐢', '🦜'],
    PALETTE: [
      [230, 57, 70], [58, 134, 255], [46, 196, 118], [255, 183, 3], [155, 93, 229],
      [0, 187, 249], [241, 91, 181], [251, 133, 0], [6, 214, 160], [131, 56, 236],
      [255, 0, 110], [138, 201, 38], [25, 130, 196], [255, 202, 58], [106, 76, 147],
      [255, 89, 94], [0, 245, 212], [254, 228, 64], [176, 137, 104], [72, 202, 228],
      [239, 71, 111], [17, 138, 178], [199, 125, 255], [233, 196, 106], [42, 157, 143],
      [244, 162, 97], [231, 111, 81], [144, 190, 109], [249, 65, 68], [87, 117, 144],
    ],
    NATION_NAMES: [
      'Aschenfall', 'Nordhavn', 'Silberthal', 'Kragmoor', 'Isenfurt', 'Drachenwacht', 'Larkspur',
      'Misttal', 'Bastion', 'Kesselring', 'Eisenmark', 'Rabenfels', 'Sturmhold', 'Glutheim',
      'Nebelgard', 'Frostwald', 'Schattental', 'Kaltenberg', 'Goldküste', 'Morgenrot', 'Wolfsrudel',
      'Sonnenreich', 'Ostmark', 'Westfall', 'Donnerkamm', 'Valdris', 'Korvath', 'Zephyria',
      'Obsidia', 'Thalassa', 'Kyros', 'Veyra', 'Nyxholm', 'Arkadia', 'Sereth', 'Draven',
      'Ilmarin', 'Quorra', 'Xerath', 'Tarnheim', 'Blackmere', 'Oakhaven', 'Rookswood', 'Hypnose',
    ],
  };
  BW.C.BUILD_CATS = {
    eco: { e: '🏗️', name: 'Wirtschaft' },
    mil: { e: '⚔️', name: 'Militär' },
    special: { e: '✨', name: 'Spezial' },
    weapons: { e: '🚀', name: 'Raketen' },
  };
})(globalThis.BW = globalThis.BW || {});
