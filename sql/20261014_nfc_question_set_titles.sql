-- 문제집 이름(question_sets.title)을 NFC 로 맞추는 1회용 정리.
--
-- macOS 에서 올린 파일 이름은 NFD(한글 자모 분리)다. 선생님 만들기 화면이 파일 이름으로 문제집 이름을 채워 주면서
-- NFD 그대로 저장된 제목이 있다(예: set-1791955000797-14ncg6c). 화면에는 똑같이 보이지만
-- NFC 로 친 검색어(/dev·선생님 화면 검색의 includes, SQL ilike)에 안 걸린다.
-- 앱은 이제 저장할 때 NFC 로 맞추므로(app/teacher/create/page.tsx, lib/services/questionSets.ts) 이미 저장된 제목만 고친다.
--
-- 바뀌는 것: NFC 가 아닌 제목만, 같은 글자의 NFC 표현으로. 보이는 이름·다른 행·다른 칼럼은 그대로다.
-- 여러 번 실행해도 안전하다(두 번째부터는 0행). Supabase SQL Editor 에서 실행한다.

-- 실행 전 확인용: 바뀔 문제집 목록
-- SELECT id, title FROM public.question_sets WHERE title <> normalize(title, NFC);

UPDATE public.question_sets
SET title = normalize(title, NFC)
WHERE title <> normalize(title, NFC);
