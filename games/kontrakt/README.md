# RDE // KONTRAKT

**Ein Open-World-Assassinen-RPG in purem HTML, CSS und JavaScript.**
Kein Framework, keine Bilder, keine Sounddateien: Stadt, Grafik, Musik und Geräusche entstehen prozedural im Browser.

Du bist Auftragskiller in **Krähenburg**. Du hast eine kleine Bude in der Altstadt, ein Handy, eine Klaviersaite und eine P9. Die Stadt lebt Tag und Nacht. Die Aufträge kommen aufs Handy, und wie du sie erledigst, entscheidest du selbst.

▶ **Spielen:** https://reddragonelite.github.io/RDWE/games/kontrakt/ (GitHub Pages)
oder lokal: `python3 -m http.server` im Ordner `games/kontrakt/`, dann `http://localhost:8000` öffnen.

---

## Features

### Die Stadt
- **Prozedurale Stadt (186×200 Tiles), 7 Viertel:**
  - Altstadt, Mitte, Sonnenhang (Villen), Stadtpark, Kanalviertel, Industriegebiet und Hafen mit Piers, Booten und Kränen.
- **108 betretbare Gebäude mit echten Innenräumen.** Wenn du ein Gebäude betrittst, blenden die Dächer aus.
  - Wohnhäuser, Büros, Grand Hotel, Villen mit Pool und Garten, Lagerhallen, Polizeirevier, Klinik, Club, Bar, Diner, Späti, Apotheke, Boutique, Waffenladen und Schwarzmarkt.
- **Leben in den Straßen:**
  - Passanten mit Tagesrhythmus
  - Verkehr auf zwei Spuren mit Zebrastreifen
  - Ladenbesitzer, Köche, Kellner, Ärzte, Türsteher, Wachen, Polizei-Streifen und eine Hafen-Crew
- **Tag-Nacht-Zyklus:** 1 Sekunde Echtzeit entspricht 1 Spielminute.
  - Straßenlaternen, beleuchtete Fenster, Neonschilder und Scheinwerfer
  - Sonnenschatten, die mit der Tageszeit wandern
- **Wetter:** klar, bewölkt, Regen, Gewitter mit Blitz und Donner, Nebel.
  - Regen dämpft Schüsse und Schritte, Nebel senkt Sichtweiten, nasse Straßen spiegeln das Licht.

### Assassinen-Gameplay
- **Aufträge per Handy.** Jeder Auftrag hat:
  - ein zufälliges Ziel mit Dossierfoto und Biografie
  - eine Tagesroutine über mehrere Orte und Leibwächter
  - eine Frist und Bonusziele: Lautloser Assassine, Nur das Ziel, Unfall, Signaturwaffe, Kopfschuss, In Verkleidung
- **Intel kaufen:** Das Ziel wird live markiert. Ohne Intel kennst du nur das grobe Gebiet.
- **Wertung am Ende jedes Auftrags:** Phantom, Lautloser Assassine, Profi, Schlächter oder Staatsfeind, mit Auszahlung und XP.
- **Verkleidungen:**
  - Nimm bewusstlosen oder toten NPCs die Kleidung ab (**T**).
  - Wachen, Polizisten, Köche, Kellner und Ärzte haben Zugang zu Sperrgebieten.
  - „Enforcer“ (in der Instinkt-Sicht orange markiert) durchschauen Verkleidungen aus der Nähe.
- **Wahrnehmung:** Sichtkegel, Licht und Schatten, Ducken, Geräuschradien.
  - Verdachtsanzeige über den Köpfen (? → !).
  - Wachen warnen, suchen, schlagen Alarm und wecken K.O.-gegangene Kollegen.
- **Takedowns von hinten (F):**
  - Klaviersaite (lautlos, kein Blut), Messer, Würgegriff (bewusstlos)
  - Gift- oder Betäubungsspritze (Gift zählt als Unfall)
