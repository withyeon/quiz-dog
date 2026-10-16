# 방 실시간 중계 서버 (프로토타입)

Supabase Realtime의 `runtime:<방 코드>` 채널(broadcast + presence)을 대신하는 Node WebSocket 서버다.
DB·인증·리포트와 DB 변경 구독(players INSERT/DELETE, rooms UPDATE)은 그대로 Supabase에 둔다.

- 서버: [server.mjs](server.mjs) — 의존성은 `ws` 하나(루트 node_modules에 이미 있음)
- 클라이언트: [lib/realtime/transport/relayTransport.ts](../lib/realtime/transport/relayTransport.ts)
- 전송 선택: [lib/realtime/transport/index.ts](../lib/realtime/transport/index.ts), 훅은 [hooks/useRoomChannel.ts](../hooks/useRoomChannel.ts)
- 부하 측정: [loadtest.mjs](loadtest.mjs)

## 켜기

```bash
node relay/server.mjs
```

앱을 중계 서버로 돌리려면 `.env.local`에 다음을 넣고 dev 서버를 다시 띄운다. 빼면 지금처럼 Supabase를 쓴다.

```
NEXT_PUBLIC_ROOM_TRANSPORT=relay
NEXT_PUBLIC_ROOM_RELAY_URL=ws://localhost:8787
```

서버 환경 변수: `PORT`(기본 8787), `ALLOWED_ORIGINS`(쉼표 목록, 비우면 전부 허용), `RELAY_LOG_METRICS=1`(10초마다 지표 출력).

## 프로토콜 (JSON 텍스트 프레임)

| 방향 | 메시지 | 뜻 |
|---|---|---|
| → | `{t:'join', room, clientId, meta}` | 방 입장. meta는 다시 붙을 때 마지막 presence |
| ← | `{t:'joined', c, presence}` | 입장 완료. `c`는 이 연결 번호, presence는 `{clientId: meta[]}` |
| → | `{t:'ev', r, e}` | room_event 보내기. `e`는 `RoomChannelEvent` |
| ← | `{t:'ack', r, err?}` | 보낸 사람에게만. `err`: `rate_limited`, `bad_event` |
| ← | `{t:'ev', e}` | 다른 클라이언트에게 (보낸 연결은 제외, Supabase `self:false`와 같음) |
| → | `{t:'track', meta}` | presence 갱신 |
| ← | `{t:'p', k, m}` | presence 키 하나의 최신 목록(나 포함 전원에게). 빈 배열이면 나감 |
| ← | `{t:'pos', at, items}` | 점프점프 좌표 묶음 |
| → | `{t:'ping'}` | 앱 핑(25초). 프록시가 조용한 연결을 끊지 않게 |
| HTTP | `POST /rooms/<방>/events` | 소켓이 안 붙었을 때 예비 경로(Supabase REST 브로드캐스트 대응) |
| HTTP | `GET /healthz`, `GET /metrics` | 상태, 측정용 지표(부를 때마다 구간이 리셋됨) |

### 점프점프 좌표 묶음

`dontlookdown:pos`는 바로 뿌리지 않는다. 서버가 방별로 학생마다 최신 좌표만 들고 있다가 200ms마다
바뀐 것만 한 묶음으로 보낸다. 1초마다는 안 바뀐 좌표도 넣는다(받는 쪽은 3초 동안 좌표가 안 오면
높이로 추정한 위치로 바꾸기 때문). 항목은 `[연결번호, playerId, x, y, vx, vy, facingRight, isOnGround, height, energy]`이고,
클라이언트가 원래 `dontlookdown:pos` 이벤트로 풀어서 같은 경로로 흘린다. 메시지 수가 인원² → 인원에 비례로 줄어든다.

### Supabase 구현과 같게 맞춘 것

