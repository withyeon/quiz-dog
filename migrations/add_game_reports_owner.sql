-- 게임 기록에 소유자(선생님) 컬럼 추가
--
-- 왜 필요한가:
--   game_reports 에는 누가 진행한 게임인지 남는 값이 없어서, 선생님이 '게임 기록'을 열면
--   다른 선생님의 기록(학생 닉네임·답안 포함)까지 조회될 수 있었다.
--   임시로 '내가 소유한 문제집(question_sets.owner_id)의 기록'만 걸러서 보여주고 있지만,
--   자료실 문제집으로 바로 진행한 게임은 내 기록에서 빠지는 한계가 있다.
--   이 컬럼이 생기면 진행한 사람 기준으로 정확히 나눌 수 있다.
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 아래 전체 붙여넣기 → Run
-- 안전성: 기존 데이터를 지우지 않는다. 여러 번 실행해도 결과가 같다.

-- 1) 컬럼 추가
alter table public.game_reports
  add column if not exists owner_id uuid;

-- 2) 조회 속도용 인덱스
create index if not exists game_reports_owner_id_idx
  on public.game_reports (owner_id);

-- 3) 기존 기록은 문제집 소유자로 채운다 (알 수 있는 것만)
update public.game_reports as r
set owner_id = s.owner_id
from public.question_sets as s
where r.set_id = s.id
  and r.owner_id is null
  and s.owner_id is not null;

-- 확인용: 채워진 기록 수 / 전체 기록 수
-- select count(*) filter (where owner_id is not null) as owned, count(*) as total from public.game_reports;
