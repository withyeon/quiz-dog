-- 같은 방의 닉네임 생성 경쟁 조건 방지.
-- 기존 데이터에 중복이 있더라도 삭제/변경하지 않고, 이후 INSERT부터 원자적으로 차단한다.
CREATE OR REPLACE FUNCTION public.prevent_duplicate_room_nickname()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  normalized_nickname text := lower(btrim(NEW.nickname));
BEGIN
  -- 동일 room+nickname INSERT는 트랜잭션 단위로 직렬화한다.
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
