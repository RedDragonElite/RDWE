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
  - **Sturmgewehre:** K-47, Kolibri AR-15 (5.56)
  - **MG:** Brecher M60 mit 100-Schuss-Gurt; macht dich langsamer
  - **Präzisionsgewehre:** Falke DMR (halbautomatisch, 4×), Wisper VSS (integrierter Schalldämpfer, 9×39)
  - **Scharfschützengewehre:**
    - Jäger 700 (Repetierer, 8×)
    - Kodiak .50 BMG: Anti-Material, schießt durch Autos, Türen und die Leute dahinter
- **Zielfernrohr (RMB):**
  - Die Kamera zoomt weit heraus und schaut voraus.
  - Ein Scope-Overlay zeigt Absehen mit Mil-Dots, Entfernung, Magazin und Zielerkennung.
  - Das Gewehr wackelt mit dem Puls, stärker auf Distanz, beim Laufen, betrunken oder außer Puste. Ducken beruhigt.
  - **Shift** hält den Atem an: Das Absehen steht fast still, bis die Luft ausgeht. Danach keuchst du ein paar Sekunden.
  - Aus der Hüfte streuen Zielfernrohr-Waffen stark.
- **Bezugsquellen:** AR-15, DMR und 5.56 gibt es im Waffenladen. VSS, Kodiak, M60, .50 BMG und 9×39 gibt es auf dem Schwarzmarkt. Das SEK rückt jetzt mit AR-15 und DMR-Schützen an.
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

### Vice-Look, Ocean Beach & Nachtleben
- **Vice-Grading** (abschaltbar in den Optionen): lila Schatten, Türkis in den Mitten, Pink und Orange in den Lichtern, zur goldenen Stunde am stärksten.
- **Palmen-Boulevards** in Mitte, Sonnenhang und am Strand, mit pinken und cyanfarbenen Laternen am Ocean Drive.
- **Ocean Beach:** Sand bis ans Wasser, ein Holzsteg, Liegen, Sonnenschirme, Surfbretter, ein Rettungsturm und tagsüber Badegäste.
- **Beachclub „Flamingo“ und Beachclub „Sunset“:** Pooldeck, Cocktailbar, DJ-Pult und Neon. Nachts wird getanzt.
- **Stripclub „Velvet“:** Neonbühne mit zwei Stangen, Tänzerinnen, Türsteher, Champagner-Bar und VIP-Bereich.
  - Trinkgeld geben (E) oder einen Privattanz buchen (T).
  - Stammgäste hören Dinge: Nach ein paar Trinkgeldern verrät dir eine Tänzerin, wo dein Auftragsziel ist (Intel gratis).
- **Karte im Vice-City-Stil:**
  - Pastellviertel, Neonstraßen in Pink und Cyan, Sunset-Himmel mit Retro-Sonne.
  - Viertelnamen in Neon-Schrift, Icons in Neonringen, Minimap mit Pink-Cyan-Rahmen.
- **14 Immobilien**, davon 7 Geschäfte mit Tageseinnahmen:
  - Bar ($1.500 pro Tag), Tankstelle ($900), Diner ($700), Werkstatt ($1.200)
  - Beachclub „Sunset“ ($2.000), Beachclub „Flamingo“ ($2.600), Stripclub „Velvet“ ($3.400)
  - Neue Wohnungen: Wohnung Kanalviertel und Strandhaus Ocean Drive.

### Autos: Autohaus, Tanken, Werkstatt, Car Service (nach rde_fuel, rde_mechanic, rde_carservice, rde_carhud)
- **12 Modelle mit eigener Silhouette:** Brisa Mini, Vela Limousine, Kastenwagen, Hauler-Pickup, Corsa GT, Ranger-SUV, Bulldog V8, Volta E (elektrisch), Furia S und Spectre RS (234 km/h). Im Verkehr fahren alle Modelle mit.
- **Autohaus Krähenburg** (Mitte):
  - Showroom mit Verkäufer und Ausstellungswagen auf dem Hof.
  - Katalog mit Werten (Spitze, Beschleunigung, Handling, Bremsen, Verbrauch) und Werksfarbe.
  - Gekaufte Autos gehören dir und werden mit Zustand und Tuning gespeichert.
