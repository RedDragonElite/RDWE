# RDE // KONTRAKT

🇩🇪 Deutsch: [README.de.md](README.de.md)

**An open-world assassin RPG in pure HTML, CSS and JavaScript.**
No framework, no images, no sound files: the city, the graphics, the music and every sound are generated procedurally in the browser.

You are a contract killer in **Port Raven**. You have a small flat in the Old Town, a phone, a piano wire and a P9. The city never sleeps. The contracts come in on your phone, and how you close them is your call.

▶ **Play:** https://reddragonelite.github.io/RDWE/games/kontrakt/ (GitHub Pages)
or locally: run `python3 -m http.server` in `games/kontrakt/`, then open `http://localhost:8000`.

---

## Features

- **Language:** The game is in English by default. German can be chosen under Settings → Sprache/Language, and the choice is saved.

### The City
- **A procedural metropolis (264×278 tiles, 10×10 blocks), 8 districts:**
  - Old Town, a sprawling Downtown, Sunhill (villas), city parks, the Canal District, the industrial zone, the Harbor with piers, boats and cranes, and Ocean Beach.
- **Around 230 enterable buildings with real interiors.** Step inside and the roofs fade away.
  - Bathrooms with tub, toilet and sink; living rooms with armchair, bookshelf and floor lamp; bedrooms with nightstand and dresser; kitchenettes.
  - Offices with water cooler, printer and coat rack; villas and executive suites with fireplace, aquarium and bar cart.
- **Street furniture:**
  - Bus stops, newspaper boxes, bike racks, planters, phone booths
  - Café tables with parasols outside bars and diners
  - Apartment blocks, offices, the Grand Hotel, villas with pool and garden, warehouses, police station, clinic, club, bar, diner, corner store, pharmacy, boutique, gun shop and black market.
- **Life on the streets:**
  - Pedestrians who follow a daily rhythm
  - Shopkeepers, cooks, waiters, doctors, bouncers, guards, police patrols and a harbor crew
- **Traffic that can actually drive:**
  - Keeps its lane, takes corners in smooth arcs and brakes gently behind the car ahead.
  - Waits at junctions until they are clear and signals before turning.
  - Overtakes stalled or abandoned cars when oncoming traffic allows, and honks at you if you're in the way.
- **Residents in every home:**
  - Every house and apartment has a household of 1 to 4 people, each with a job and a daily schedule: office workers, shift workers, night shift, retirees, students.
  - On weekdays the office crowd is gone during the day, students party on Friday and Saturday, and at night everyone sleeps in their own bed.
  - They leave through the front door for work and come back home again.
  - **Hold T at a front door:** listen for whether anyone is home, and whether they're awake.
  - Sleepers can't see you, but noise wakes them. Anyone who catches you runs and calls the police. Some keep a pistol in the nightstand.
  - Dead tenants stay dead; after three days someone new moves in.
- **City services clean up** (1 second = 1 game minute):
  - Found bodies are collected by the undertaker after 25–50 minutes. Unfound ones turn up after 2.5–5 hours.
  - Then street cleaning mops up the blood.
  - The utility company replaces broken streetlights after 6–14 hours; flattened hydrants, benches and signs are back up after 2.5–7 hours.
  - Burned-out wrecks are towed away after 1–2.5 hours.
  - Drag a body away and the pool of blood stays where it fell. Only a drag trail comes along, fading over time. At the new spot only a small pool forms, and the cleaners mop up both places.
  - All other blood stains, skid marks and shell casings fade in about one game day; rain washes them away in a few hours.
  - Garbage collection empties the dumpsters every other morning at 06:00, bodies included. Sometimes the police radio reports the find.
  - Near you, the crews arrive in their own vehicle and do the job on foot. Elsewhere in the city it simply happens.
- **Day-night cycle:** 1 second of real time equals 1 game minute.
  - Streetlights, lit windows, neon signs and headlights: every car throws two light cones, one from each lamp, and has two tail lights
  - Sun shadows that travel with the time of day
- **Weather:** clear, overcast, rain, thunderstorms with lightning and thunder, fog.
  - Rain muffles gunshots and footsteps, fog cuts sight lines, wet streets mirror the lights.
  - Real cloud shadows from seamless noise: hard-edged and drifting under broken cloud, an even gray under full overcast, moving with the wind.
  - Fog built from two drifting layers with parallax, dark at night instead of glowing; rain brings haze with it.

### Assassin Gameplay
- **Contracts by phone.** Every contract comes with:
  - a random target with dossier photo and biography
  - a daily routine across several locations, plus bodyguards
  - a deadline and bonus objectives: Silent Assassin, Target Only, Accident, Signature Weapon, Headshot, In Disguise
