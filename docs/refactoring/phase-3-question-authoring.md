# QuizDog Refactoring Phase 3 Question Authoring

## Scope

This phase focuses on teacher-side question authoring and editing. These flows are high-risk because they create or mutate canonical classroom data.

## Service Changes

- `lib/services/questionSets.ts` now owns question authoring CRUD:
  - question set + question creation as one workflow
  - question draft normalization
  - reusable question validation
  - question set metadata updates
  - question update/delete
  - copying selected questions into another set
  - loading a set with its questions

## Connected UI

- `app/teacher/create/page.tsx`
  - no longer inserts `question_sets` and `questions` directly.
  - uses `createQuestionSetWithQuestions()`.
  - prevents duplicate save submissions with `isSaving`.

- `app/teacher/sets/[id]/edit/page.tsx`
  - no longer performs direct Supabase CRUD for question edits.
  - uses the shared validation and CRUD service.

- `components/MergeQuestionsModal.tsx`
  - no longer queries Supabase directly.
  - loads other sets and selected-set questions through services.

- `components/teacher/QuestionReviewEditor.tsx`
  - supports disabled/save-in-progress state.

## Integrity Improvement

`createQuestionSetWithQuestions()` rolls back the newly-created `question_sets` row if inserting child `questions` fails. This reduces orphan/empty question sets caused by partial saves.

## Still Remaining

- `alert()` and `confirm()` still exist in teacher flows. They should be replaced with a small toast + confirm dialog layer.
- Reorder is still local only because the schema does not have an explicit `sort_order` column.
- RLS policy review is still needed before public classroom use.
