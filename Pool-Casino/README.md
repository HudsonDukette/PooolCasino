# PoolCasino

A full-stack browser casino where every bet affects a shared global pool. Built with React + Vite (frontend), Express (API), and PostgreSQL (Drizzle ORM).

---

## Games — 34 Total

### Solo Games (20)
Classic house-vs-player games that use the global shared pool:

| Game | Description |
|------|-------------|
| Neon Roulette | Classic red/black with dynamic odds based on the global pool |
| Drop Plinko | Physics ball through pegs — pick your risk level |
| Blackjack | Hit or stand vs. the dealer. Blackjack pays 2.5× |
| Crash | Watch the multiplier climb and cash out before it crashes |
| Neon Slots | Match 3 reels — sevens pay 20×, diamonds 10× |
| Dice Roll | Guess exact (5×) or high/low (1.9×) |
| Coin Flip | Pick heads or tails — 1.95× |
| Fortune Wheel | Spin for multipliers from 0.2× to 10× |
| Number Guess | Guess a number 1–10 — correct pays 8× |
| Mines | Pick tiles on a grid while dodging hidden mines |
| High-Low | Guess the second card — consecutive streaks add up |
| Double Dice | Bet on sum ranges of two dice |
| Risk Ladder | Climb rungs for bigger payouts — one mistake loses it all |
| War | Draw a card — beat the dealer to win |
| Ice Break | Click the cracking ice before it breaks |
| Advanced Wheel | More segments, more strategy |
| Target Multiplier | Land on the exact target segment for max payout |
| Range Bet | Bet on a number range across a rolling die |
| Pyramid | Choose your row — top row pays the most |
| Lightning Round | Speed-round multiplier surprises |

### New Solo Games (14)
Extra fast-paced solo games with AI-generated banner art:

| Game | Description |
|------|-------------|
| Blind Draw | Draw a mystery face-down card — pure fate |
| Hidden Path | Navigate 3 hidden forks — all safe = 8× |
| Jackpot Hunt | Open 1 of 5 boxes — one holds a 10× jackpot |
| Target Hit | Click the moving target for up to 5× payout |
| Chain Reaction | Win streaks chain multipliers — cash out before you bust |
| Timed Safe | Safe opens over 10 seconds — cash out early or wait |
| Reverse Crash | Multiplier falls from 10× — cash out before it collapses |
| Countdown Gamble | Multiplier grows as timer ticks — cash out before zero |
| Card Stack | Draw cards without going over 21 — push your luck |
| Power Grid | Pick tiles on a 4×4 grid — hit a trap and lose all |
| Elimination Wheel | Each spin removes the worst segment — last one wins big |
| Combo Builder | Win streaks stack your combo — one loss resets to zero |
| Safe Steps | Step forward for higher rewards — each step raises fail risk |
| Prediction Chain | Predict 3 coin flips in a row — all correct = 6.5× |

### PvP Multiplayer Games (21)
Real-time head-to-head via WebSocket. Winner takes the pot — no house edge:

**Original 15:** War, High-Low, Coin Flip, RPS, Dice Battle, Blackjack PvP, Poker, Memory, Speed Click, Number Guess, Reaction, Tug of War, Quick Math, Card Race, Last Man

**New 6:** Split or Steal, Risk Dice, Duel Flip, Risk Auction, Quick Draw, Balance Battle

---

## Player-Owned Casinos

Users can create their own casinos and invite other players to gamble in them. Casino owners get:
- Full control over games offered (purchase from a library of 32 solo games)
- Custom payout multipliers per game (0.5× to 2.0×)
- Enable/disable games per casino
- Custom name, description, emoji, and drag-and-drop banner image
- Bar menu — sell virtual drinks for chips
- Bankroll management — deposit and withdraw from your casino pool
- Pause/resume your casino at any time
- Real-time stats: profit, house edge, bankroll trend chart, transaction history
- Monthly tax to keep the economy balanced

---

## Project Structure