- **Leichen** ziehen (**E**) und in Container, Spinde oder Schränke stopfen. Gefundene Leichen lösen Alarm aus.
- **Münzen werfen** lenkt Wachen ab.
- **Instinkt (Q halten):**
  - Wachen, Ziele und Polizei durch Wände sehen
  - Verstecke hervorheben
  - die Welt entsättigt sich
- **Sichtfeld:** Was hinter Wänden liegt, bleibt im Dunkeln.

### Kampf
- **Waffen:**
  - **Pistolen:** P9 Kompakt, Silberbaron .45 SD, Magnum .357
  - **Maschinenpistole:** MP-K
  - **Schrotflinte:** Pump-12
  - **Sturmgewehr:** K-47
  - **Scharfschützengewehr:** Jäger 700 mit Zielfernrohr
- **Nahkampf:** Fäuste mit Kombos, Messer, Baseballschläger, Brecheisen, Machete, Katana.
- **Wurfwaffen:** Granaten, Münzen und C4 zum Fernzünden.
- **Munitionstypen und Nachladen (R):**
  - Magazine, Schrotflinte Schuss für Schuss
  - Rückstoß, Streuung (Bewegung, Ducken, Zielen mit RMB)
  - Schalldämpfer zum Nachrüsten
- **Ballistik:** echte Projektile mit Tracern, Kopfschüssen, Durchschlag beim Scharfschützengewehr und Glas, das zersplittert.
- **Blut und Gore** (abschaltbar):
  - Sprühnebel, Spritzer an Boden und Wänden, wachsende Blutlachen, blutige Fußspuren, Schleifspuren beim Ziehen
  - Körperteile bei Explosionen und Schrotflinten-Kopfschüssen
- **Polizei und Fahndung (1–5 Sterne):**
  - Zeugen rufen an. Polizisten verhaften bei 1 Stern und schießen ab 2.
  - Ab 4 Sternen rückt das SEK mit Gewehren an.
  - Streifenwagen verfolgen dich mit Sirene.
  - Ein unbeobachteter Outfitwechsel senkt die Fahndung um 2 Sterne.

### Leben, Wirtschaft, RPG
- **Hunger, Durst, Energie, Ausdauer, Blutungen, Trunkenheit und Schmerzmittel.**
- **Essen und Trinken** im Diner, in der Bar, im Späti und an Getränkeautomaten.
- **Schlafen** im eigenen Bett überspringt die Zeit und speichert.
- **Immobilien kaufen:** Bude, Altbau, Penthouse-Loft, Lagerhalle, die Bar „Blauer Engel“ und eine Villa.
  - Jede Immobilie hat Bett, Kleiderschrank und eine Waffenkammer.
  - Geschäfte werfen täglich Geld ab.
- **Shops:**
  - Waffenladen und Schwarzmarkt (Ankauf und Verkauf)
  - Apotheke, Boutique (Outfits) und Klinik (Behandlung)
- **Einbrüche:** Schlösser knacken mit Dietrich oder Brecheisen, Tresore ausräumen, Taschen von Bewusstlosen leeren.
- **Fahrzeuge:**
  - Autos klauen (F), Fahrer werfen dich raus oder fliehen, Polizeiwagen mit Sirene (R).
  - Arcade-Physik mit Drift (Leertaste), Crashs, brennenden Wracks und Drive-by mit Pistole oder MP.
- **XP und 6 Fähigkeiten** mit je 5 Stufen: Schleichen, Schütze, Nahkampf, Kondition, Tarnung, Überleben.

