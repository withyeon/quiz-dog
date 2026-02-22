-- 편의점(팩토리) 등 시간 제한 게임: 선생님이 게임 시작 시 설정한 시간(초), 시작 시각
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

COMMENT ON COLUMN rooms.duration_seconds IS '게임 제한 시간(초). 편의점 등에서 사용.';
COMMENT ON COLUMN rooms.started_at IS '게임이 playing으로 바뀐 시각.';