- **Realistischer Schaden:**
  - Die Karosserie verbeult genau dort, wo du einschlägst (28-Punkt-Verformung), dazu Kratzer, kaputte Scheinwerfer und Rückleuchten und eine gesprungene Scheibe.
  - Motor, Karosserie, Tank und alle 4 Reifen haben eigene Werte.
  - Reifen lassen sich zerschießen und schleifen dann Funken auf der Felge. Ein Tankleck lässt Sprit auslaufen.
  - Ein sterbender Motor qualmt erst hell, dann dunkel, dann brennt er.
- **Umfahren:** Laternen (das Licht geht aus), Hydranten (Wasserfontäne), Bänke, Mülleimer, Poller, Automaten und Schilder fallen um. Bäume und Wände halten.
- **Tanken wie bei rde_fuel:**
  - Zapfpistole nehmen (E). Der Schlauch spannt sich, wer zu weit läuft, verliert die Pistole.
  - Am Tank einstecken (E) und das Zapfsäulen-Display mit 7-Segment-Anzeige beobachten.
  - Bezahlt wird am Ende, bei „NICHT GENUG GELD“ stoppt die Säule.
  - Benzinkanister, Ersatzreifen und Reparaturset gibt es im Kiosk.
  - Leerer Tank: Der Motor stottert und geht aus. Der Volta E fährt elektrisch.
- **Werkstatt „Schraubstock“ wie rde_mechanic:**
  - In eine Bühne fahren, dann T drücken.
  - Reparatur mit Preis und Dauer: Ein Mechaniker läuft zur Haube, Funken fliegen, alles wird Stück für Stück wieder heil.
  - Tuning mit Vorschau, erst „✅ Kaufen“ oder „❌ Abbrechen“ macht es fest. Preise skalieren mit der Fahrzeugklasse.
    - Leistung: Motor 1–4, Getriebe, Bremsen, Fahrwerk, Panzerung 1–4, Turbo, Sport-, Drift- oder kugelsichere Reifen, Nitro.
    - Lack: 22 Farben in Klassik, Matt, Metallic, Spezial und Chrom, dazu Streifen und Felgen.
    - Licht: Xenon und 14 Neon-Unterbodenfarben.
    - Karosserie: Spoiler, Haube, Tönung, Hupen.
    - Bordwaffen: MG und Raketen.
- **Car Service (Handy-App):**
  - Ein Fahrer liefert dein eingelagertes Auto an deinen Standort ($750), mit ETA, Tracking auf der Minimap, Hupe bei Ankunft und Schlüsselübergabe.
  - Oder er holt ein geparktes Auto ab und bringt es in die Garage ($500).
  - Totalschaden? Die Versicherung ersetzt ihn für 15% des Neupreises.
- **Cockpit (rde_carhud):**
  - Tacho bis 280 km/h, Drehzahl mit rotem Bereich, Gang (N/R/1–6), Kilometerzähler, Tank und Motortemperatur.
  - Warnleuchten für Motor, Gurt, Tempomat und Licht, Reifenstatus VL/VR/HL/HR sowie NOS- und Boost-Anzeige.
  - Banner bei Überhitzung und leerem Tank, Riss-Overlay für die Frontscheibe.
- **Fahren:**
  - Motor anlassen. Geklaute Autos musst du erst kurzschließen.
  - Gurt (B): Ohne Gurt fliegst du ab ca. 75 km/h durch die Frontscheibe.
  - Motortemperatur: Hitze kostet Leistung, über 140 °C gibt es einen Motorschaden.
  - Außerdem Tempomat (X), Blinker (Q/E), Abblend- und Fernlicht (L) und Nitro (Shift).
