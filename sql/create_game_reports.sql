-- game_reports 테이블: 게임 종료 시 성적과 채점표를 영구 보관하는 아카이브
create table if not exists public.game_reports (
  id uuid default gen_random_uuid() primary key,
  room_code text not null,       -- 보관 당시의 방 코드
  set_id text,                   -- 사용된 문제집 ID
  game_mode text,                -- 플레이한 게임 모드 (예: factory, racing 등)
  player_count integer not null default 0, -- 총 참가자 수
  players_data jsonb not null default '[]'::jsonb, -- 학생별 성적과 풀이 기록 전체 스냅샷
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS (Row Level Security) 설정
alter table public.game_reports enable row level security;

-- 누구나 리포트를 추가하고 조회할 수 있도록 허용 (선생님/학생 인증 모델에 따라 추후 고도화 가능)
create policy "Anyone can insert game reports"
  on public.game_reports for insert
  with check (true);

create policy "Anyone can view game reports"
  on public.game_reports for select
  using (true);