### Grafik und Sound (2026er-Tech, aber nur Canvas und WebAudio)
- **Gebackene Boden-Chunks** mit prozeduralen Texturen: Asphalt, Pflaster, Parkett, Marmor, Teppich, Gras.
- **Ambient Occlusion** an Wänden.
- **Lightmap** mit Multiply-Compositing. Licht von Raumlampen fällt nicht durch Wände.
- **Wolkenschatten** und sichtbare Lichtkegel.
- **WebGL2-Post-FX:**
  - Bloom, Chromatic Aberration bei Treffern, Color Grading
  - Instinkt-Entsättigung (Rot bleibt), Trunkenheits-Wabern, Film-Grain
- **Dynamische Auflösung** hält die Framerate.
- **Prozeduraler 3D-Sound:**
  - Waffen je Kaliber mit Distanz-Filter und Hall
  - Schritte je nach Untergrund, Hülsen, Glas, Explosionen mit Ohrenklingeln
  - Sirenen, Motor, Regen, Wind, Grillen nachts im Park, Möwen am Hafen, Club-Bass
- **Generative Noir-Musik:** Rhodes, Kontrabass, Besen und eine Nacht-Trompete. Spannung und Kampf werden dynamisch überblendet.
- **NPC-Stimmen** per Sprachausgabe (abschaltbar).

---

## Steuerung

| Taste | Aktion | Taste | Aktion |
|---|---|---|---|
| **W A S D** | Bewegen | **Maus** | Zielen |
| **Shift** | Sprinten | **LMB** | Angriff / Schießen / Werfen |
| **C** | Ducken | **RMB** | Präzise zielen / Zielfernrohr |
| **E** | Interagieren / Leiche ziehen | **R** | Nachladen |
| **F** | Takedown / Auto | **T** | Verkleidung nehmen |
| **Q** (halten) | Instinkt | **G** | C4 zünden |
| **1–9 / Mausrad** | Waffe wählen | **H** | Holstern |
| **TAB** | Inventar | **P** | Handy |
| **M** | Karte | **L** | Taschenlampe |
| **Z** | Zoomstufe | **ESC** | Pause |
| **Leertaste** | Handbremse | **F11** | Vollbild |

---

## Architektur

```
games/kontrakt/
├── index.html            HUD-, Handy-, Panel- und Menü-Markup
├── css/style.css         Noir-HUD, Handy, Panels
├── js/core/              util (RNG, Noise, Namen), data (Waffen, Items, Outfits, Shops, Gebäude, Skills)
├── js/world/             citygen (Viertel, Gebäude, Räume, Möbel, Licht, Zonen), nav (A*, Sichtlinie, Raycasts)
├── js/game/              world (Physik, Türen, Zeit, Wetter, Licht, Lärm) + Mixins:
│                         economy, combat, crime, ai, contracts, vehicles, player
├── js/render/            textures, sprites (Menschen, Autos, Möbel), fx (Partikel, Decals),
│                         renderer (Chunks, Dächer, Schatten, Sichtfeld, Lightmap, Wetter, Overlay), post (WebGL2)
├── js/audio/audio.js     prozedurale SFX, Ambience und generative Musik
├── js/ui/                ui (HUD, Minimap), menus (Handy, Inventar, Shops, Karte, Titel), input
├── js/main.js            Spielschleife, Speichern, Einstellungen, Titel-Drohnenflug, Stimmen
└── tools/                sim.mjs (Headless-Spieltest), scenarios.mjs (KI-Verhalten), gen.mjs (Stadt-Dump)
```

- **Getrennte Simulation:** `K.World` läuft komplett ohne DOM, auch in Node.
  - `node tools/sim.mjs` spielt Laufen, Schießen, Auftrag, Takedown, Fahren, 5 Spielstunden und Speichern headless durch.
  - `node tools/scenarios.mjs` prüft die KI: Hausfriedensbruch, Verkleidung, Münzen-Ablenkung, Leichenfund, Zeugen mit Polizei, Klaviersaite.
- **Speichern** in `localStorage`. Die Stadt wird aus dem Seed neu erzeugt, deshalb bleibt der Spielstand klein.

*Red Dragon Elite · pure HTML · CSS · JavaScript*
