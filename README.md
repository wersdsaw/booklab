# Corporate Bunker

A Ukrainian-language, real-time corporate survival game for a variable-size team and one host, built with Next.js, React, Tailwind, Framer Motion, Socket.io and normalized SQLite storage.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3000 for players and http://localhost:3000/admin for the host. The development-only password is `bunker-local`; set `ADMIN_PASSWORD` to override it. Create a room and share its code. Heads are capped at 2 and Team Leads at 4 (one per department). Managers have no total or per-department cap. Start with any nonempty roster. Every participant uses a separate browser/tab. Sessions use tab-scoped storage and survive refresh and temporary disconnections.

```sh
npm test
npm run typecheck
npm run build
ADMIN_PASSWORD='your-long-unique-password' npm start
```

`.env` files are not loaded by the custom server. Export environment variables in your shell, use your hosting environment, or use Docker Compose. Next.js can still read its own `.env.local` values; do not place the host password in a `NEXT_PUBLIC_*` variable.

## Deploy

Run **one persistent Node.js instance** behind HTTPS with WebSocket upgrades enabled and persistent disk mounted at `DATABASE_PATH`. Docker Compose is included:

```sh
export ADMIN_PASSWORD='your-long-unique-password'
export APP_ORIGIN='https://your-bunker.example.com'
docker compose up --build -d
```

Terminate TLS in your reverse proxy. Health check: `/healthz`. The server defaults to port 3000 and `0.0.0.0`. Production refuses to start without a host password of at least 12 characters. `APP_ORIGIN` restricts browser connections to your deployment's origin.

This custom Socket.io server requires a long-running process; deploy to a container host with persistent volumes (for example a VPS). It cannot run unchanged as Vercel serverless functions or a static Sites deployment. Multiple instances require a shared transactional store, per-room serialization, and a Socket.io adapter; do not scale replicas with the bundled SQLite implementation. Back up the SQLite database using SQLite's online backup API or while the service is stopped, including WAL files where applicable. Keep the volume private: it contains game secrets and session hashes.

## Game protocol

1. Only a server-authenticated host creates rooms. Capacity and department assignments are checked atomically on join. Starting requires at least one participant, with no fixed roster size.
2. Up to five distinct flaws are assigned: up to 1 Head, 2 Team Leads and 2 Managers, depending on the available players. All players acknowledge their private profiles before the first crisis.
3. Each crisis has a cinematic reading gate persisted on the server. Heads, Team Leads and Managers act in sequence; every living member of a tier must vote before advancing. Consensus is calculated per department below the Heads. A plurality wins; equal counts are resolved by a server-side cryptographic draw. Opposing Head decisions split the four departments randomly 2/2. Departures through firing leave the department's next remaining tier able to act.
4. Toxic decisions are authored for each role × flaw pair (45 different actions), without repeated scenario metadata. Light remains visible with an “Option Exhausted” badge after its single use; the server rejects attempts to reuse it. Each role/flaw/severity pair has an independently written, natural two-sentence private alibi; it contains no scenario titles, formulas or point values. Clean players retain constructive options and custom proposals.
5. The tribune retains its seven-minute wall-clock deadline and ordered speaker queue. Only the active speaker can pass; the host can skip. All living players must agree to start voting. One “No” adds exactly 60 seconds and advances the readiness epoch.
6. The secret ballot has a separate seven-minute deadline. It closes when all eligible ballots arrive or the deadline expires. **Open Discussion** then starts automatically for exactly two minutes. Everyone may speak; ballots cannot change, and elimination remains unrevealed until discussion ends. The host can pause/resume, add 30 seconds or one minute, and explicitly end any timed stage. Missing ballots count as abstentions at the deadline. Ties, or a completely empty effective ballot, use a cryptographic draw among nonimmune living participants.
7. Flawed players see a locked gray protocol before crisis three. At crisis three they see a one-second glitch and full-screen unlock notice; acknowledgment is persisted before their description appears. Each flaw has one distinct, one-use protocol:
   - Fear of Conflict → **Team Shield**: remove one vote against the caster in the current round.
   - Absence of Trust → **Shadow Cardinal**: private live view of submitted ballots and current target selections. Selections are tentative, not predictions, and can change.
   - Avoidance of Accountability → **Corporate Blackmail**: anonymously suppress one other living player's vote for the round, revoking an already submitted ballot too.
   - Inattention to Results → **Golden Parachute**: complete immunity for the current purge, at a 15-point company budget cost.
   - Low Standards → **Talent Pool**: grant one selected ghost one ballot this round, without reviving them. A ghost cannot be a purge target.
   Protocols activate during cascade, tribune or secret voting; once Open Discussion begins, ballots and protocol effects are frozen. Effects expire next round; consumed protocols do not refresh.