- **Buy intel:** the target is marked live. Without intel you only know the rough area.
- **Rating at the end of every contract:** Phantom, Silent Assassin, Professional, Butcher or Public Enemy, with payout and XP.
- **Disguises:**
  - Take the clothes off unconscious or dead NPCs (**T**).
  - Guards, police officers, cooks, waiters and doctors have access to restricted areas.
  - "Enforcers" (marked orange in Instinct view) see through disguises up close.
- **Perception:** vision cones, light and shadow, crouching, noise radii.
  - Suspicion meters above heads (? → !).
  - Guards warn, search, raise the alarm and wake up colleagues who've been knocked out.
- **Takedowns from behind (F):**
  - Piano wire (silent, no blood), knife, chokehold (unconscious)
  - Poison or sedative syringe (poison counts as an accident)
- **Bodies** can be dragged (**E**) and stuffed into dumpsters, lockers or closets. Discovered bodies trigger the alarm.
- **Throwing coins** distracts guards.
- **Instinct (hold Q):**
  - See guards, targets and police through walls
  - Highlight hiding spots
  - The world drains of color
- **Field of view:** what lies behind walls stays in the dark.

### Combat
- **Weapons:**
  - **Pistols:** P9 Compact, Silberbaron .45 SD, Magnum .357
  - **Submachine gun:** MP-K
  - **Shotgun:** Pump-12
  - **Assault rifles:** K-47, Kolibri AR-15 (5.56)
  - **LMG:** Brecher M60 with a 100-round belt; slows you down
  - **Marksman rifles:** Falke DMR (semi-auto, 4×), Wisper VSS (integrated suppressor, 9×39)
  - **Sniper rifles:**
    - Jäger 700 (bolt action, 8×)
    - Kodiak .50 BMG: anti-materiel, punches through cars, doors and the people behind them
- **Scope (RMB):**
  - The camera pulls far out and looks ahead.
  - A scope overlay shows a mil-dot reticle, range, magazine and target identification.
  - The rifle sways with your pulse, more at long range, while moving, drunk or out of breath. Crouching steadies it.
  - **Shift** holds your breath: the reticle goes almost still until your air runs out. Then you gasp for a few seconds.
  - Fired from the hip, scoped weapons spray wildly.
- **Where to get them:** AR-15, DMR and 5.56 are sold at the gun shop. VSS, Kodiak, M60, .50 BMG and 9×39 come from the black market. SWAT now rolls in with AR-15s and DMR marksmen.
- **Melee:** fists with combos, knife, baseball bat, crowbar, machete, katana.
- **Throwables:** grenades, coins and remote-detonated C4.
- **Ammo types and reloading (R):**
  - Magazines; the shotgun loads shell by shell
  - Recoil and spread (movement, crouching, aiming with RMB)
  - Suppressors as an add-on
- **Ballistics:** real projectiles with tracers, headshots, sniper over-penetration and glass that shatters.
- **Blood and gore** (can be turned off):
  - Blood mist, splatter on floors and walls, spreading pools, bloody footprints, drag trails
  - Body parts from explosions and shotgun headshots
- **Police and wanted level (1–5 stars), realistic:**
  - No more foot patrols: two patrol cars cruise the city by day, one at night.
  - Witnesses call it in, and dispatch sends a unit **from far away**. It drives in over the road network, parks, gets out, investigates and leaves again.
  - Rules of engagement: arrest first. Officers only open fire on armed or shooting suspects, from 3 stars on anyone armed or in a car, and from 4 stars always.
  - Runners get tackled. More stars bring more units, and from 4 stars on, SWAT.
  - Patrol cars chase you with sirens. An unseen change of outfit drops your wanted level by 2 stars.
- **NPC criminals:**
  - Muggers rob pedestrians and hold up shops.
  - Victims and witnesses call the police, who go after the mugger, not you.
  - Unarmed muggers are cuffed and taken away.
  - Stop one yourself and you're a **Street Hero**. That earns XP and no charges.

### Manhunt (based on rde_aipd, plus a real search)
- **Emergency calls instead of omniscience:**
  - Witnesses call the police depending on district, time of day and shock: from 20 % at the Harbor to 60 % Downtown, less often at night.
  - A call takes 5–9 s: react, panic, phone out, dial, talk. A ring above their head shows how long is left.
  - Walk up to the caller once the phone is out and they hang up, intimidated. The unconscious and the dead don't make calls.
  - What gets reported is the crime scene, not where you are now.
- **Police radio:** every sighting goes out to all units with position and heading.
- **Search after losing sight:**
  - A search area opens at the predicted location and grows over time.
  - Two officers search on foot and fan out. They check unsearched ground, corners and hiding spots and tick off areas. All other cars sweep the surrounding streets.
  - A fresh sighting pulls everyone in at once.
  - HUD and minimap show "VISUAL CONTACT", "SEARCHING" or "OUT OF SIGHT" and the search area.
