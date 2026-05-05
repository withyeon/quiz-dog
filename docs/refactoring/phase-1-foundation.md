# QuizDog Refactoring Phase 1 Foundation

## Scope

This phase intentionally avoids rewriting every game page. It introduces shared boundaries for the highest-risk duplication:

- Game mode identity, labels, routes, and initial player state now live in `lib/game/modes.ts`.
- Room lifecycle writes now live in `lib/services/rooms.ts`.
- Question set copy/delete/list flows now live in `lib/services/questionSets.ts`.
- Game report snapshot writes now live in `lib/services/reports.ts`.
- Teacher dashboard, student entry, library copy, dev launcher, analytics labels, and factory redirect now use those shared boundaries.

## Data Workflow

Teacher flow:

1. Teacher selects a question set.
2. Teacher selects a game mode from the registry-backed selector.
3. `createRoom()` creates a waiting room with `set_id` and `game_mode`.
4. `startRoom()` validates room mode behavior, applies mode-specific start state, and marks the room as `playing`.
5. Game pages observe the room via Realtime and route students with `getGameModeUrl()`.
6. `finishRoom()` marks the room finished.
7. `saveGameReportSnapshot()` persists final players data into `game_reports`.

Student flow:

1. Student enters a room code.
2. `getRoomByCode()` verifies the room exists and is not finished.
3. Nickname is filtered and checked with `nicknameExists()`.
4. `createPlayerForRoom()` creates a guest player with mode-specific initial state.
5. When room status changes to `playing`, the lobby uses `getGameModeUrl()` to move the student to the correct game page.

Question set flow:

1. Teacher page lists canonical `question_sets` with per-set question counts.
2. Duplicate creates a new `question_sets` row and copies child `questions`.
3. Delete removes the `question_sets` row, relying on `questions.set_id ON DELETE CASCADE`.
4. Library copy now creates both the copied `question_sets` row and copied `questions`, preventing invisible copied sets.

## Integrity Notes

- `types/database.types.ts` now includes currently used runtime fields such as `player_class`, `caught_dolls`, `claw_points`, `convenience_products`, and `convenience_money`.
- `sql/20260504_game_runtime_integrity.sql` consolidates runtime columns and the full game mode check constraint.
- Existing SQL files are still fragmented. Future cleanup should replace one-off `add_*_fields.sql` scripts with ordered migrations.
- Some pages still write directly to Supabase for in-game state updates. That is acceptable for phase 1, but the next phase should move repeated answer-checking, score updates, and mode-specific player-state updates into focused services or hooks.

## Next Refactor Targets

- Replace `alert`, `confirm`, and `window.location.href` with app-level toast/dialog/navigation helpers.
- Create a `questions` service for loading, shuffling, and checking answers consistently across modes.
- Split large game pages into `useGameSession`, `useQuestionFlow`, and mode-specific state hooks.
- Normalize factory/convenience naming. Current code supports both older `factory_*` fields and newer `convenience_*` fields.
- Add database-generated Supabase types after running migrations, instead of manually maintaining `types/database.types.ts`.
