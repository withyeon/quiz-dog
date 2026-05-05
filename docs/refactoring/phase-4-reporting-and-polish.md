# Phase 4: Reporting and Polish

## Summary

This phase finished the remaining high-impact refactors that were still mixing UI, game logic, and direct Supabase access.

## What changed

### Reporting and analytics service boundaries

- Expanded `lib/services/reports.ts`
  - `listRecentGameReports()`
  - `getGameReportById()`
  - `parseReportPlayers()`
  - `getFinishedRoomReport()`
- Expanded `lib/services/questions.ts`
  - `listQuestionsForAnalytics()`
- Expanded `lib/services/players.ts`
  - `listPlayersInRoom()`

### Teacher screens now use services

- `app/teacher/analytics/page.tsx`
  - no longer queries `game_reports` directly
  - supports loading a selected report through the service layer
  - shows service-level error messages instead of silently failing
- `app/teacher/report/[roomCode]/page.tsx`
  - no longer queries `rooms` and `players` directly
- `components/TeacherAnalytics.tsx`
  - no longer queries `questions` directly
  - uses analytics question loading service
  - surfaces export/load failures in component state

### Remaining game-mode direct writes removed

- `app/game/page.tsx`
  - Gold Quest reward flow no longer passes a raw Supabase client into game logic
  - target-player selection now refreshes player data before applying steal/swap events
- `lib/game/goldQuest.ts`
  - reward application now uses `updatePlayer()` and `Promise.all()` instead of raw table updates
- `app/battle/page.tsx`
  - battle-royale class selection, zone damage, healing, attacks, and item healing now use player services
- `app/dontlookdown/page.tsx`
  - score/energy sync now uses player services
  - room finish uses `finishRoom()`
  - added a guard to prevent duplicate room-finish writes
- `components/FactoryView.tsx`
  - factory money/factory upgrades now use player services

### Frontend cleanup

- replaced the remaining linted `<img>` usage in actively rendered game UI with `next/image`
- fixed hook dependency warnings and ref-cleanup warnings
- tower restart now resets local game state instead of relying on a browser refresh

## Outcome

- direct Supabase access is now concentrated in service and realtime layers
- teacher analytics/reporting uses the same data boundary style as room/question-set flows
- game logic modules are less coupled to the database client
- ESLint is now clean across the repository

## Verification

- `./node_modules/.bin/tsc --noEmit`
- `./node_modules/.bin/eslint . --ext .ts,.tsx`
- `npm run build`
