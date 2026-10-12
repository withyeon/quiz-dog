-- 숨겨진 구성치기(다중 선택) 모드 확인용 샘플: '테스트 구성치기' 문제집 + 문제 2개.
--
-- 먼저 20261012_multi_select_answers.sql 을 실행한 뒤 이 파일을 실행한다.
-- 1) 아래 'YOUR_EMAIL@example.com' 을 선생님 계정 이메일로 바꾸면 그 계정의 "내 문제집"에 들어간다.
--    (바꾸지 않으면 주인 없는 문제집이 되어 목록에 안 보일 수 있다)
-- 2) 여러 번 실행해도 문제집·문제가 두 벌로 늘지 않는다(같은 id 는 건너뛴다).
-- 지울 때:  DELETE FROM public.question_sets WHERE id = 'set-test-gusungchigi';   (문제는 함께 지워진다)

INSERT INTO public.question_sets (id, title, description, owner_id, is_public)
VALUES (
  'set-test-gusungchigi',
  '테스트 구성치기',
  '구성치기(다중 선택) 확인용 샘플',
  (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@example.com' LIMIT 1),
  false
)
ON CONFLICT (id) DO NOTHING;

-- 문제: 마황탕(麻黃湯)의 구성 약재를 모두 고르시오
-- 보기: 마황, 계지, 행인, 감초, 작약, 석고, 생강, 대조, 세신, 반하
-- 정답: 마황, 계지, 행인, 감초
INSERT INTO public.questions (id, set_id, type, question_text, options, answer)
VALUES (
  '6d1f3c2a-0001-4c1e-9a10-000000000001',
  'set-test-gusungchigi',
  'CHOICE',
  '마황탕(麻黃湯)의 구성 약재를 모두 고르시오',
  '["마황", "계지", "행인", "감초", "작약", "석고", "생강", "대조", "세신", "반하"]'::jsonb,
  '마황, 계지, 행인, 감초'
)
ON CONFLICT (id) DO NOTHING;

-- 문제: 계지탕(桂枝湯)의 구성 약재를 모두 고르시오
-- 보기: 계지, 작약, 생강, 대조, 감초, 마황, 행인, 석고, 반하, 인삼, 백출, 복령
-- 정답: 계지, 작약, 생강, 대조, 감초
INSERT INTO public.questions (id, set_id, type, question_text, options, answer)
VALUES (
  '6d1f3c2a-0002-4c1e-9a10-000000000002',
  'set-test-gusungchigi',
  'CHOICE',
  '계지탕(桂枝湯)의 구성 약재를 모두 고르시오',
  '["계지", "작약", "생강", "대조", "감초", "마황", "행인", "석고", "반하", "인삼", "백출", "복령"]'::jsonb,
  '계지, 작약, 생강, 대조, 감초'
)
ON CONFLICT (id) DO NOTHING;

-- 확인: 두 문제 id 가 나오면 성공 (구성치기 판정이 서버에서 켜졌다는 뜻)
--   SELECT public.list_multi_select_question_ids('set-test-gusungchigi');
-- 채점 확인: true, false 순서로 나와야 한다
--   SELECT public.check_question_answer('6d1f3c2a-0001-4c1e-9a10-000000000001', '감초, 행인, 계지, 마황');
--   SELECT public.check_question_answer('6d1f3c2a-0001-4c1e-9a10-000000000001', '마황, 계지, 행인');
