# Objective
Fix insolvency false positive, make all game multipliers editable, add drink stock/storage system, add casino sell button.

# Tasks

### T001: Fix insolvency condition
- **Blocked By**: []
- **Details**:
  - Change `uncappedPayout > bankroll` to `uncappedPayout > bankroll + betAmount` (total casino funds)
  - Update payout cap and debt amount calculation to use totalCasinoFunds
  - Fix resolve-insolvency "pay" action to also set isPaused = false
- **Files**: `artifacts/api-server/src/routes/mini-games.ts`, `artifacts/api-server/src/routes/casinos.ts`

### T002: Casino sell (non-insolvent, 10% return)
- **Blocked By**: []
- **Details**:
  - Add POST /casinos/:id/sell endpoint that: validates owner, deletes casino, returns 10% of purchasePrice to owner
  - Add "Sell Casino" button in owner Controls tab in casino-hub.tsx
- **Files**: `artifacts/api-server/src/routes/casinos.ts`, `artifacts/pool-casino/src/pages/casino-hub.tsx`

### T003: Schema — drink stock + storage levels
- **Blocked By**: []
- **Details**:
  - Add `stock integer default 0` to `casino_drinks` table
  - Add `cheapStorageLevel`, `standardStorageLevel`, `expensiveStorageLevel` integers to `casinos` table
  - Run db:push to apply
- **Files**: `lib/db/src/schema/casinos.ts`, run `pnpm run db:push`

### T004: Backend drink stock routes
- **Blocked By**: [T003]
- **Details**:
  - POST /casinos/:id/drinks/:drinkId/restock — buy N units at 25% of price each, capped to storage capacity
  - POST /casinos/:id/upgrade-storage — upgrade cheap/standard/expensive storage at 1M per level
  - Update drink purchase route to decrease stock by 1 and mark isAvailable=false when stock hits 0
  - Remove old isAvailable toggle/restock logic
- **Files**: `artifacts/api-server/src/routes/casinos.ts`

### T005: Frontend drink stock UI
- **Blocked By**: [T004]
- **Details**:
  - Add `stock` to Drink interface in casino-hub.tsx
  - Replace Restock toggle button with explicit "Buy Stock" UI (input for qty, cost display)
  - Add storage upgrade panel in owner Controls tab
  - Show stock count on each drink
- **Files**: `artifacts/pool-casino/src/pages/casino-hub.tsx`

### T006: Improve per-game pay table editor
- **Blocked By**: []
- **Details**:
  - Change +/- step to use 0.1 for decimal values (< 10) and 1 for integers
  - Make input fields wider, use step=0.1
  - Add a note under each entry showing the default value
- **Files**: `artifacts/pool-casino/src/components/casino-game-editor.tsx`
