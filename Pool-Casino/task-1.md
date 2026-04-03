---
title: Player-Owned Casino Hub
---
# Player-Owned Casino Hub System

## What & Why
Build a full player-owned casino hub system where players can spend chips to create their own casino, buy individual games, fund a bankroll, set house rules, and run their casino for other players to visit and gamble in. This creates major money sinks (casino creation at 100M, 1M per game) and ongoing drains (10% monthly tax) to keep the economy balanced.

## Done looks like
- Any logged-in player can create their own casino (costs 100M chips, goes to the main pool)
- Casino owners purchase individual games (1M each) to offer in their casino
- Casino owners fund a bankroll (deposits chips from their balance into the casino's vault)
- Players browse the casino list, click into a casino "hub" with its own tabs: Games, Stats, Logs, Owner Controls
- Inside a casino, players bet against the casino bankroll — wins come from the bankroll, losses go to it
- Casino bankroll auto-restricts bets when funds are low; casino is paused automatically if bankroll reaches zero
- Owner Controls tab lets owners set min/max bet, enable/disable games, deposit/withdraw bankroll, pause casino
- A monthly tax of 10% of the casino bankroll runs automatically and is logged
- Drinks system: casino owners can offer cosmetic drinks (types: cheap/standard/expensive); players can buy them inside a casino; drinks appear on player profiles
- The existing `/casinos` page transforms from a "coming soon" teaser into the live casino browser
- The leaderboard "Top Casinos" tab shows real casino rankings by bankroll/activity

## Out of scope
- PvP-within-casino (players still queue for PvP globally, not inside a casino)
- Custom game logic per casino (odds adjustments stored but only applied as payout multiplier caps — no new RNG engines)
- Casino-specific chat rooms
- Casino-to-casino transfers

## Tasks
1. **Database schema** — Add new tables: `casinos`, `casino_games_owned`, `casino_bets`, `casino_transactions`, `casino_drinks`, `user_drinks`, `monthly_tax_logs`. Run `db:push` to apply. Add a `casino_id` column on `users` (nullable) if the owner wants it surfaced.

2. **Backend: Casino CRUD + economy** — REST endpoints for creating a casino (validates 100M balance, deducts it, sends to pool), purchasing games (1M per game type → pool), depositing/withdrawing bankroll, get-casino-by-id, list-casinos (with active-player count), get-casino-games.

3. **Backend: Casino betting flow** — Modify mini-game routes to accept an optional `casinoId` param. When present, settle bets against the casino bankroll instead of the global pool. Enforce min/max bet and pause state. Record each bet in `casino_bets` and update casino bankroll atomically.

4. **Backend: Monthly tax + owner controls** — Owner-only endpoints to update settings (min/max bet, pause, enable/disable games). Scheduled job (via `node-cron`) that runs on the 1st of each month: deducts 10% from each active casino bankroll, sends it to the main pool, logs in `monthly_tax_logs`.

5. **Backend: Drinks system** — Endpoints for casino owners to configure available drinks (name, price, emoji), and for players to purchase drinks (deducts from player balance, credits to casino bankroll, records in `user_drinks`).

6. **Frontend: Casino browser (`/casinos`)** — Replace the placeholder page with a live casino grid showing name, owner, bankroll strength, game count, and active players. Include a "Create My Casino" button (shows cost, confirms purchase).

7. **Frontend: Casino hub page (`/casino/:id`)** — Full hub view with four tabs. Games tab: shows owned and enabled games with "Play" button that routes to the existing game page with `?casinoId=X` in the URL. Stats tab: bankroll over time, bet volume, win rate. Logs tab: recent bets feed. Owner Controls tab: settings form, bankroll deposit/withdraw, game enable/disable, drinks configuration.

8. **Frontend: Casino-aware game pages + drinks** — Pass `casinoId` from URL to game API calls when present. Add a drinks panel inside casino hub for purchasing; display purchased drinks on player profile page.

## Relevant files
- `lib/db/src/schema/`
- `lib/db/src/schema/users.ts`
- `lib/db/src/schema/pool.ts`
- `lib/db/src/schema/bets.ts`
- `artifacts/api-server/src/routes/mini-games.ts`
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/app.ts`
- `artifacts/pool-casino/src/pages/casinos.tsx`
- `artifacts/pool-casino/src/pages/leaderboard.tsx`
- `artifacts/pool-casino/src/App.tsx`
- `lib/db/src/index.ts`