- **Stars only drop when you're unseen:** after 15 s without visual contact, then one star every 20 s (rde_aipd).
- **Units per level:** 2/3/4/5/6, at most 8.
- **Tackles** land 15–55 % of the time depending on level. A miss sends the officer stumbling.
- **Helicopter from 3 stars:**
  - It follows you or circles the search area.
  - Its searchlight only finds you out in the open, never under a roof.
  - Rifles can bring it down.
- **Car chases:**
  - PIT maneuvers that kick your rear end out.
  - Roadblocks ahead of you (from 3 stars), spike strips (from 4).
  - Without visual contact the pursuit heads for the radioed position, not for you.
- **Hiding:** in dumpsters, closets and lockers (hold **T**, **E** to get out). Searching officers check hiding spots right next to them.

### Injuries & EMS (based on rde_aimd, extended)
- **Hit zones:**
  - **Head:** lethal, ×2.6 on NPCs
  - **Torso:** ×1; body armor only protects here
  - **Arms:** ×0.6
  - **Legs:** ×0.7
- **Bleeding:** depending on zone and damage, wounds bleed. Hits to a leg, arm or torso can nick an artery, and that bleeds hard.
- **Fractures:** a broken leg makes you limp, no sprinting. A broken arm shakes and spreads your shots. NPCs suffer the same.
- **Treatment:**
  - Bandage: light bleeding only
  - Tourniquet: arm or leg, arteries included
  - Splint: sets a fracture
  - Medkit: stops all bleeding
  - Clinic: stitches and sets everything
- **Critical condition instead of instant death** (for you and NPCs):
  - Anyone who goes down keeps losing blood (0–100 %, 0.5–1.6 %/s depending on the wound).
  - One more shot or 100 % blood loss means the end.
  - Clean headshots, overkill, takedowns and poison still kill instantly.
- **Emergency call 112:**
  - Witnesses call an ambulance. It comes in from out of town with lights flashing, over the road network.
  - Two paramedics get out and treat the patient on the spot for 10 s. Then the patient gets back up.
  - As long as help is on the way, nobody dies (rde_aimd).
- **You, down:**
  - An overlay with blood loss, injury and time; a heartbeat that keeps getting faster.
  - **E** calls the ambulance ($750 + distance). **X** lets you give up after 20 s, and it's off to the clinic.
  - A crew member carrying bandages can bring you back.
  - If you're wanted, the police cuff you where you lie.
- **First aid:** hold **E** on the wounded, with a bandage, tourniquet or medkit. It stabilizes them, earns Lifesaver XP, and they get back up later.
- **HUD:** a body diagram shows wounds, fractures and arteries. The wounded have a red cross with a blood-loss ring above them, and the minimap shows ambulances.

### Underworld: Crime, Jail, Drugs
- **Self-defense:** if someone attacks you first (gangsters, thugs, street muggers, a passerby swinging fists), you can fight back without becoming wanted. Witnesses don't report it, and cops who see it go after the attacker. That doesn't apply if you started it, if you're already wanted, or against police, guards or bodyguards.
- **Criminal record:** every reported crime is added to the charge sheet, each with its own sentence (robbery 4h, murder 10h, killing a cop 20h …).
  - Escape the manhunt and the charges are dropped.
- **Surrender (X):** hands up, the police cuff you. That earns 30% off your sentence. Move afterwards and you're resisting arrest.
- **Jail with a timer:**
  - Fast-track trial with a verdict, prison clothes and a real cell in the police station.
  - Inside, time runs 14× faster.
  - You get out with **bail (K)** or by **breaking out:** pick the cell door when no guard is looking. After that you're wanted at 3 stars as an escapee.
  - On arrest, firearms, drugs, stolen goods and burglary tools are confiscated.
- **Hold-ups:** aim your gun (RMB) at someone and their hands go up.
  - Robbing pedestrians (E) gets you wallet, phone and jewelry.
  - Emptying a shop register: a silent alarm calls the police after 9 s.
- **Pickpocketing** from behind (hold E). Botch it and the victim screams.
- **Burglary:** rifle through closets, shelves, desks, fridges, lockers and crates (E). Sell the loot to the fence at the black market.
- **ATMs** can be hacked (hacking device from the black market).
- **Bank account:**
  - Deposit and withdraw at ATMs. Fees and income go straight to your account.
  - Legal shops take cards; the black market and dealers take cash only.
  - When you die, you only lose your cash.
- **Balaclava:** witnesses can't identify you. Taking the mask off unseen wipes your wanted level. But masked up you look suspicious, and cops will order: "Mask off!"
- **Grow system:**
  - Seeds, pots, fertilizer and a watering can are sold at "Green Luck Garden Supply".
  - Plants grow in your properties in real time and need water or they wither. Fertilizer improves speed and quality.
  - Harvesting yields weed.
