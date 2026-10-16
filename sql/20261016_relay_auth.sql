-- ============================================
-- QuizDog 중계 서버 인증: 방 주인과 학생 비밀 토큰 (2026-10-16)
-- ============================================
-- 실시간 중계 서버(relay/socket-server.mjs)는 이벤트를 보낸 사람을 확인한다.
--   - 교사: Supabase 세션 토큰의 사용자가 rooms.owner_id 와 같아야 한다.
--   - 학생: 이벤트에 붙은 비밀 토큰의 SHA-256 이 players.secret_hash 와 같아야 한다.
--
-- 앱은 비로그인(anon) 키로도 players·rooms 를 고칠 수 있다. 그래서 컬럼만 추가하면 남의 해시나 방 주인을
-- 덮어써 행세할 수 있다. 아래 트리거로 막는다.
--   rooms.owner_id      넣을 때 DB가 auth.uid() 로 채운다(클라이언트가 보낸 값은 무시). 그 뒤로 바꿀 수 없다.
--   players.secret_hash 한 번 정해지면 바꿀 수 없다. 과제 방(is_homework)의 '이어하기'만 다시 정할 수 있다
--                       (과제는 닉네임이 곧 신원이라, 다른 기기에서 이어 풀 때 새 토큰이 필요하다).
-- 해시는 256비트 난수의 SHA-256 이라 목록 조회로 보여도 원문 토큰을 알아낼 수 없다.
--
-- 적용 전에는 중계 서버가 지금처럼(로그인 사용자 / 그 방 학생 playerId) 확인한다. 여러 번 실행해도 안전하다.
-- 이 파일 적용 전에 만들어진 방(owner_id 없음)과 학생(secret_hash 없음)은 중계 서버의 호환 규칙으로 통과한다.

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS secret_hash TEXT;

CREATE INDEX IF NOT EXISTS rooms_owner_id_idx ON public.rooms (owner_id);

-- 방 주인: 넣을 때 auth.uid(), 그 뒤로 고정
CREATE OR REPLACE FUNCTION public.rooms_lock_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.owner_id := auth.uid();
  ELSE
    NEW.owner_id := OLD.owner_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rooms_lock_owner ON public.rooms;
CREATE TRIGGER rooms_lock_owner
  BEFORE INSERT OR UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.rooms_lock_owner();

-- 학생 비밀 토큰 해시: 한 번 정해지면 고정 (과제 방 이어하기만 예외)
CREATE OR REPLACE FUNCTION public.players_lock_secret_hash()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_is_homework BOOLEAN;
BEGIN
  IF OLD.secret_hash IS NULL OR NEW.secret_hash IS NOT DISTINCT FROM OLD.secret_hash THEN
    RETURN NEW;
  END IF;
  SELECT r.is_homework INTO v_is_homework FROM public.rooms r WHERE r.room_code = NEW.room_code;
  IF COALESCE(v_is_homework, FALSE) AND NEW.secret_hash IS NOT NULL THEN
    RETURN NEW;
  END IF;
  NEW.secret_hash := OLD.secret_hash;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS players_lock_secret_hash ON public.players;
CREATE TRIGGER players_lock_secret_hash
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.players_lock_secret_hash();
