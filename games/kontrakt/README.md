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
- **Polizei und Fahndung (1–5 Sterne), realistisch:**
  - Keine Fußstreifen mehr: Tagsüber kreuzen zwei Streifenwagen durch die Stadt, nachts einer.
  - Zeugen rufen an, die Leitstelle schickt eine Einheit **von weit weg**. Sie fährt über das Straßennetz an, parkt, steigt aus, ermittelt und fährt wieder ab.
  - Einsatzregeln: Erst festnehmen. Geschossen wird nur bei bewaffneten oder schießenden Verdächtigen, ab 3 Sternen mit Waffe oder im Auto und ab 4 Sternen immer.
  - Flüchtende werden getackelt. Mehr Sterne bringen mehr Einheiten, ab 4 Sternen auch das SEK.
  - Streifenwagen verfolgen dich mit Sirene. Ein unbeobachteter Outfitwechsel senkt die Fahndung um 2 Sterne.
- **NPC-Kriminelle:**
  - Räuber ziehen Passanten ab und überfallen Läden.
  - Opfer und Zeugen rufen die Polizei, und die rückt gegen den Räuber aus, nicht gegen dich.
  - Unbewaffnete Räuber werden in Handschellen abgeführt.
  - Stoppst du selbst einen, bist du der **Held der Straße**. Das gibt XP und keine Anzeige.

### Unterwelt: Verbrechen, Knast, Drogen
- **Strafregister:** Jede gemeldete Tat landet auf der Anklage, mit eigener Haftzeit (Raub 4h, Mord 10h, Polizistenmord 20h …).
  - Entkommst du der Fahndung, verfallen die Anklagepunkte.
- **Ergeben (X):** Hände hoch, die Polizei legt Handschellen an. Das bringt 30% Strafnachlass. Wer sich danach bewegt, leistet Widerstand.
- **Knast mit Timer:**
  - Schnellverfahren mit Urteil, Häftlingskleidung und einer echten Zelle im Polizeirevier.
  - Drinnen läuft die Zeit 14× schneller.
  - Raus kommst du mit **Kaution (K)** oder per **Ausbruch:** Zellentür knacken, wenn kein Wärter hinsieht. Danach wirst du mit 3 Sternen als Ausbrecher gesucht.
  - Bei der Festnahme werden Schusswaffen, Drogen, Hehlerware und Einbruchswerkzeug beschlagnahmt.
- **Überfälle:** Zielst du mit der Waffe (RMB) auf jemanden, gehen die Hände hoch.
  - Passanten ausrauben (E) bringt Brieftasche, Handy und Schmuck.
  - Ladenkasse ausräumen: Ein stiller Alarm ruft nach 9 s die Polizei.
- **Taschendiebstahl** von hinten (E halten). Geht er schief, schreit das Opfer.
- **Einbrüche:** Schränke, Regale, Schreibtische, Kühlschränke, Spinde und Kisten durchwühlen (E). Beute verkaufst du beim Hehler am Schwarzmarkt.
- **Geldautomaten** hacken (Hack-Gerät vom Schwarzmarkt).
- **Bankkonto:**
  - Ein- und Auszahlen am Automaten. Honorare und Einnahmen gehen aufs Konto.
  - Legale Läden nehmen Karte, Schwarzmarkt und Dealer nur Bargeld.
  - Beim Tod verlierst du nur Bargeld.
- **Sturmhaube:** Zeugen erkennen dich nicht. Maske ungesehen absetzen löscht die Fahndung. Vermummt wirkst du aber verdächtig, und Polizisten fordern: „Maske runter!“
- **Grow-System:**
  - Samen, Töpfe, Dünger und Gießkanne gibt es bei „Grünes Glück Gartenbedarf“.
  - Pflanzen wachsen in deinen Immobilien in Echtzeit und brauchen Wasser, sonst vertrocknen sie. Dünger verbessert Tempo und Qualität.
  - Ernten bringt Gras.
