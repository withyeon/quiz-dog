-- 20260722_atomic_lobby_join.sql 초기 버전의 chr(0) 잠금 키를 교정한다.
-- PostgreSQL text에는 null 문자를 넣을 수 없으므로 안전한 길이 기반 문자열 키를 사용한다.
CREATE OR REPLACE FUNCTION public.prevent_duplicate_room_nickname()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  normalized_nickname text := lower(btrim(NEW.nickname));
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      NEW.room_code || ':' || length(normalized_nickname)::text || ':' || normalized_nickname,
      0
    )
  );

  IF EXISTS (
    SELECT 1
    FROM public.players
    WHERE room_code = NEW.room_code
      AND lower(btrim(nickname)) = normalized_nickname
  ) THEN
    RAISE EXCEPTION 'nickname already exists in room'
      USING ERRCODE = '23505',
            CONSTRAINT = 'players_room_nickname_unique';
  END IF;

  NEW.nickname := btrim(NEW.nickname);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_room_nickname ON public.players;
CREATE TRIGGER prevent_duplicate_room_nickname
BEFORE INSERT ON public.players
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_room_nickname();