- **Dealer system:**
  - Approach pedestrians (T). At night, and at the Harbor, in the park and in Old Town, more people buy.
  - Your dealer reputation pushes prices and quantities up.
  - Some people snitch, and cops who are watching step in.
  - Wholesale at the black market: safe, but cheap.

### Bank and Jewelry Heists
- **Port Raven Savings Bank:**
  - Counters with tellers, a security guard in the lobby, guards in the back.
  - The **manager carries the vault keycard**: pickpocket it or search him once he's out cold.
- **Opening the vault door:**
  - **Keycard:** quiet. The time lock reports the opening after about 35 s.
  - **Thermal drill** (black market, hold T, approx. 20 s): loud, draws guards.
  - **C4:** blows the door; the whole street hears it.
- **Loot:**
  - Cracking safe-deposit boxes yields cash, gold bars, jewelry and diamonds.
  - The bank counter can also be cleaned out directly.
  - Robbing the bank means 3 stars, alarm bells and multiple units.
- **Goldmann Jewelers:** smashing display cases (T) gets you jewelry, watches and diamonds. The panic button goes off after 5 s.
- **The next day** the vault is sealed and restocked. Fence the hot goods.

### Hire a Crew (based on RDE Bodyguards)
- **The broker "Claw"** at the "Blue Angel" bar offers 3 candidates every day:
  - Rarity: Common 60%, Uncommon 25%, Rare 10%, Epic 4%, Legendary 1%.
  - Personality: Stoic, Loyal, Aggressive, Caring, Professional, each with their own lines.
  - Five skills: Shooting, Melee, Stamina, Tactics, Medicine.
- **Size:** up to 8 people on the roster, 3 deployed at once.
- **Deployment:**
  - Called-in crew members come running in from off-screen.
  - They follow in formation (Follow, Diamond, Wedge, Column) and get into your car with you.
  - They defend you and patch themselves up.
- **Orders (B):**
  - Follow, Hold Position, Attack Everything, Heal Me, Holster/Draw Weapons, Send Home.
  - Stance: Peaceful, Defensive or Aggressive. **V** attacks the target under the crosshair.
  - You can hand them your current weapon.
- **Progression:**
  - Levels with skill gains, and morale (Motivated to Broken) as a combat multiplier.
  - Bond levels from Hired through Comrade, Confidant and Blood Brother up to Legendary Bond. Talking (T) strengthens the bond.
- **Cost and risk:**
  - Daily wages. Anyone who goes unpaid loses morale and quits.
  - Anyone who falls spends 24 hrs in the clinic, or is discharged immediately for a fee.
  - If your crew kills bystanders or police, it goes on your record.

### Gangs, Turf & Gang Wars (based on RDE Crew)
- **Three street gangs:** the Volkov Bratva (Harbor/Industrial), the Canal Street Vipers (Old Town) and the Golden Lotus Triad (Canal District). Their members wear bandanas in gang colors and hang out on their blocks.
- **Found your own gang** through the broker ($5,000):
  - Choose a name and a gang color.
  - **Draw your tag freehand with the mouse:** 6 caps from Skinny to Ultra Fat (fat caps with an overspray edge), 9 colors, undo with Z.
- **Turf:**
  - Every city block has a tag spot. Claim it with a spray can (hold E): **last spray wins**.
  - Your tag appears on the pavement, and the map paints the block in your color.
- **Declare war:**
  - Enemy turf can only be sprayed over during a war.
  - The gang attacks you and your crew on sight and **raids your blocks**: a squad shows up and sprays back unless you stop them.
  - Peace can be bought. When a gang loses its last block, it's finished.
- **Income:** every block you own brings in $150 a day. Dealing on your own turf pays +25%.

### Your Organization: Rank, Protection, Corners, Businesses
- **Underworld rank:** Street Rat → Small-Timer → Soldier → Capo → Underboss → Godfather. Reputation comes from protection money, sales, upgrades and turf. Higher rank means more corners and more respect.
- **Protection racket:**
  - Inside a shop, hold **T** at the owner: "Demand protection money".
  - Whether he caves depends on a drawn weapon, your crew, whether it's your turf, your rank, and whether you've recently shot up the place. Rival turf or an armed owner makes it harder.
  - If he says no, he may call the police (extortion), or the gang that owns the block sends people.
  - The first payment is immediate. After that the money waits at the register every day (**T**: collect). On your own turf your gang collects automatically.
  - Don't show your face for 5 days and the shop stops paying. If a rival gang takes over the block, the shop switches sides.
