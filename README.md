# ◢ Red Dragon Web Engine ◣
**RDWE · v3.1 · PHP 8.4+ · IIS · MariaDB**

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-red?style=for-the-badge)
![License](https://img.shields.io/badge/license-RDE%20Black%20Flag-black?style=for-the-badge)
![Nostr](https://img.shields.io/badge/Nostr-Decentralized-purple?style=for-the-badge)
![VERSION](https://img.shields.io/badge/VERSION-1.0.0-555555?style=flat-square)
![PHP](https://img.shields.io/badge/PHP-8.4+-777bb4?style=flat-square)
![IIS](https://img.shields.io/badge/SERVER-IIS-0078d4?style=flat-square)
![DB](https://img.shields.io/badge/DB-MariaDB-c0765a?style=flat-square)

> *Zero bloat. Zero bullshit. Built by developers, for developers.*

</div>

---

```
██████╗ ██████╗ ██╗    ██╗███████╗
██╔══██╗██╔══██╗██║    ██║██╔════╝
██████╔╝██║  ██║██║ █╗ ██║█████╗
██╔══██╗██║  ██║██║███╗██║██╔══╝
██║  ██║██████╔╝╚███╔███╔╝███████╗
╚═╝  ╚═╝╚═════╝  ╚══╝╚══╝ ╚══════╝
Red Dragon Web Engine · .:: RedDragonElite ::.
```

A free, open-source PHP web engine that actually respects your intelligence.  
No WordPress. No Laravel overhead. No jQuery. No Bootstrap. No Materialize.  
**Just pure PHP, pure speed, pure code — yours to own.**

🔗 **Website:** https://rd-elite.com/rdwe  
🎮 **DEMO:** https://rdwe.rd-elite.com  
🔌 **Nostr Signer:** https://github.com/RedDragonElite/rdwe_nostr_signer

---

## ⚡ What is RDWE?

RDWE is a **PHP 8.4+ web engine** built from scratch on IIS + MariaDB with zero external framework dependencies.  
Drop in a module folder. Open a browser. Done. No registration. No config files. No restarts.

It's simultaneously a **CMS**, a **developer framework**, and a **community platform** — all in one zero-bloat stack.

```
┌─────────────────────────────────────────────────────┐
│  CMS           Block editor, page management,       │
│                content system                       │
├─────────────────────────────────────────────────────┤
│  Framework     Auto-routing, module system,         │
│                zero-config drop-in modules          │
├─────────────────────────────────────────────────────┤
│  Community     Forum, messenger, user profiles,     │
│                visitor analytics, game dashboards   │
├─────────────────────────────────────────────────────┤
│  Nostr         Native NIP-07 signer, relay config,  │
│                note publishing, Nostr Terminal      │
└─────────────────────────────────────────────────────┘
```

---

## 🔥 Feature Highlights

- **Auto-Discovery Module System** — create `Core/Classes/MyModule/UI/index.php` and it's live. Zero config.
- **PSR-4 Autoloader** — drop a class in the right folder, it loads itself
- **Singleton PDO Database Layer** — one connection per request, shared across all modules
- **Firewall with Admin Toggles** — CSP, X-Frame-Options, HSTS, rate limiting, IP blocking — all toggleable at runtime
- **RDUI Design System** — terminal aesthetic, monospace-only, red/green/black — consistent across every page
- **Elder Futhark Error Pages** — 403 (police tape), 404 (matrix rain), 500 (crash console + fire) — because style matters
- **Argon2ID + AES-256-GCM Auth** — OWASP 2024 compliant, session fingerprinting, dual rate limiting
- **Nostr Integration** — native NIP-07 signer Chrome extension + Nostr Terminal built-in
- **IIS-Native** — built for Windows Server / IIS + PHP 8.4 + MariaDB, not Apache-ported
- **BFS v6.66 License** — free forever, always

---

## 📦 Tech Stack

| Layer | Tech |
|---|---|
| Backend | PHP 8.4+ |
| Database | MariaDB (PDO, no ORM) |
| Web Server | IIS (Microsoft) |
| Frontend | Vanilla JS + RDUI.css (no frameworks) |
| Auth | Argon2ID · AES-256-GCM · CSRF · Session fingerprinting |
| Icons | Lucide.js (SVG, no CDN dependency) |
| Fonts | Monospace only — Consolas / Monaco / Courier New |
| License | BFS v6.66 |

**Not in this stack:** jQuery · Bootstrap · Materialize · Laravel · Symfony · Composer · npm · webpack · React · anything else you don't need.

---

## 🗂 Module System

Every module lives in `Core/Classes/ModuleName/` and gets auto-routed:

```
Core/Classes/MyModule/
├── MyModule.php          ← extends Database
├── MyModuleAPI.php       ← API dispatcher
├── navdock.php           ← optional admin dock entry
└── UI/
    ├── index.php         → /MyModule
    ├── admin.php         → /MyModule/Admin  (God-only)
    └── api.php           → /MyModule/API/{action}
```

**No route registration. No config files. No restart required.**  
URLRewriter scans `Core/Classes/` on every request and auto-discovers any folder with a `UI/` subfolder.

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/RedDragonElite/rdwe.git

# 2. Point IIS to the document root
# 3. Copy Defines.php.example → Defines.php and fill in your DB credentials
# 4. Copy web.config.example → web.config
# 5. Open browser → /SignUp → create your God account
# 6. Done.
```

> PHP 8.4+ required. IIS with URL Rewrite module required. MariaDB/MySQL required.

---

## 🔌 Nostr Signer

RDWE ships with a dedicated **NIP-07 Chrome Extension** — the [RDWE Nostr Signer](https://github.com/RedDragonElite/rdwe_nostr_signer).

```
window.nostr.getPublicKey()         → your hex pubkey
window.nostr.signEvent(event)       → signed event (Schnorr)
window.nostr.nip04.encrypt(...)     → AES-256-CBC ECDH
window.nostr.nip44.encrypt(...)     → ChaCha20 + HMAC-SHA256
window.nostr.getRelays()            → your relay map
```

- Zero external dependencies
- Private key **never leaves the extension**
- Per-site permission system
- Full NIP-07 · NIP-04 · NIP-44 support
- BIP-340 Schnorr signing
- Compatible with Primal, Iris, Snort, Coracle, Nostrudel, Zap.stream

The RDWE Nostr Terminal (built into the engine) demonstrates the full Nostr integration stack.

---

## 🛡 Security

Built-in, zero config:

- ✅ Argon2ID password hashing (OWASP 2024)
- ✅ AES-256-GCM encryption with AAD
- ✅ Session fingerprinting (hijacking protection)
- ✅ Dual rate limiting: IP-based + account-based
- ✅ Account lockout after failed attempts
- ✅ CSRF double-submit cookie pattern
- ✅ Firewall with runtime-toggleable CSP, X-Frame-Options, HSTS
- ✅ Blocked IP list with auto-expiry
- ✅ Security event logging (DB + file)
- ✅ IIS — PHP sets all security headers dynamically (no duplicate header conflicts)

---

## 📁 Folder Structure

```
/ (DOCUMENT_ROOT)
├── Index.php              ← front controller
├── Init.php               ← boots everything
├── Defines.php            ← constants, DB config, paths
├── web.config             ← IIS URL rewriting
│
└── Core/
    ├── Assets/
    │   ├── CSS/           ← RDUI.css
    │   └── JS/            ← RDUI.js, lucide.js
    ├── Classes/           ← ALL modules
    │   ├── Accounts/
    │   ├── Firewall/
    │   ├── RDWEEditor/
    │   ├── Repo/
    │   ├── RDForum/
    │   └── [your modules here]
    ├── Functions/         ← auto-loaded helpers
    └── System/
        ├── Config/        ← custom_routes.json
        ├── Error/         ← 403 · 404 · 500 pages
        └── Logs/
```

---

## 🎨 Design System (RDUI)

All modules share one terminal aesthetic. No exceptions.

```css
:root {
  --bg: #000;       /* pure black */
  --red: #ff0000;   /* primary accent */
  --green: #00ff00; /* primary text */
  --b1: #1c1c1c;    /* borders */
  /* monospace font everywhere — always */
}
```

- Monospace-only typography (Consolas / Monaco / Courier New)
- Red/green/black terminal color system
- Component library: `.btn` `.badge` `.card` `.callout` `.rdwe-table` `.flow` `.steps`
- RDUI.js public API: `RDWE.toast.success()` · `RDWE.openModal()` · `RDWE.switchTab()`

---

## 🗺 Roadmap

- [x] Module auto-discovery system
- [x] PSR-4 autoloader
- [x] Firewall with runtime toggles
- [x] RDUI design system
- [x] Nostr Signer Chrome Extension
- [x] Nostr Terminal
- [x] Error pages (403 · 404 · 500)
- [ ] RDWEEditor — full block editor rebuild
- [ ] PageManager — CMS rebuild
- [ ] RDForum — forum rebuild
- [ ] Nostr full integration in Core (mid-2025)
- [ ] Mailer module
- [ ] Game Server Dashboard vertical (FiveM / GameCore)

---

## 📜 License

```
###################################################################################
#                                                                                 #
#      .:: RED DRAGON ELITE (RDE)  -  BLACK FLAG SOURCE LICENSE v6.66 ::.         #
#                                                                                 #
#   PROJECT:    ◢ Red Dragon Web Engine ◣ | RDWE · PHP 8.4+ · IIS · MariaDB      #
#   ARCHITECT:  .:: RDE ⧌ Shin [△ ᛋᛅᚱᛒᛅᚾᛏᛋ ᛒᛁᛏᛅ ▽] ::. | https://rd-elite.com     #
#   ORIGIN:     https://github.com/RedDragonElite                                 #
#                                                                                 #
#   WARNING: THIS CODE IS PROTECTED BY DIGITAL VOODOO AND PURE HATRED FOR LEAKERS #
#                                                                                 #
#   [ THE RULES OF THE GAME ]                                                     #
#                                                                                 #
#   1. // THE "FUCK GREED" PROTOCOL (FREE USE)                                    #
#      You are free to use, edit, and abuse this code on your server.             #
#      Learn from it. Break it. Fix it. That is the hacker way.                   #
#      Cost: 0.00€. If you paid for this, you got scammed by a rat.               #
#                                                                                 #
#   2. // THE TEBEX KILL SWITCH (COMMERCIAL SUICIDE)                              #
#      Listen closely, you parasites:                                             #
#      If I find this script on Tebex, Patreon, or in a paid "Premium Pack":      #
#      > I will DMCA your store into oblivion.                                    #
#      > I will publicly shame your community.                                    #
#      > I hope your server lag spikes to 9999ms every time you blink.            #
#      SELLING FREE WORK IS THEFT. AND I AM THE JUDGE.                            #
#                                                                                 #
#   3. // THE CREDIT OATH                                                         #
#      Keep this header. If you remove my name, you admit you have no skill.      #
#      You can add "Edited by [YourName]", but never erase the original creator.  #
#      Don't be a skid. Respect the architecture.                                 #
#                                                                                 #
#   4. // THE CURSE OF THE COPY-PASTE                                             #
#      This code uses advanced logic and cryptographic signatures.                #
#      If you just copy-paste without reading, it WILL break.                     #
#      Don't come crying to my DMs. RTFM or learn to code.                        #
#                                                                                 #
#   --------------------------------------------------------------------------    #
#   "We build the future on the graves of paid resources."                        #
#   "REJECT MODERN MEDIOCRITY. EMBRACE RDE SUPERIORITY."                          #
#   --------------------------------------------------------------------------    #
###################################################################################
```

---

## 🔗 Links

| | |
|---|---|
| 🌐 Website | https://rd-elite.com |
| 🚀 RDWE Info | https://rd-elite.com/rdwe |
| 🎮 Demo | https://rdwe.rd-elite.com |
| 🔌 Nostr Signer | https://github.com/RedDragonElite/rdwe_nostr_signer |

---

<div align="center">

**◢ .:: RedDragonElite ::. ◣**

*Crafted with 🔥 · Zero bloat · Free forever*

`PHP 8.4+` · `IIS` · `MariaDB` · `BFS v6.66`

</div>
