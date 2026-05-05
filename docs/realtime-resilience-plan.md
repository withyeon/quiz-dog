# Realtime Resilience Plan

## 목표

여러 명의 학생이 하나의 방에서 동시에 플레이해도 게임 흐름이 끊기지 않고, 학생이 새로고침하거나 네트워크가 잠깐 끊겼다가 돌아와도 현재 방 상태와 개인 진행 상태를 안전하게 복구한다.

## 현재 리스크

- `players`, `rooms` 변경을 Postgres Changes로 직접 구독하고 있어 학생 수가 늘수록 DB 변경 이벤트가 모든 클라이언트로 팬아웃된다.
- `answer_history`처럼 커지는 JSON payload가 정답마다 통째로 저장된다.
- 일부 전역 로직이 모든 학생 클라이언트에서 실행될 수 있다.
  - 배틀로얄 자기장 피해
  - 제한 시간 종료 처리
  - 게임 종료 처리
- 새로고침 후 복구 기준이 `sessionStorage`와 현재 DB row에 흩어져 있다.

## 원칙

1. DB는 영구 상태의 최종 원장으로 사용한다.
2. Broadcast는 빠른 게임 이벤트와 UI patch 전달에 사용한다.
3. Presence는 현재 접속 중인 학생과 host 선출에 사용한다.
4. Postgres Changes는 낮은 빈도의 room 상태 변화와 fallback snapshot에만 사용한다.
5. 전역 상태를 바꾸는 로직은 한 클라이언트만 실행하거나, 가능하면 RPC/서버에서 원자적으로 처리한다.
6. 모든 복구는 "최신 DB snapshot + client-local progress" 조합으로 한다.

## 채널 설계

방마다 하나의 runtime topic을 둔다.

```text
runtime:<roomCode>
```

### Presence payload

```ts
{
  clientId: string
  role: 'student' | 'teacher' | 'spectator'
  playerId?: string | null
  onlineAt: string
  lastSeenAt: string
}
```

### Broadcast event envelope

```ts
{
  type: string
  roomCode: string
  clientId: string
  playerId?: string | null
  sentAt: string
  seq?: number
  payload?: unknown
}
```

### 주요 이벤트

- `room:resync-request`: 재접속/탭 복귀 시 최신 snapshot이 필요함을 알림
- `room:snapshot-hint`: DB snapshot을 다시 읽으라는 가벼운 알림
- `game:finished`: 게임 종료 UI 전환 힌트
- `player:patch`: 점수/체력/위치 같은 작은 변경 patch
- `game:effect`: 아이템, 공격, 화면 효과처럼 저장이 필수는 아닌 이벤트

## 재접속 흐름

1. 클라이언트는 `clientId`를 `sessionStorage`에 저장한다.
2. Realtime channel이 `SUBSCRIBED` 상태가 되면 Presence를 track한다.
3. 최초 구독 또는 재구독 시 DB에서 `room`, `players` snapshot을 다시 읽는다.
4. 브라우저 탭이 다시 visible이 되면 snapshot을 다시 읽는다.
5. Broadcast 이벤트는 화면 반응을 빠르게 만들지만, 복구 기준은 항상 DB snapshot이다.
6. 중복 이벤트는 `clientId`, `seq`, `attemptId`로 무시할 수 있게 설계한다.

## Host 선출

전역 타이머나 전역 피해 처리처럼 "한 번만 실행되어야 하는 로직"은 Presence 기준 host만 실행한다.

우선순위:

1. teacher presence가 있으면 teacher
2. 접속 중인 student 중 정렬상 첫 번째 player
3. Presence가 아직 비어 있으면 DB players 중 첫 번째 player

이번 리팩토링에서는 teacher role을 위한 기반만 두고, 학생 페이지에서는 접속 중인 player 중 첫 번째를 host로 사용한다.

## 단계별 적용

### 1단계: 즉시 안정화

- `useRoomChannel` 훅 추가
- `useRoomRealtime`, `usePlayersRealtime`에 재동기화 함수와 reconnect refresh 추가
- `finishRoom`을 idempotent하게 변경
- 전역 timer/finish 로직에 host guard 적용
- `answer_history` 저장 debounce 적용

### 2단계: 이벤트 경량화

- 점수/체력/위치 변경 후 Broadcast `player:patch` 발행
- leaderboard는 DB row 전체 구독 대신 patch와 주기적 snapshot으로 갱신
- `select('*')`를 화면별 필요한 컬럼으로 축소

### 3단계: 서버 권위 강화

- `submit_answer` RPC 또는 API route 추가
- 채점, 점수 계산, answer history append를 한 곳에서 처리
- 학생 클라이언트는 자기 player row만 갱신 가능하도록 RLS 강화

### 4단계: 관측과 제한

- Realtime status, reconnect count, snapshot refresh count를 개발 로그/analytics로 수집
- 너무 빠른 업데이트는 throttle 또는 batch 처리
- Broadcast replay를 쓰려면 `@supabase/supabase-js`를 replay 지원 버전으로 올린 뒤 private channel/RLS 정책을 정비한다.

## 이번 변경의 범위

이번 작업은 1단계를 구현한다. DB schema를 강제로 변경하지 않고, 기존 화면이 깨지지 않도록 현재 Postgres Changes 흐름을 유지하면서 Broadcast/Presence 기반 복구 레이어와 중복 실행 방어를 추가한다.