- **Corner dealers:**
  - Phone › Organization › Corners: "Open a corner here" ($600, the dealer keeps 20 %).
  - Supply him with weed, crystal or coke (**E** on the dealer). He sells depending on district, time of day and turf, even when you're far away or asleep. Buyers visibly walk up to him.
  - There are raids, especially Downtown, less often on your own turf: dealer, product and cash are gone. On rival turf he gets robbed more often.
- **Upgrade legal businesses:** renovation (+25 %), staff (+20 %), advertising and neon (+15 % daily revenue).
- **Turf wars without you:** the three gangs take blocks off each other, and the bigger gang tends to win. They only hit your blocks during a war.
- **Phone › Organization:** rank and reputation, daily income by source (businesses, turf, protection, dealers), every shop with outstanding amounts, every corner with product and cash, business upgrades.

### Vice Look, Ocean Beach & Nightlife
- **Vice grading** (can be turned off in the options): purple shadows, teal midtones, pink and orange highlights, strongest at golden hour.
- **Palm boulevards** Downtown, in Sunhill and along the beach, with pink and cyan streetlights on Ocean Drive.
- **Ocean Beach:** sand down to the water, a boardwalk, loungers, parasols, surfboards, a lifeguard tower and beachgoers by day.
- **Beach Club "Flamingo" and Beach Club "Sunset":** pool deck, cocktail bar, DJ booth and neon. At night, people dance.
- **Strip club "Velvet":** neon stage with two poles, dancers, bouncers, a champagne bar and a VIP area.
  - Tip (E) or book a private dance (T).
  - Regulars hear things: after a few tips, a dancer tells you where your contract target is (free intel).
- **Tactical city map (M):**
  - Graphite dossier look with a survey grid, district names in Oswald, turf in gang colors.
  - The mouse wheel zooms up to 12× toward the cursor, drag to pan, click to set a waypoint.
  - Zoomed in close, the map shows the names of every building and shop, plus a scale bar.
  - The legend is its own column beside the map, sorted by group, and can be hidden with L.
- **14 properties**, 7 of them businesses with daily income:
  - Bar ($1,500 a day), gas station ($900), diner ($700), auto shop ($1,200)
  - Beach Club "Sunset" ($2,000), Beach Club "Flamingo" ($2,600), strip club "Velvet" ($3,400)
  - New homes: Canal District apartment and Ocean Drive beach house.

### Cars: Dealership, Fuel, Garage, Car Service (based on rde_fuel, rde_mechanic, rde_carservice, rde_carhud)
- **12 models, each with its own silhouette:** Brisa Mini, Vela sedan, panel van, Hauler pickup, Corsa GT, Ranger SUV, Bulldog V8, Volta E (electric), Furia S and Spectre RS (234 km/h). Every model also shows up in traffic.
- **Port Raven Motors** (Downtown):
  - Showroom with a salesman and display cars on the lot.
  - Catalog with stats (top speed, acceleration, handling, brakes, consumption) and factory color.
  - Cars you buy are yours and are saved with their condition and tuning.
- **Realistic damage:**
  - The body dents exactly where you hit (28-point deformation), plus scratches, broken headlights and tail lights and a cracked windshield.
  - Engine, body, tank and all 4 tires each have their own health.
  - Tires can be shot out and then grind sparks off the rim. A leaking tank spills fuel.
  - A dying engine smokes light, then dark, then catches fire.
- **Knock things down:** streetlights (the light goes out), hydrants (water fountain), benches, trash cans, bollards, vending machines and signs topple. Trees and walls hold.
- **Refueling like rde_fuel:**
  - Take the nozzle (E). The hose stretches taut; walk too far and you drop the nozzle.
  - Plug it into the tank (E) and watch the pump's 7-segment display.
  - You pay at the end; at "NOT ENOUGH MONEY" the pump stops.
  - Jerry cans, spare tires and repair kits are sold at the kiosk.
  - Empty tank: the engine sputters and dies. The Volta E runs on electricity.
- **The "Vise" garage, like rde_mechanic:**
  - Drive onto a lift, then press T.
  - Repairs with price and duration: a mechanic walks to the hood, sparks fly, and everything gets fixed piece by piece.
  - Tuning with a preview; only "✅ Buy" or "❌ Cancel" makes it final. Prices scale with the vehicle class.
    - Performance: engine 1–4, transmission, brakes, suspension, armor 1–4, turbo (with blow-off valve or flutter), exhaust (sport or straight pipe, with visible tailpipes), sport, drift or bulletproof tires, nitro.
    - Tune a car that isn't yours yet (a stolen one, for example) and it joins your fleet. The tuning is saved with your game.
    - Paint: 22 colors in Classic, Matte, Metallic, Special and Chrome, plus stripes and rims.
    - Lights: xenon and 14 neon underglow colors.
    - Body: spoilers, hood, window tint, horns.
    - Vehicle weapons: machine gun and rockets.
