# NEONSPIRE

A neon-cyberpunk, Slay-the-Spire-like deck-building roguelike for the browser.
Climb three acts of procedurally generated maps, fight AI-driven enemies in
turn-based card combat, collect cards and relics — then delete **THE ARCHITECT**.

![combat](docs/combat.png)

| | |
|---|---|
| ![menu](docs/menu.png) | ![map](docs/map.png) |

## Play

```bash
npm install
npm run dev          # solo mode at http://localhost:5173 — fully offline, no backend
```

Solo vs. AI is **100% standalone**: every rule runs in the browser, runs
auto-save to `localStorage`, and the built app is a static bundle (~29 KB
gzipped JS) you can host anywhere.

### PvP (optional)

```bash
npm run dev:server   # WebSocket matchmaking + rules server on :8787
```

Open the game, hit **PVP DUEL**, queue in two tabs (or two machines pointed at
the same server). For production: `npm run build && npm start` — the server
serves the built client and the WebSocket on one port.

```bash
npm test             # engine test suite (21 tests, incl. full simulated runs)
npm run typecheck    # strict TS across all three packages
```

## The one-engine rule

The whole point of the architecture: **game logic exists exactly once.**

```
shared/   @neonspire/engine — pure TypeScript, zero dependencies, no DOM/Node APIs
client/   Preact UI — imports the engine, runs it locally for solo mode
server/   Node + ws — imports the SAME engine to validate every PvP move
```

- `shared/src/core.ts` is the only implementation of combat math: damage
  modifiers (Strength / Weak / Vulnerable), block, thorns, poison ticks, the
  card-effect interpreter, draw/discard/exhaust piles.
- PvE (`combat.ts`) and PvP (`pvp.ts`) are thin reducers over those primitives:
  `(state, action) → { state, events }`. States are plain JSON; the RNG is a
  seeded `mulberry32` stored *inside* the state, so any sequence of actions
  replays identically anywhere — that's what makes server-side validation
  trivial and lets the client persist mid-combat saves.
- The server never trusts a client: it runs `pvpReduce` on every message,
  rejects illegal actions (`not your turn`, `not enough energy`, …), and sends
  back **redacted views** (`viewFor`) — your opponent's hand and draw order
  never leave the server.
- Card rules text is *generated from the effect data* (`describeCard`), so a
  card can never say one thing and do another.

## Game content

- **41 playable cards** (30+ obtainable): attacks / skills / powers, costs 0–3,
  every card has a distinct upgrade (`Strike.sh+`). Junk **Glitch** cards can
  infect your deck — bosses literally shove them into your discard pile.
- **16 relics** with combat/economy hooks (free first card, energy on shuffle,
  thorns auras, boss relics like +1 energy per turn).
- **Statuses**: Strength, Weak, Vulnerable, Corrupt (poison), Thorns, Plating,
  Turret, Viral, Overclock, Uplink, Ritual.
- **3 acts, 16 enemies, 3 bosses** + elites, with a Spire-style branching node
  map: combats, elites, rest sites, shops (buy/remove), treasure vaults, and
  5 narrative events.
- **Smart enemy AI**: enemies pick intents by scoring moves against the actual
  board — they go for lethal when it's on the table, turtle when wounded, apply
  Weak when you stack Strength, punish your Vulnerability, and never repeat
  moves into the ground. See `chooseMove` in `shared/src/enemies.ts`.
- **PvP duels**: mirrored 25-card decks, alternating turns, +1 energy to the
  second player's first turn; powers like Auto-Turret and Viral Load target
  your opponent.

![pvp](docs/pvp.png)

## Tech

Preact + `@preact/signals` (tiny, smooth), Vite, self-hosted Orbitron/Share
Tech Mono (no CDN — offline-first), canvas particle system + CSS scanlines &
glow for the neon look, WebAudio synth SFX (no audio assets), Node `ws` server
run with `tsx` so the TypeScript engine is imported from source everywhere —
no build step, no drift.
