-- question_sets 테이블에 메타데이터 컬럼 추가

ALTER TABLE question_sets 
ADD COLUMN IF NOT EXISTS subject text,
ADD COLUMN IF NOT EXISTS grade text,
ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;

-- 기존 데이터에 대한 기본값 갱신 방지 (null 유지)
-- 필요한 경우 기존 데이터를 일괄 업데이트할 수 있습니다.
-- UPDATE question_sets SET subject = '기타', grade = '전체' WHERE subject IS NULL;
