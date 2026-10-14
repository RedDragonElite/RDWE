# ◢ RDE // FRONTLINE ◣

**Territorial-/Border-Strategie im Stil von OpenFront & territorial.io, gebaut mit purem HTML, CSS & JS.**
Kein Framework, kein Build-Step, keine Assets. Die Sounds werden live per WebAudio erzeugt, die Welten prozedural.

## Starten

```bash
# einfach index.html im Browser öffnen, oder lokal servieren:
cd games/frontline && python3 -m http.server 8080
# → http://localhost:8080
```

## Features

- **Prozedurale Welten**: Kontinente, Archipel, Pangaea, Hochland. Per Seed reproduzierbar, mit Hillshading, Küstenschelf, glitzerndem Wasser und ziehenden Wolken
- **Territorialkrieg**: organisch wachsende Fronten, Geländekosten (Wald, Hügel, Gebirge), Truppendichte des Verteidigers zählt
- **Frontalzusammenstöße**: Gegenangriffe heben sich gegenseitig auf
- **Transportschiffe**: Klick auf Land hinter dem Meer, BFS-Seeroute, Landung mit Brückenkopf
- **Gebäude**: Stadt (+Truppenlimit), Hafen (+Gold, schnellere Boote), Festung (2,5× Angriffskosten im Umkreis), Raketensilo, Abwehr (SAM)
- **Atomwaffen**: Atombombe und Wasserstoffbombe fliegen in einer ballistischen Kurve. Abfangbar, mit Druckwelle, Screenshake und Fallout. Verstrahltes Land kostet 60 s lang 4× so viel
- **Diplomatie**: Bündnisse anbieten, annehmen und brechen. Verräter werden von der KI gemieden, und die KI bietet dir selbst Bündnisse an
- **Nationen-KI** in drei Stufen: expandiert, baut Städte, Häfen und Festungen, kontert, fährt Seeinvasionen und setzt auf Brutal auch Atomwaffen ein
- **HUD**: Live-Rangliste, Landanteil-Balken mit 80 %-Siegesmarke, Minimap, Befehlsrad (Rechtsklick), Event-Feed, Tooltips, Spielgeschwindigkeit 1×/2×/4×
- Desktop & Touch (Pinch-Zoom, Long-Press = Befehlsrad)

## Steuerung

| Eingabe | Aktion |
|---|---|
| Linksklick | Angreifen (Wildnis/Feind) – ohne Landgrenze automatisch per Boot |
| Rechtsklick / Long-Press | Befehlsrad: Angriff, Boot, Bündnis, Bauen, Atomschlag |
| Mausrad / Pinch | Zoom |
| Ziehen / WASD / Pfeile | Kamera |
| 1–6, Q/E | Angriffsgröße 10/20/30/50/75/100 %, ±5 % |
| C H F R G | Stadt, Hafen, Festung, Raketensilo, Abwehr |
| N / X | Atombombe / Wasserstoffbombe zielen |
| Shift + Klick | Baumodus aktiv lassen |
| Leertaste · Pos1 | Zu dir springen · ganze Karte |
| P · M · Esc | Pause · Ton · Abbrechen |

## Architektur (Multiplayer-ready)

```
js/core/      rng.js (mulberry32), constants.js (Balancing)
js/sim/       mapgen.js, sim.js, ai.js   ← DOM-frei, deterministisch, läuft auch in Node
js/net/       transport.js               ← LocalTransport + LockstepTransport (WebSocket)
js/client/    renderer.js, ui.js, input.js, audio.js
js/main.js    Menü, Game-Loop, Event→Feedback
tools/        headless.mjs, smoke.mjs    ← Tests ohne Browser
```

**Grundregel:** Der Client ändert den Spielzustand nie direkt. Jede Aktion ist ein *Intent*
(`{type:'attack', pid, tile, ratio}`), der über den Transport läuft und erst in `sim.step(intents)` ausgeführt wird.
Die Simulation nutzt ausschließlich den geseedeten RNG und deterministische Iterationsreihenfolgen.
Gleicher Seed plus gleiche Intents pro Tick ergibt auf jedem Rechner dieselbe Welt (`sim.hash()` prüft das).

Damit ist **Lockstep-Multiplayer** der natürliche nächste Schritt:

1. Ein kleiner Relay-Server (Node/PHP-Websocket) sammelt die Intents aller Spieler
2. Er broadcastet pro Tick ein `turn`-Bündle (`{t:'turn', tick, intents}`)
3. Jeder Client steppt Tick *T* erst, wenn das Bündle für *T* da ist (`transport.canStep`)
4. Alle 50 Ticks werden Hashes verglichen, um Desyncs zu erkennen

Die KI läuft *innerhalb* der Simulation. Bots kosten deshalb keinen Netzwerktraffic und sind auf allen Clients identisch.
Das Protokoll ist in `js/net/transport.js` dokumentiert.

## Tests

```bash
node tools/headless.mjs 1337 4000   # 16 Brutal-Bots, Performance + Determinismus-Check
node tools/smoke.mjs                # Spawn, Expansion, Boot, Bündnis, Bauen, Atomschlag
```

---
*Red Dragon Elite · RDE Black Flag License*