- **Car Service (phone app):**
  - A driver delivers your stored car to your location ($750), with ETA, minimap tracking, a honk on arrival and a key handover.
  - Or he picks up a parked car and takes it to the garage ($500).
  - Totaled? Insurance replaces it for 15% of the list price.
- **Dashboard (rde_carhud):**
  - Speedometer up to 280 km/h, tachometer with redline, gear (N/R/1–6), odometer, fuel and engine temperature.
  - Warning lights for engine, seatbelt, cruise control and lights, tire status FL/FR/RL/RR, plus NOS and boost gauges.
  - Banners for overheating and an empty tank, and a crack overlay for the windshield.
- **Driving:**
  - Start the engine. Stolen cars have to be hotwired first.
  - Seatbelt (B): without it, you fly through the windshield from about 75 km/h.
  - Engine temperature: heat costs power, and above 140 °C the engine is damaged.
  - Plus cruise control (X), turn signals (Q/E), low and high beams (L) and nitro (Shift).
- **Put your fists away (H):** hands down, no accidental punches. The first click raises your fists.

### Inventory & Hotbar
- **Drag-and-drop inventory (TAB):**
  - Weapons and items sit as tiles in the inventory and can be dragged into the 9 hotbar slots.
  - Slots can be swapped with each other. Drag a slot off the bar or right-click it to clear it.
  - Drop a tile on "Use", "Holster All" or "Discard". Double-click uses it directly.
  - Hover over a tile and press 1–9 to assign it to that slot instantly. Works with mouse and touch.
- **Hotbar (1–9):**
  - Weapons are drawn; a second press holsters them.
  - Items like the balaclava, medkit, food or jerry can are used directly.
  - **0** switches to fists, **H** holsters everything, the mouse wheel cycles through the weapons on the bar.
  - New weapons automatically land in the next free slot. The inventory now holds up to 15 weapons.
- **Smoother controls:** on 120 and 144 Hz monitors, key presses and clicks used to get lost when a frame had no logic step. Fixed.

### Prop System (based on rde_props, rde_placeable_items, rde_props_interact)
- **28 placeable props** in four groups:
  - **Street & construction** (auto shop): traffic cone, barrier, warning sign, work light with real lighting, folding table, folding chair, gazebo
  - **Furnishings** ("Furnishings" phone app, a courier delivers instantly): leather sofa, club chair, coffee table, monstera, floor lamp, OLED TV, Persian rug, box-spring bed (sleep & save), jukebox, pool table, alarm system
  - **Storage & safes:** wooden crate, aluminum case, storage rack, safe, XL gun safe, weapon rack (displays the stored weapons)
  - **Stations** (black market): packing table, chem lab, coke station, weapons workbench
- **Placing:** use the item (inventory, hotbar or double-click).
  - A ghost follows the mouse: purple means "fits", red means "doesn't fit", with a reason (too far away, spot taken, wall, blocks a door, only in your property …).
  - **R** or the mouse wheel rotates, **LMB** places, **RMB** or **ESC** cancels. The bar at the bottom shows keys and status.
  - Furniture, safes and stations only go in your own properties. Construction gear, crates and cases can also go on the street.
  - Up to 60 props, 30 per property. Props block paths, bullets and AI pathfinding.
- **Packing up:** hold **T** next to a prop to put it back in your inventory. Containers must be empty, stations must not be running.
- **Containers:**
  - Slots and weight limits (case 5 slots/20 kg … gun safe 20 slots/200 kg). The weapon rack only takes weapons.
  - Combination lock with a changeable 4-digit code.
- **Burglars** come at night at 03:00:
  - Unlocked crates get looted, far more often out on the street.
  - A simple lock sometimes holds, a safe usually does. Nobody cracks the XL gun safe.
  - With an alarm system, nobody gets in.
- **Stations** keep running on game time, even while you're away or asleep. A progress ring floats above the station.
  - Packing table: 25 g weed → vacuum-sealed weed brick (black market pays $480)
  - Chem lab: chemicals → 8 crystal (street price approx. $55 each). It reeks, neighbors call the cops, and it can blow up.
  - Coke station: coca paste + cutting agent → 14 coke (street price approx. $110)
  - Weapons workbench: weapon parts → 9mm, 5.56, 7.62, .308, .50 BMG, suppressors, lockpicks
- **Street sales** automatically take the most valuable product first: coke, then crystal, then weed.
- **Cars** knock over cones, barriers and signs. Whatever gets destroyed is gone.
- Everything is saved with your game, including contents, codes and running production.