- **Dealer-System:**
  - Passanten ansprechen (T). Nachts und in Hafen, Park und Altstadt kaufen mehr Leute.
  - Dein Dealer-Ruf steigert Preise und Mengen.
  - Manche Leute verpfeifen dich, und Polizisten, die zusehen, schreiten ein.
  - Großhandel beim Schwarzmarkt: sicher, aber billig.

### Bank- und Juwelierüberfälle
- **Krähenburger Sparkasse:**
  - Schalter mit Kassierer, Wachmann in der Halle, Wachen im Hinterbereich.
  - Der **Direktor trägt die Tresor-Keycard**: Taschendiebstahl oder Bewusstlosen durchsuchen.
- **Tresortür öffnen:**
  - **Keycard:** leise. Das Zeitschloss meldet die Öffnung nach rund 35 s.
  - **Thermobohrer** (Schwarzmarkt, T halten, ca. 20 s): laut, lockt Wachen an.
  - **C4:** sprengt die Tür, die ganze Straße hört es.
- **Beute:**
  - Schließfächer aufbrechen bringt Bargeld, Goldbarren, Schmuck und Diamanten.
  - Der Bankschalter lässt sich auch direkt ausräumen.
  - Bankraub bedeutet 3 Sterne, Alarmglocke und mehrere Einheiten.
- **Juwelier Goldmann:** Vitrinen einschlagen (T) bringt Schmuck, Uhren und Diamanten. Der Panikknopf löst nach 5 s aus.
- **Am nächsten Tag** ist der Tresor wieder versiegelt und gefüllt. Heiße Ware verkaufst du beim Hehler.

### Crew anheuern (nach RDE Bodyguards)
- **Vermittler „Kralle“** in der Bar „Blauer Engel“ bietet täglich 3 Kandidaten an:
  - Seltenheit: Gewöhnlich 60%, Ungewöhnlich 25%, Selten 10%, Episch 4%, Legendär 1%.
  - Persönlichkeit: Stoisch, Loyal, Aggressiv, Fürsorglich, Profi, jeweils mit eigenen Sprüchen.
  - Fünf Skills: Schießen, Nahkampf, Ausdauer, Taktik, Medizin.
- **Größe:** Bis zu 8 Leute im Roster, 3 gleichzeitig im Einsatz.
- **Einsatz:**
  - Gerufene Leute kommen von außerhalb des Bildes angelaufen.
  - Sie folgen in Formation (Folgen, Raute, Keil, Kolonne) und steigen mit in dein Auto.
  - Sie verteidigen dich und verarzten sich selbst.
- **Befehle (B):**
  - Folgen, Position halten, Alles angreifen, Mich verarzten, Waffen weg/ziehen, Heimschicken.
  - Haltung: Friedlich, Defensiv oder Aggressiv. **V** greift das Ziel unterm Fadenkreuz an.
  - Du kannst ihnen deine aktuelle Waffe geben.
- **Fortschritt:**
  - Stufen mit Skill-Zuwachs, Moral (Motiviert bis Gebrochen) als Kampf-Multiplikator.
  - Bindungsstufen von Angeheuert über Kamerad, Vertrauter und Blutsbruder bis zur Legendären Bindung. Reden (T) stärkt die Bindung.
- **Kosten und Risiko:**
  - Tageslohn. Wer nicht bezahlt wird, verliert die Moral und kündigt.
  - Wer fällt, liegt 24 Std. in der Klinik oder wird gegen Gebühr sofort entlassen.
  - Tötet deine Crew Unbeteiligte oder Polizisten, landet das auf deinem Strafregister.

