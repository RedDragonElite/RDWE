/* RDE // FRONTLINE — shared constants & balancing (sim + client) */
(function (BW) {
  'use strict';

  const T = { DEEP: 0, SHALLOW: 1, BEACH: 2, PLAINS: 3, FOREST: 4, HILLS: 5, MOUNTAIN: 6, SNOW: 7 };

  BW.C = {
    VERSION: '0.1.0',
    TICK_MS: 100,           // 10 simulation ticks per second
    SPAWN_TICKS: 120,       // 12s spawn phase
    WIN_SHARE: 0.8,         // 80% of all land wins
    SPAWN_RADIUS: 4,
    START_TROOPS: 2500,
    MAX_BOATS: 3,
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
    // growth: 'double' => base * 2^count (capped), 'linear' => base * (1 + count)
    BUILD: {
      city:    { name: 'Stadt',       base: 5000,  growth: 'double', key: 'C', desc: '+25K max. Truppen · +Gold' },
      port:    { name: 'Hafen',       base: 4000,  growth: 'double', key: 'H', desc: '+Gold · schnellere Boote', coastal: true },
      defense: { name: 'Festung',     base: 2500,  growth: 'linear', key: 'F', desc: 'Angreifer zahlen 2.5× im Umkreis', radius: 11 },
      silo:    { name: 'Raketensilo', base: 15000, growth: 'linear', key: 'R', desc: 'Startrampe für Atomwaffen' },
      sam:     { name: 'Abwehr',      base: 12000, growth: 'linear', key: 'G', desc: 'Fängt Atomraketen ab', radius: 50 },
    },
    NUKES: {
      atom:  { name: 'Atombombe',        cost: 25000,  radius: 14, key: 'N', intercept: 0.85 },
      hydro: { name: 'Wasserstoffbombe', short: 'H-Bombe', cost: 100000, radius: 32, key: 'X', intercept: 0.55 },
    },
    DIFFICULTY: {
      easy:   { label: 'Leicht', think: [30, 60], growth: 0.75, aggr: 0.25, nukes: false, betray: 0 },
      normal: { label: 'Normal', think: [18, 40], growth: 0.95, aggr: 0.45, nukes: true,  betray: 0.02 },
      hard:   { label: 'Brutal', think: [10, 24], growth: 1.15, aggr: 0.7,  nukes: true,  betray: 0.05 },
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
})(globalThis.BW = globalThis.BW || {});
