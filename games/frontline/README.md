# ◢ RDE // FRONTLINE — NEXT GEN ◣

**Territorial-Strategie im Stil von OpenFront & territorial.io, mit Ressourcen-Wirtschaft, Techbaum, Weltereignissen und Raketenkrieg.**
Gebaut mit purem HTML, CSS & JS. Kein Framework, kein Build-Step, keine Asset-Dateien: Sounds entstehen live per WebAudio, Welten prozedural, Grafiken sind Canvas und Emojis.

## Starten

```bash
# index.html einfach im Browser öffnen – oder lokal servieren:
cd games/frontline && python3 -m http.server 8080
# → http://localhost:8080
```

## Was drin ist

### 🗺️ Welt
- Prozedurale Welten: Kontinente, Archipel, Pangaea, Hochland, per Seed reproduzierbar, mit Hillshading, Küstenschelf, glitzerndem Wasser und Wolken
- **Lagerstätten** auf der Karte: 🔩 Eisen, 🥈 Silber, 🥇 Gold, 💎 Edelsteine, 🛢️ Öl, ☢️ Uran, mit 1 bis 3 ⭐ Reichhaltigkeit. Wer das Feld hält, kassiert
- 🌙 **Tag-Nacht-Zyklus** (4 Min.): Nachts leuchten Städte, Häfen und Schiffe
- 🌋 **Weltereignisse**: ☄️ Meteoritenschauer (hinterlässt 💎), 🌋 Vulkanausbruch (neue Erzadern), 💰 Goldrausch (×3 Ertrag), 🦠 Seuche, 📦 Versorgungsabwürfe, 🌪️ Supersturm mit Regen und Blitzen, in dem Schiffe kaum vorankommen

### 💰 Wirtschaft
- 9 Ressourcen: 💰 Gold, 🌾 Nahrung, 🌲 Holz, 🔩 Eisen, 🥈 Silber, 💎 Edelsteine, 🛢️ Öl, ☢️ Uran, 🧪 Forschung
- 🌾 **Armeen essen**: Gut versorgt wachsen Truppen +15 %, bei Hunger −30 %
- 🏪 **Börse** mit schwankenden Kursen, Sparklines und Gebühren. Große Orders bewegen den Markt
- ⛵ **Handelsschiffe** fahren automatisch zwischen Häfen verschiedener Nationen, beide Seiten verdienen

### 🏗️ 16 Gebäude (mit Bauzeit & Baustellen-Animation)
| Wirtschaft | Militär | Spezial |
|---|---|---|
| 🏙️ Stadt · 🌾 Farm · 🪓 Sägewerk · ⛏️ Mine · ⛽ Bohrturm · ⚓ Hafen · 🏪 Markt · 🏦 Bank | 🏰 Festung · ⛺ Kaserne · 🧱 Bunker · 📡 Radar · 🛰️ Abwehr | 🚀 Raketensilo · 🔬 Labor · 🏛️ **Weltwunder** |

Farmen brauchen Ebene, Sägewerke Wald, Minen und Bohrtürme sitzen direkt auf einer Lagerstätte. Ein Klick wird automatisch auf das nächste gültige Feld gesnappt, ein grüner Punkt zeigt die Position.

### 🧪 Techbaum (14 Technologien, 4 Stufen)
🌱 Agrarwirtschaft · ⚒️ Bergbau · ⚔️ Stahlklingen · 🧭 Navigation → 🛡️ Befestigungskunst · 💹 Ökonomie · 🚂 Logistik · 🧬 Medizin → ⚛️ Kernspaltung · ⚡ Elektronik · 📐 Baukunst · 🎖️ Elitetruppen → ☀️ Kernfusion · 👑 Weltmacht