### Life, Economy, RPG
- **Hunger, thirst, energy, stamina, bleeding, drunkenness and painkillers.**
- **Eat and drink** at the diner, the bar, the corner store and vending machines.
- **Sleeping** in your own bed skips time and saves the game.
- **Buy property:** the flat, an old-town apartment, the penthouse loft, a warehouse, the "Blue Angel" bar and a villa.
  - Every property has a bed, a wardrobe and an armory.
  - Businesses pay out daily.
- **Shops:**
  - Gun shop and black market (buy and sell)
  - Pharmacy, boutique (outfits) and clinic (treatment)
- **Burglary:** pick locks with a lockpick or crowbar, empty safes, go through the pockets of the unconscious.
- **Vehicles:**
  - Steal cars (F); drivers throw you out or flee; police cars with sirens (R).
  - Arcade physics with drifting (Space), crashes, burning wrecks and drive-bys with a pistol or SMG.
- **XP and 6 skills** with 5 levels each: Stealth, Marksman, Melee, Stamina, Disguise, Survival.

### Graphics and Sound (2026-grade tech, but only Canvas and WebAudio)
- **Baked ground chunks** with procedural textures: asphalt, cobblestone, parquet, marble, carpet, grass.
- **Ambient occlusion** along walls.
- **Lightmap** with multiply compositing. Light from room lamps doesn't bleed through walls.
- **Cloud shadows** (seamless, darkening the lightmap) and visible light cones.
- **WebGL2 post-FX:**
  - Bloom, chromatic aberration on hits, color grading
  - Instinct desaturation (red stays), drunken wobble, film grain
- **Dynamic resolution** holds the frame rate.
- **Procedural 3D sound:**
  - **Real engine recordings:** boxer four, inline six, several V8s (including a crossplane in the pickup), V12, diesel and electric.
    - Recorded at fixed RPMs as seamless 2.4-second loops at full quality (44.1 kHz) and crossfaded live by RPM.
    - Underneath runs a real transmission model: gear ratios per engine (5 to 7 gears), early shifts when cruising and late ones at full throttle, kick-down, a slipping clutch when pulling away, RPM inertia when revving in place and a stuttering rev limiter.
    - Under load the engine barks with bass and exhaust rasp; on overrun it sounds hollow and quiet. On upshifts the revs drop, drive cuts out for a moment and the gearbox clunks.
    - Sport engines and sport exhausts crackle when you lift off (with flames from the exhaust) and on full-throttle shifts.
    - **Turbo:** the charger whistles up with boost pressure, which builds with a delay. On shifts and lift-off the blow-off valve hisses, or the turbo flutters ("stu-tu-tu") if you fit the version without a valve.
    - Plus real metal crash recordings. Sources in `sfx/CREDITS.md` (CC BY 4.0 / CC0).
  - **Gunshots as a physical model** instead of synth tones: Friedlander blast wave, ground reflection, facade echoes, city reverb and an overdriven microphone. Each weapon gets three close variants and one distant variant pre-rendered.
  - **Layered gunshots** per weapon:
    - Action click, supersonic crack, saturated muzzle blast, deep thump and body
    - On bolt-action rifles you hear the bolt being worked.
  - Distant shots arrive with the delay of sound, duller, echoing off the facades; indoors with room reverb.
  - **Sirens:** two-tone (A–D) with Doppler effect and distance filtering instead of an endless wail; quiet inside your own patrol car.
  - Without loaded recordings (e.g. over `file://`), an engine synth takes over.
  - The nearest car in traffic gets its own engine voice with its own transmission.
  - Holding your breath and gasping while aiming
  - Footsteps by surface, shell casings, glass, explosions with ear ringing
  - Sirens, engines, rain, wind, crickets in the park at night, gulls at the harbor, club bass
- **Generative noir music:** Rhodes, upright bass, brushes and a late-night trumpet. Tension and combat are crossfaded dynamically.
- **NPC voices** via speech synthesis (can be turned off).

---

## Controls