### Gangs, Reviere & Gangkrieg (nach RDE Crew)
- **Drei Straßengangs:** Schwarze Krähen (Hafen/Industrie), Vipern (Altstadt) und Goldfalken (Kanalviertel). Ihre Mitglieder tragen Bandanas in Gangfarbe und hängen in ihren Blöcken ab.
- **Eigene Gang gründen** beim Vermittler ($5.000):
  - Name und Gangfarbe wählen.
  - **Tag freihand mit der Maus zeichnen:** 6 Caps von Skinny bis Ultra Fat (Fat Caps mit Sprühnebel-Kante), 9 Farben, Rückgängig mit Z.
- **Reviere:**
  - Jeder Stadtblock hat einen Tag-Spot. Mit einer Sprühdose (E halten) claimst du ihn, es gilt **„last spray wins“**.
  - Dein Tag erscheint auf dem Pflaster, die Karte färbt den Block in deiner Farbe.
- **Krieg erklären:**
  - Feindliche Reviere lassen sich nur im Krieg übersprühen.
  - Die Gang greift dich und deine Crew auf Sicht an und **überfällt deine Blöcke**: Ein Trupp kommt und sprüht zurück, wenn du ihn nicht stoppst.
  - Frieden kann man kaufen. Verliert eine Gang ihr letztes Revier, ist sie zerschlagen.
- **Einnahmen:** Jeder eigene Block bringt $150 pro Tag. Dealen im eigenen Revier bringt +25%.

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
| **X** | Ergeben | **K** | Kaution zahlen |
| **RMB auf Person** | Überfall | **T bei Passanten** | Gras anbieten |
| **B** | Crew-Menü & Gang | **V** | Crew: Ziel angreifen |
| **E/T an Tresortür** | Keycard / Bohrer | **T an Vitrine** | Einschlagen |
| **E am Tag-Spot** | Revier sprühen | **Z (Tag-Editor)** | Rückgängig |

---

## Architektur

```
games/kontrakt/
├── index.html            HUD-, Handy-, Panel- und Menü-Markup
├── css/style.css         Noir-HUD, Handy, Panels
├── js/core/              util (RNG, Noise, Namen), data (Waffen, Items, Outfits, Shops, Gebäude, Skills)
├── js/world/             citygen (Viertel, Gebäude, Räume, Möbel, Licht, Zonen), nav (A*, Sichtlinie, Raycasts)
├── js/game/              world (Physik, Türen, Zeit, Wetter, Licht, Lärm) + Mixins:
│                         economy, combat, crime, ai, contracts, vehicles, player, underworld,
│                         police (Einheiten, Einsatzregeln), criminals, heists, crew, gangs
├── js/render/            textures, sprites (Menschen, Autos, Möbel), fx (Partikel, Decals),
│                         renderer (Chunks, Dächer, Schatten, Sichtfeld, Lightmap, Wetter, Overlay), post (WebGL2)
├── js/audio/audio.js     prozedurale SFX, Ambience und generative Musik
├── js/ui/                ui (HUD, Minimap), menus (Handy, Inventar, Shops, Karte, Titel), input
├── js/main.js            Spielschleife, Speichern, Einstellungen, Titel-Drohnenflug, Stimmen
└── tools/                sim.mjs (Headless-Spieltest), scenarios.mjs (KI-Verhalten), crime.mjs (Knast, Raub, Grow, Bank), gen.mjs (Stadt-Dump)
```

- **Getrennte Simulation:** `K.World` läuft komplett ohne DOM, auch in Node.
  - `node tools/sim.mjs` spielt Laufen, Schießen, Auftrag, Takedown, Fahren, 5 Spielstunden und Speichern headless durch.
  - `node tools/scenarios.mjs` prüft die KI: Hausfriedensbruch, Verkleidung, Münzen-Ablenkung, Leichenfund, Zeugen mit Polizei, Klaviersaite.
- **Speichern** in `localStorage`. Die Stadt wird aus dem Seed neu erzeugt, deshalb bleibt der Spielstand klein.

*Red Dragon Elite · pure HTML · CSS · JavaScript*
