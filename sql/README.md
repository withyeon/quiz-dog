# 데이터베이스 설정 가이드

이 디렉토리에는 Supabase 데이터베이스 설정을 위한 SQL 파일들이 있습니다.

## 파일 설명

### 1. `setup.sql` ⭐ (필수)
- **용도**: 데이터베이스 초기 설정
- **내용**: 테이블 생성, 트리거 설정, Realtime 활성화, 인덱스 생성
- **실행 순서**: 가장 먼저 실행해야 합니다

### 2. `reset.sql` ⚠️
- **용도**: 데이터베이스 초기화 (모든 데이터 삭제)
- **내용**: 모든 테이블과 데이터 삭제
- **주의**: 개발 환경에서만 사용하세요!

### 3. `sample_data.sql`
- **용도**: 테스트용 샘플 데이터 생성
- **내용**: 샘플 방, 샘플 문제 생성
- **실행 순서**: `setup.sql` 실행 후 선택적으로 실행

### 4. `20260504_game_runtime_integrity.sql`
- **용도**: 현재 코드에서 사용하는 게임 모드/플레이어 런타임 필드 정합성 보강
- **내용**: 전체 게임 모드 체크 제약, `rooms.set_id`, 제한 시간 필드, 인형뽑기/편의점/배틀/카페/마피아 런타임 컬럼
- **실행 순서**: `setup.sql`, `migration_question_sets.sql`, `add_question_sets_metadata.sql` 이후 실행

## 실행 방법

### Supabase 대시보드에서 실행

1. **Supabase 대시보드 접속**
   - https://supabase.com 접속
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 왼쪽 메뉴에서 "SQL Editor" 클릭
   - "New query" 버튼 클릭

3. **SQL 파일 실행**
   - 파일 내용을 복사하여 붙여넣기
   - "Run" 버튼 클릭 (또는 `Cmd/Ctrl + Enter`)

### 실행 순서

```bash
# 1. 초기 설정 (필수)
setup.sql

# 2. 샘플 데이터 (선택)
sample_data.sql

# 3. 문제집 원장 및 메타데이터 (권장)
migration_question_sets.sql
add_question_sets_metadata.sql

# 4. 게임 런타임 정합성 보강 (권장)
20260504_game_runtime_integrity.sql
```

## 테이블 구조

### `rooms` 테이블
게임 방 정보를 저장합니다.
- `room_code`: 방 코드 (Primary Key)
- `status`: 방 상태 ('waiting', 'playing', 'finished')
- `current_q_index`: 현재 문제 인덱스

### `players` 테이블
플레이어 정보를 저장합니다. (Realtime 활성화)
- `id`: 플레이어 ID (UUID)
- `room_code`: 방 코드 (Foreign Key)
- `nickname`: 닉네임
- `score`: 점수
- `gold`: 골드
- `avatar`: 아바타 (이모지)

### `questions` 테이블
문제 정보를 저장합니다.
- `id`: 문제 ID (UUID)
- `set_id`: 문제집 ID
- `type`: 문제 타입 ('CHOICE', 'SHORT', 'OX', 'BLANK')
- `question_text`: 문제 텍스트
- `options`: 보기 (JSONB 배열)
- `answer`: 정답

## 문제 해결

### "Could not find the table 'public.rooms' in the schema cache" 에러
- `setup.sql`을 실행하지 않았거나 실행에 실패한 경우입니다.
- Supabase SQL Editor에서 `setup.sql`을 다시 실행하세요.

### Realtime이 작동하지 않는 경우
- `setup.sql`의 Realtime 활성화 부분이 실행되었는지 확인하세요.
- Supabase 대시보드 > Database > Replication에서 테이블이 활성화되어 있는지 확인하세요.

### 테이블을 다시 만들고 싶은 경우
1. `reset.sql` 실행 (모든 데이터 삭제)
2. `setup.sql` 실행 (테이블 재생성)
3. (선택) `sample_data.sql` 실행 (샘플 데이터 생성)

## 추가 설정

### RLS (Row Level Security) 활성화
보안을 강화하려면 `setup.sql`의 RLS 관련 주석을 해제하세요.
개발 단계에서는 비활성화해도 됩니다.

### 인덱스 추가
성능 최적화를 위해 추가 인덱스를 생성할 수 있습니다:
```sql
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_questions_type ON questions(type);
```