8. Budget starts at 100%. A crisis costs 6 points; the mean action contribution of each hierarchy tier is then applied once: constructive +1, Light +0.5, Medium −2, Hard −3. Thus arbitrary manager counts cannot multiply losses. Five worst-case three-tier crises cost at most 75 points; the sole Golden Parachute costs another 15, leaving 10%. During the tribune, up to three clean players (or all clean survivors if fewer) can support a recovery plan for +4 once per round. Budget is capped at 100 and does not end the game prematurely. Victory requires at least 10% budget and no surviving flaws. At low budget the finale celebrates preserving the company through a professional team; any surviving flaw causes defeat.
9. Ghosts remain grayscale spectators with private messages to the host, except for a ballot granted by Talent Pool. After five purges, or sooner if only one survivor remains, the host advances to the finale. A surviving flawed player wins personally. Administrative kicks revoke credentials and are additional to scheduled firings.

The host can inspect the live hierarchy, constructive/toxic links, private profiles, ballots and ghost messages. Click a node to inspect or kick. A lost player connection stays expected in the consensus/readiness/vote count; reconnect or have the host kick the missing participant. Kicking in the lobby frees the seat. Closing a browser tab does not abandon its durable credential.

## Architecture and security

- `server/game.js`: transport-independent state machine, consensus engine, action validation and per-actor projections.
- `server/schema.sql` and `server/store.js`: normalized room, player, secret, session, consensus, decision, directive, speaker, readiness, ballot and audit entities. Mutations commit atomically in SQLite WAL mode. Additive schema migrations preserve existing rooms and credentials. Room state and secrets survive server restarts; timers derive from saved wall-clock deadlines.
- `server.js`: same-origin Socket.io transport, payload limits, command rate limits, credential lifecycle and private broadcasts. Host passwords never enter client bundles. Random 256-bit session credentials are stored as SHA-256 hashes in the database and expire after seven days. The room code alone cannot grant host access or impersonate an existing participant.
- `lib/useRoom.ts`: one listener lifecycle and unlimited reconnect retries. Each connection restores identity with its credential and receives an authoritative personalized snapshot. A second connection with the same credential replaces the first. Commands are disabled offline and are not replayed by the UI.
- `components/`: cinematic intro, profile focus mode, crisis gate/actions, tribune, purge, ghosts, endgame and host hierarchy.

Players receive their own secrets only. Private audit entries, ghost messages, other players' ballots, vote intentions and toxicity flags are omitted (except ballots/intentions for an active wiretap owner) from their snapshots. Decisions and verbal alibis can still reveal behavior intentionally. The host sees all secrets; do not share the host terminal during play.

The database retains the current round and up to 300 audit entries, rather than an unlimited game history. Host credential recovery works in the original tab; losing its session storage requires restoring that credential from a secure backup or creating a new room. There is no email/password account recovery flow.

## Validation

`npm test` exercises role capacity, restricted actions, exact flaw assignment, profile privacy, burnout, alibis, corporate splits, ghost secrecy, readiness epochs, SQLite restoration, and all five rounds with both win conditions. `npm run typecheck` and `npm run build` validate the UI. `tests/socket.integration.js` exercises real clients against a running server; run it with `BUNKER_URL` and `BUNKER_ADMIN_PASSWORD` matching your environment.

Run `node tests/restart.integration.js` after a production build to launch an isolated server twice and verify actual disk/session recovery. It uses temporary SQLite storage and port 3101 (override with `RESTART_TEST_PORT`).

The update adds persisted budget, protocol acknowledgment/effects, vote intentions and recovery-plan support. Existing rooms upgrade on server restart. Start a new simulation to experience the complete budget and unlock progression from the beginning.

## Interface

The cyberpunk skin uses rich dark glass, white/blue informational accents, amber Medium choices and red Hard/critical states. Exhausted Light remains a faded card with a compact badge and no strikethrough. Timers and confirmation controls remain in their own content blocks; there is no fixed bottom overlay or portal relocation. Crisis selections still require confirmation, and private alibis retain their concise two-sentence wording.

Lore is drawn randomly without repeats within a room across all roles. Used stories remain reserved after departures, resets and server restarts. Once the authored role catalog is exhausted, additional personal financial goals create unique variants without limiting roster size.
