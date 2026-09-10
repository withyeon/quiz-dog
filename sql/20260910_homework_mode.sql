-- 과제 모드 (2026-09-10)
--
-- 선생님이 실시간으로 방을 열지 않아도 학생이 코드로 들어와 혼자 푸는 방식.
--   rooms.is_homework  — 과제 방 표시. 만들 때부터 status='playing'이고 호스트가 없다.
--   rooms.due_at       — 제출 마감. 지나면 입장이 막히고, 크론이 finished로 정리한다.
--   players.started_at — 학생이 게임 화면에 들어간 시각. 과제는 방이 아니라
--                        학생마다 이 시각부터 duration_seconds를 센다.
--
-- 과제가 아닌 방은 전부 기본값(false / NULL)이라 기존 동작이 바뀌지 않는다.

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS is_homework boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS due_at timestamptz;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

COMMENT ON COLUMN public.rooms.is_homework IS '과제 방 (호스트 없이 학생이 혼자 푸는 방)';
COMMENT ON COLUMN public.rooms.due_at IS '과제 제출 마감 시각. 과제 방에만 값이 있다';
COMMENT ON COLUMN public.players.started_at IS '학생이 게임 화면에 들어간 시각 (과제 모드의 개인 제한 시간 기준)';

-- 마감 지난 과제를 크론이 빠르게 찾도록
CREATE INDEX IF NOT EXISTS rooms_homework_due_idx
  ON public.rooms (due_at)
  WHERE is_homework;
