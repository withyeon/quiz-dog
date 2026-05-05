# SQL 마이그레이션 실행 가이드 📚

## Battle Royale 게임 모드 필드 추가

### 1단계: Supabase 대시보드 접속

1. **Supabase 웹사이트 접속**
   - https://supabase.com 접속
   - 로그인

2. **프로젝트 선택**
   - 대시보드에서 퀴즈독 프로젝트 선택

---

### 2단계: SQL Editor 열기

1. **왼쪽 사이드바에서 "SQL Editor" 클릭**
   - 📝 SQL Editor 아이콘 클릭

2. **"New query" 버튼 클릭**
   - 상단 우측에 있는 "New query" 버튼 클릭
   - 또는 `Cmd/Ctrl + K` 단축키 사용

---

### 3단계: SQL 파일 내용 복사

1. **로컬 파일 열기**
   - 프로젝트 폴더에서 `sql/add_battle_fields.sql` 파일 열기

2. **전체 내용 복사**
   - 파일 내용 전체 선택 (`Cmd/Ctrl + A`)
   - 복사 (`Cmd/Ctrl + C`)

---

### 4단계: SQL 실행

1. **SQL Editor에 붙여넣기**
   - Supabase SQL Editor의 텍스트 영역에 붙여넣기 (`Cmd/Ctrl + V`)

2. **실행 버튼 클릭**
   - 우측 하단의 **"Run"** 버튼 클릭
   - 또는 `Cmd/Ctrl + Enter` 단축키 사용

3. **결과 확인**
   - 하단에 "Success. No rows returned" 메시지가 표시되면 성공!
   - 에러가 있으면 에러 메시지를 확인하세요

---

## 실행할 SQL 내용

```sql
-- ============================================
-- Battle Royale 게임 모드 필드 추가
-- ============================================

-- rooms 테이블에 game_mode 확장 (이미 있을 수 있음)
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS game_mode TEXT CHECK (game_mode IN ('gold_quest', 'battle_royale'));

-- players 테이블에 체력 필드 추가
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS health INTEGER DEFAULT 100;

-- players 테이블에 공격력 필드 추가 (선택적)
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS attack_power INTEGER DEFAULT 10;

-- players 테이블에 방어력 필드 추가 (선택적)
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS defense INTEGER DEFAULT 0;

-- 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_players_health ON players(health);
CREATE INDEX IF NOT EXISTS idx_players_room_health ON players(room_code, health);
```

---

## 문제 해결

### 에러: "column already exists"
- **원인**: 필드가 이미 존재함
- **해결**: `IF NOT EXISTS` 구문이 있어서 무시해도 됩니다. 정상입니다!

### 에러: "permission denied"
- **원인**: 권한 문제
- **해결**: 프로젝트 소유자인지 확인하세요

### 에러: "relation does not exist"
- **원인**: 테이블이 아직 생성되지 않음
- **해결**: 먼저 `sql/setup.sql`을 실행했는지 확인하세요

---

## 실행 순서 (처음부터 시작하는 경우)

1. **`sql/setup.sql`** - 기본 테이블 생성 (이미 했다면 스킵)
2. **`sql/add_racing_fields.sql`** - Racing 게임 모드 필드 (이미 했다면 스킵)
3. **`sql/add_battle_fields.sql`** - Battle Royale 게임 모드 필드 ⭐ **지금 실행할 것**

---

## 확인 방법

SQL 실행 후, 다음 방법으로 확인할 수 있습니다:

1. **Table Editor에서 확인**
   - 왼쪽 사이드바 → "Table Editor" 클릭
   - `players` 테이블 선택
   - 컬럼 목록에서 `health`, `attack_power`, `defense` 확인

2. **SQL로 확인**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'players' 
   AND column_name IN ('health', 'attack_power', 'defense');
   ```

---

## 완료!

SQL 실행이 완료되면 Battle Royale 게임 모드를 사용할 수 있습니다! 🎮