- **Fäuste wegstecken (H):** Hände unten, kein versehentlicher Schlag. Der erste Klick hebt die Fäuste.

### Inventar & Hotbar
- **Drag-&-Drop-Inventar (TAB):**
  - Waffen und Gegenstände liegen als Kacheln im Inventar und lassen sich in die 9 Hotbar-Slots ziehen.
  - Slots kannst du untereinander tauschen. Zieh einen Slot aus der Leiste oder klick ihn rechts an, dann ist er wieder leer.
  - Zieh eine Kachel auf „Benutzen“, „Alles wegstecken“ oder „Wegwerfen“. Ein Doppelklick benutzt sie direkt.
  - Maus über eine Kachel halten und 1–9 drücken belegt den Slot sofort. Das klappt mit Maus und Touch.
- **Hotbar (1–9):**
  - Waffen werden gezogen, ein zweiter Druck steckt sie wieder weg.
  - Items wie Sturmhaube, Medkit, Essen oder Kanister werden direkt benutzt.
  - **0** nimmt die Fäuste, **H** steckt alles weg, das Mausrad wechselt zwischen den Waffen der Leiste.
  - Neue Waffen landen automatisch im nächsten freien Slot. Insgesamt passen jetzt 15 Waffen ins Inventar.
- **Flüssigere Steuerung:** Auf 120- und 144-Hz-Monitoren gingen Tastendrücke und Klicks verloren, wenn ein Bild keinen Logik-Schritt hatte. Behoben.

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
  - **Schüsse in Schichten** je Waffe:
    - Verschlussklick, Überschallknall, gesättigter Mündungsknall, tiefer Wumms und Körper
    - Bei Repetierern hörst du den Kammerstängel.
  - Ferne Schüsse kommen mit Schallverzögerung an, dumpfer, mit Echo von den Fassaden; drinnen mit Raumhall.
  - **Martinshorn:** Zweiton (A–D) mit Doppler-Effekt und Entfernungsfilter statt Dauerjaulen; im eigenen Streifenwagen leise.
  - **Motor-Synthese nach Drehzahl:**
    - 6-Gang-Getriebe, Zylinderzahl je Modell (Vierzylinder bis V12), Ansaugrauschen
    - Turbo-Pfeifen mit Blow-off, Schaltrucke, Fehlzündungen beim Gaswegnehmen
    - Elektroauto mit Surren
    - Das nächste Auto im Verkehr hat eine eigene Motorstimme.
  - Atem anhalten und Keuchen beim Zielen
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
| **1–9 / 0 / H** | Hotbar · Fäuste · alles wegstecken | **E an Zapfsäule** | Zapfpistole / Tanken |
| **Im Auto B / N** | Gurt · Motor | **Im Auto X / L** | Tempomat · Licht |
| **Im Auto Q / E** | Blinker | **Im Auto Shift / T** | Nitro · Werkstatt |
| **Im Auto LMB / RMB** | Drive-by bzw. MG · Raketen | **Im Auto F** | Aussteigen |
| **RMB mit Zielfernrohr** | Scope | **Shift im Scope** | Atem anhalten |

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
│                         police (Einheiten, Einsatzregeln), criminals, heists, crew, gangs,
│                         autos (Modelle, Schaden, Sprit, Cockpit), carservice (Autohaus, Tanken, Werkstatt, App)
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
  - `node tools/crime.mjs` prüft Unterwelt, Überfälle, Gangs und Reviere; `node tools/city.mjs` prüft Strand, Clubs, Tänzerinnen und Immobilien; `node tools/cars.mjs` prüft Sprit, Crashs, Verformung, Gurt, Laternen, Reifen, Tuning, Autohaus, Zapfsäule, Werkstatt und Car Service.
- **Speichern** in `localStorage`. Die Stadt wird aus dem Seed neu erzeugt, deshalb bleibt der Spielstand klein.

*Red Dragon Elite · pure HTML · CSS · JavaScript*