```
/
├── artifacts/
│   ├── pool-casino/        # React + Vite frontend
│   └── api-server/         # Express API server
├── lib/
│   ├── db/                 # Drizzle ORM schema + client (@workspace/db)
│   ├── api-zod/            # Shared Zod types + validators (@workspace/api-zod)
│   ├── api-client-react/   # Generated API client for the frontend (@workspace/api-client-react)
│   └── api-spec/           # OpenAPI spec + Orval codegen config
└── pnpm-workspace.yaml
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 9+ | `npm i -g pnpm` |
| Supabase CLI | latest | `npm i -g supabase` |

> **GitHub Codespaces**: All of the above can be installed automatically using the dev container. Open the repo in a Codespace and the postCreateCommand handles it.

---

## 1. Supabase — Database Setup

### 1a. Create a Supabase project

1. Go to https://supabase.com and create a new project.
2. Choose a region close to where you will host the API server.
3. Once the project is ready, go to **Settings → Database** and copy the **Connection string (URI)** — it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
4. Append `?sslmode=require` to the end so the final URL looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
   ```
   Keep this — it is your `DATABASE_URL`.

### 1b. Run the database schema

Go to **Supabase Dashboard → SQL Editor** and run the following SQL in order.

**Step 1 — Application tables:**

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email TEXT,
  balance NUMERIC(25, 2) NOT NULL DEFAULT 10000.00,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  referral_code TEXT UNIQUE,
  referred_by INTEGER,
  avatar_url TEXT,
  total_profit NUMERIC(25, 2) NOT NULL DEFAULT 0.00,
  biggest_win NUMERIC(25, 2) NOT NULL DEFAULT 0.00,
  biggest_bet NUMERIC(25, 2) NOT NULL DEFAULT 0.00,
  games_played TEXT NOT NULL DEFAULT '0',
  win_streak TEXT NOT NULL DEFAULT '0',
  current_streak TEXT NOT NULL DEFAULT '0',
  total_wins TEXT NOT NULL DEFAULT '0',
  total_losses TEXT NOT NULL DEFAULT '0',
  last_daily_claim TIMESTAMPTZ,
  last_bet_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  crazy_games_user_id TEXT UNIQUE,
  is_crazy_games_linked BOOLEAN NOT NULL DEFAULT false,
  device_id TEXT UNIQUE,
  is_guest BOOLEAN NOT NULL DEFAULT false,
  suspended_until TIMESTAMPTZ,
  banned_until TIMESTAMPTZ,
  permanently_banned BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS pool (
  id SERIAL PRIMARY KEY,
  total_amount NUMERIC(15, 2) NOT NULL DEFAULT 1000000.00,
  biggest_win NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  biggest_bet NUMERIC(15, 2) NOT NULL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS bets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  game_type TEXT NOT NULL,
  bet_amount NUMERIC(15, 2) NOT NULL,
  result TEXT NOT NULL,
  payout NUMERIC(15, 2) NOT NULL,
  multiplier NUMERIC(10, 4),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS friends (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'public',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_admin_broadcast BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS chat_room_members (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS money_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 10000.00,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reported_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ban_appeals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by INTEGER
);
```

**Step 2 — Session table (required for login to work):**

```sql
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
```

**Step 3 — Seed the house pool:**

```sql
INSERT INTO pool (total_amount, biggest_win, biggest_bet)
VALUES (1000000.00, 0.00, 0.00)
ON CONFLICT DO NOTHING;
```

---

## 2. Environment Variables

### API Server (`artifacts/api-server`)

Create `artifacts/api-server/.env`:

```env
# PostgreSQL — from Supabase Settings → Database → Connection string
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require

# Random string — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=replace_with_a_long_random_string

# Push notifications (optional — generate with: npx web-push generate-vapid-keys)
VAPID_EMAIL=mailto:you@example.com
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# Server port
PORT=3001
```

### Frontend (`artifacts/pool-casino`)

Create `artifacts/pool-casino/.env`:

```env
# URL of your running API server (no trailing slash)
VITE_API_BASE_URL=http://localhost:3001

# Required by vite.config.ts
PORT=5173
BASE_PATH=/
```

> In production, set `VITE_API_BASE_URL` to your deployed API server URL (e.g. `https://your-api.up.railway.app`).

---

## 3. Local Development (Codespaces / any machine)

```bash
# 1. Install all dependencies from the repo root
pnpm install

# 2. Start the API server (runs on PORT 3001)
cd artifacts/api-server
pnpm dev

# 3. In a second terminal, start the frontend (runs on PORT 5173)
cd artifacts/pool-casino
pnpm dev
```

Open http://localhost:5173 in your browser.

> **Codespaces port forwarding**: Codespaces will automatically forward ports 3001 and 5173. Make sure both ports are set to **Public** visibility in the Ports panel, then update `VITE_API_BASE_URL` in the frontend `.env` to the forwarded HTTPS URL for port 3001.

---

## 4. Deploy the API Server

The API server is a long-running Express app with PostgreSQL session storage. It cannot run as Vercel serverless functions. Use one of the following platforms:

### Option A — Railway (recommended)

1. Push your code to a GitHub repository.
2. Go to https://railway.app → New Project → Deploy from GitHub repo.
3. Select the repo and set the **root directory** to `artifacts/api-server`.
4. Add the environment variables from section 2 above (use your Supabase `DATABASE_URL`).
5. Railway will detect the `build` and `start` scripts automatically.
6. Copy the generated Railway URL (e.g. `https://your-api.up.railway.app`).

### Option B — Render

1. New Web Service → connect your GitHub repo.
2. Root directory: `artifacts/api-server`
3. Build command: `pnpm install && pnpm build`
4. Start command: `pnpm start`
5. Add the environment variables.

### Option C — Fly.io

```bash
cd artifacts/api-server
fly launch
fly secrets set DATABASE_URL="..." SESSION_SECRET="..."
fly deploy
```

---

## 5. Deploy the Frontend to Vercel

The React + Vite frontend is a static site and deploys to Vercel with no extra configuration.

### Via Vercel CLI

```bash
# From the repo root
pnpm install

# Build the frontend
cd artifacts/pool-casino
pnpm build
# Output is in artifacts/pool-casino/dist/public

# Deploy with Vercel CLI
npx vercel --cwd artifacts/pool-casino
```

### Via Vercel Dashboard

1. Go to https://vercel.com → Add New Project → Import your GitHub repo.
2. Set **Root Directory** to `artifacts/pool-casino`.
3. Framework preset: **Vite**.
4. Build command: `pnpm build`
5. Output directory: `dist/public`
6. Add these environment variables in the Vercel project settings:

   | Variable | Value |
   |----------|-------|
   | `VITE_API_BASE_URL` | Your Railway/Render API URL |
   | `PORT` | `3000` |
   | `BASE_PATH` | `/` |

7. Deploy.

---

## 6. Connecting Frontend to API

The frontend reads `VITE_API_BASE_URL` at build time to know where to send API requests. Make sure this is set to your deployed API server URL before building for production.

If you need the frontend API client to pick up the base URL at runtime, it is configured in `lib/api-client-react/src/custom-fetch.ts` via `setBaseUrl()`.

---

## 7. Generating VAPID Keys (Push Notifications)

Push notifications are optional. To enable them:

```bash
npx web-push generate-vapid-keys
```

Copy the output into your API server environment variables (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`). The frontend does not need these keys.

---

## 8. Admin Access

To make a user an admin, run the following SQL in Supabase SQL Editor after creating an account:

```sql
UPDATE users SET is_admin = true WHERE username = 'your_username';
```

---

## 9. Schema Changes

If you modify the Drizzle schema in `lib/db/src/schema/`, push the changes to Supabase:

```bash
# From repo root
DATABASE_URL="your_supabase_url" pnpm --filter @workspace/db run push
```

---

## Summary Checklist

- [ ] Supabase project created and `DATABASE_URL` copied
- [ ] All SQL from section 1b executed in Supabase SQL Editor
- [ ] `artifacts/api-server/.env` created with correct values
- [ ] `artifacts/pool-casino/.env` created with correct values
- [ ] API server deployed (Railway / Render / Fly.io)
- [ ] Frontend deployed to Vercel with `VITE_API_BASE_URL` pointing to the API
- [ ] App loads and the pool balance shows `$1,000,000.00`