### 🚀 Raketen
☢️ Atombombe · 💥 Wasserstoffbombe · ⚡ EMP (legt Gebäude 60 s lahm). Raketen fliegen in einer ballistischen Kurve und sind abfangbar (🛰️ + 📡). 🧱 Bunker schützen das Land in ihrem Umkreis. Verstrahltes Land kostet 60 s lang 4× so viel.

### 🏆 Siegbedingungen
🗺️ 80 % des Landes · 🏛️ Weltwunder 5 Minuten halten · ⚔️ als Letzter übrig bleiben

### 🎨 UI
Ressourcenleiste, Bau-Dock mit Kategorien und Kosten-Chips, große Seitenbuttons, Fenster für 🧪 Forschung (Techbaum mit Verbindungslinien), 🏪 Börse, 🤝 Diplomatie, 📊 Statistik (Landanteil-Chart mit Crosshair) und ⚙️ Optionen. Dazu Event-Banner, 🏅 Erfolge, schwebende Zahlen, Befehlsrad, Minimap mit Lagerstätten sowie Wappen-Emojis für jede Nation. Läuft auf Desktop und Touch.

## Steuerung

| Eingabe | Aktion |
|---|---|
| Linksklick | Angreifen – ohne Landgrenze automatisch per ⛵ Boot |
| Rechtsklick / Long-Press | Befehlsrad (Angriff, Boot, Bündnis, passende Gebäude, Raketen) |
| Mausrad / Pinch · Ziehen / WASD | Zoom · Kamera |
| 1–6, Q/E | Angriffsgröße 10/20/30/50/75/100 %, ±5 % |
| Tab | Bau-Kategorie wechseln |
| C V B J O H K Y | 🏙️ 🌾 🪓 ⛏️ ⛽ ⚓ 🏪 🏦 |
| F U Z I G R L T | 🏰 ⛺ 🧱 📡 🛰️ 🚀 🔬 🏛️ |
| N / X | ☢️ Atombombe / 💥 Wasserstoffbombe |
| Shift + Klick | Baumodus aktiv lassen |
| Leertaste · Pos1 · P · M · Esc | Zu dir · ganze Karte · Pause · Ton · Abbrechen/Schließen |

## Architektur (Multiplayer-ready)

```
js/core/      rng.js (mulberry32), constants.js (gesamtes Balancing)
js/sim/       mapgen.js, sim.js, economy.js, events.js, ai.js   ← DOM-frei, deterministisch, läuft auch in Node
js/net/       transport.js                                       ← LocalTransport + LockstepTransport (WebSocket)
js/client/    renderer.js, atmosphere.js, sprites.js, ui.js, panels.js, input.js, audio.js
js/main.js    Menü, Game-Loop, Events → Effekte/Sound/Erfolge
tools/        headless.mjs, smoke.mjs                            ← Tests ohne Browser
```

**Grundregel:** Der Client ändert den Spielzustand nie direkt. Jede Aktion (Angriff, Bauen, Forschen, Handeln, Diplomatie)
ist ein *Intent* wie `{type:'trade', pid, res:'gems', qty:100, side:'sell'}`. Er läuft über den Transport und wird erst in
`sim.step(intents)` ausgeführt. Börsenkurse, Weltereignisse und die KI laufen innerhalb der Simulation mit dem geseedeten RNG.
Gleicher Seed plus gleiche Intents pro Tick ergibt auf jedem Rechner dieselbe Welt, `sim.hash()` prüft das.

Lockstep-Multiplayer ist damit der natürliche nächste Schritt: Ein Relay-Server bündelt die Intents pro Tick, und die Clients
steppen erst, wenn das Bündel da ist. Das Protokoll ist in `js/net/transport.js` dokumentiert.

## Tests

```bash
node tools/headless.mjs 1337 4000   # 16 Brutal-Bots: Performance + Determinismus-Check
node tools/smoke.mjs                # Spawn, Expansion, Boot, Bündnis, Forschung, Börse, Silo, Atomschlag, Weltereignis
```

---
*Red Dragon Elite · RDE Black Flag License*