- ack: 소켓으로 보내고 10초 안에 ack가 없으면 HTTP 예비 경로로 한 번 더 보낸다(`rate_limited`면 우회하지 않는다).
- 재연결: 끊기면 1·2·5·10초 간격(±50% 흔들기)으로 다시 붙고, 다시 붙으면 훅이 `reconnected` 재동기화를 부른다.
  입장 응답이 10초 안에 없으면 `timed_out`. 훅의 3초 감시 타이머는 대기 중인 재연결을 바로 당긴다.
- presence: 키는 clientId, 탭 하나에 연결 여러 개면 키 하나에 meta 여러 개. 45초 하트비트 track은
  lastSeenAt만 바뀌면 저장만 하고 다시 뿌리지 않는다(lastSeenAt을 읽는 화면이 없다).

## 운영 전에 남은 일 (프로토타입에서 안 한 것)

- **인증**: 지금은 방 코드와 clientId만 받는다. 운영에서는 학생은 playerId가 그 방 행인지 Supabase에서 확인하고,
  교사는 Supabase 세션 토큰(JWT)을 검증해야 한다. Origin 검사(`ALLOWED_ORIGINS`)만으로는 막을 수 없다.
- **TLS**: 사이트가 HTTPS라 `wss://`가 필요하다. Lightsail 앞에 Caddy(자동 인증서)를 두고 `/`를 8787로 넘기는 구성이 가장 간단하다.
- **프로세스 관리**: systemd 또는 pm2로 재시작·로그 보관. 배포 중 재시작하면 클라이언트는 1초 안에 다시 붙는다.
- **`/metrics` 보호**: 프록시에서 막거나 토큰을 붙인다.
- **REST 예비 경로 남용 방지**: 지금은 IP별 한도가 없다.
- 서버 하나 기준이다. 방이 서버 메모리에 있으므로 여러 대로 늘리려면 방 코드로 서버를 나누는 라우팅이 필요하다(당분간 필요 없음).

## 측정 결과

[MEASUREMENTS.md](MEASUREMENTS.md)

## 운영 배포 (AWS Lightsail 서울)

- 인스턴스 `quizdog-relay`: ap-northeast-2a, Ubuntu 24.04, $7 플랜(1GB, vCPU 2, 기준 성능 10%), 고정 IP `quizdog-relay-ip` = 43.202.205.147
- 주소: `wss://rt.quizdog.kr` (가비아 DNS의 A 레코드 `rt` → 43.202.205.147). Caddy가 Let's Encrypt 인증서를 자동 발급·갱신하고 `/metrics`는 막는다.
  처음에 쓰던 `43-202-205-147.sslip.io`(IP를 그대로 풀어 주는 이름)도 같은 사이트 블록에 남아 있다.
- 방화벽: 22, 80, 443만 연다. 8787은 밖에서 안 보인다.
- 처음 켤 때 시작 스크립트가 Node 22, `/opt/relay/server.mjs`, systemd `relay.service`, Caddy를 설치한다.
  부팅할 때마다 `relay-caddyfile.service`(`/usr/local/bin/relay-caddyfile`)가 `rt.quizdog.kr`과 현재 공인 IP의 sslip 이름으로 Caddyfile을 다시 쓴다.
  고정 IP를 바꾸면 가비아 A 레코드를 고치고 재부팅하면 된다.
- `ALLOWED_ORIGINS=https://quizdog.kr,https://www.quizdog.kr,http://localhost:3000` (systemd 유닛의 Environment)
- 서버 코드 갱신: Lightsail 브라우저 SSH로 `/opt/relay/server.mjs`를 바꾸고 `sudo systemctl restart relay`. 클라이언트는 1초 안에 다시 붙는다.
- 앱 연결: Vercel 운영 환경 변수 `NEXT_PUBLIC_ROOM_TRANSPORT=relay`, `NEXT_PUBLIC_ROOM_RELAY_URL=wss://rt.quizdog.kr`.
  빌드 때 들어가는 값이라 바꾸면 다시 배포해야 한다. 되돌리려면 `NEXT_PUBLIC_ROOM_TRANSPORT`를 지우고 다시 배포하면 Supabase Realtime으로 돌아간다.