| Key | Action | Key | Action |
|---|---|---|---|
| **W A S D** | Move | **Mouse** | Aim |
| **Shift** | Sprint | **LMB** | Attack / Shoot / Throw |
| **C** | Crouch | **RMB** | Precision aim / Scope |
| **Tap E** | Pick up · Search · Use (whatever you're looking at) | **Hold E** | Drag body / unconscious |
| **R** | Reload | **Hold T at front door** | Listen |
| **F** | Takedown / Car | **T** | Take disguise |
| **Q** (hold) | Instinct | **G** | Detonate C4 |
| **1–9 / Mouse wheel** | Select weapon | **H** | Holster |
| **TAB** | Inventory | **P** | Phone |
| **M** | Map: mouse wheel/+− zoom, drag/arrows pan, Space centers on you, 0 whole city, L legend | **L** | Flashlight |
| **Z** | Zoom level | **ESC** | Pause |
| **Space** | Handbrake | **F11** | Fullscreen |
| **X** | Surrender | **K** | Pay bail |
| **RMB on a person** | Hold-up | **T at pedestrians** | Offer weed |
| **B** | Crew menu & gang | **V** | Crew: attack target |
| **E/T at vault door** | Keycard / Drill | **T at display case** | Smash |
| **E at tag spot** | Spray turf | **Z (tag editor)** | Undo |
| **1–9 / 0 / H** | Hotbar · Fists · Holster all | **E at fuel pump** | Nozzle / Refuel |
| **In car B / N** | Seatbelt · Engine | **In car X / L** | Cruise control · Lights |
| **In car Q / E** | Turn signals | **In car Shift / T** | Nitro · Garage |
| **In car LMB / RMB** | Drive-by or MG · Rockets | **In car F** | Get out |
| **RMB with scoped rifle** | Scope | **Shift while scoped** | Hold breath |
| **Placing a prop: R / Mouse wheel** | Rotate | **LMB / RMB / ESC** | Place · Cancel |
| **E at prop** | Open · Station · Sleep | **Hold T at prop** | Pack up |

---

## Architecture

```
games/kontrakt/
├── index.html            HUD, phone, panel and menu markup
├── css/style.css         noir HUD, phone, panels
├── js/core/              util (RNG, noise, names), data (weapons, items, outfits, shops, buildings, skills)
├── js/world/             citygen (districts, buildings, rooms, furniture, lights, zones), nav (A*, line of sight, raycasts)
├── js/game/              world (physics, doors, time, weather, light, noise) + mixins:
│                         economy, combat, crime, ai, contracts, vehicles, player, underworld,
│                         police (units, rules of engagement), criminals, heists, crew, gangs,
│                         autos (models, damage, fuel, dashboard), carservice (dealership, fuel, garage, app)
│                         nightlife, hotbar, props (placing, containers, locks, stations, burglars),
│                         manhunt, medical, org, residents (households, daily routines, sleep),
│                         services (undertaker, street cleaning, utilities, towing, garbage collection)
├── js/render/            textures, sprites (people, cars, furniture), fx (particles, decals),
│                         renderer (chunks, roofs, shadows, field of view, lightmap, weather, overlay), post (WebGL2)
├── js/audio/audio.js     procedural SFX, ambience and generative music
├── js/ui/                ui (HUD, minimap), menus (phone, inventory, shops, map, title), input
├── js/lang/de.js         German translation (generated from tools/i18n-parts/*.json)
├── js/main.js            game loop, saving, settings, title drone flight, voices
└── tools/                sim.mjs (headless playtest), scenarios.mjs (AI behavior), crime.mjs (jail, robbery, grow, bank), gen.mjs (city dump),
                          i18n.mjs (translation check), i18n-merge.mjs + i18n-parts/ (German texts)
```

- **Translation:** source texts in the code are English and go through `K.tr('…')`. The German texts live in `js/lang/de.js`, which is generated from `tools/i18n-parts/*.json` by `node tools/i18n-merge.mjs`.
- **Decoupled simulation:** `K.World` runs entirely without the DOM, in Node too.
  - `node tools/sim.mjs` plays through walking, shooting, a contract, a takedown, driving, 5 game hours and saving, all headless.
  - `node tools/scenarios.mjs` tests the AI: trespassing, disguises, coin distraction, body discovery, witnesses calling the police, piano wire.
  - `node tools/crime.mjs` tests the underworld, hold-ups, gangs and turf; `node tools/city.mjs` tests the beach, clubs, dancers and properties; `node tools/cars.mjs` tests fuel, crashes, deformation, seatbelt, streetlights, tires, tuning, dealership, fuel pump, garage and Car Service.
  - `node tools/arms.mjs` tests sniper rifles, scope sway, breath holding and .50 penetration; `node tools/props.mjs` tests placing, containers, locks, stations, burglars and prop saving; `node tools/hunt.mjs` tests emergency calls, radio, search, star decay, hiding spots, helicopter, roadblocks and PIT; `node tools/medical.mjs` tests hit zones, bleeding, fractures, critical condition, first aid and ambulances; `node tools/org.mjs` tests rank, protection money, dealers, businesses and gang turf wars.
  - `node tools/life.mjs` tests households, daily routines, sleepers, burglary reactions, new tenants, the E-key split, all city services and traffic (accidents, jams, lanes, turn signals).
  - `node tools/i18n.mjs` checks that every translation key has a German entry with matching placeholders, and that no German is left in the English build.
- **Saves** go to `localStorage`. The city is regenerated from its seed, so save files stay small.

*Red Dragon Elite · pure HTML · CSS · JavaScript*
