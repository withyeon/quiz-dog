#!/bin/bash
# Lightsail(quizdog-relay)에 Socket.IO 중계 서버(relay2, 포트 8788)를 설치·갱신한다.
# 처음 서버를 만든 시작 스크립트(Node 22, relay 사용자, Caddy)가 이미 돌아간 인스턴스에서 실행한다.
#
#   curl -fsSL https://raw.githubusercontent.com/withyeon/quiz-dog/<커밋>/relay/deploy-lightsail.sh \
#     | sudo bash -s -- <커밋> <SUPABASE_URL> <SUPABASE_ANON_KEY> [관리자 이메일,쉼표로]
#
# 이미 한 번 배포한 서버는 커밋만 줘도 된다. 빠진 값은 지금 relay2.service 에 있는 값을 그대로 쓴다.
#
#   curl -fsSL https://raw.githubusercontent.com/withyeon/quiz-dog/<커밋>/relay/deploy-lightsail.sh | sudo bash -s -- <커밋>
#
# SUPABASE_ANON_KEY는 앱 화면에도 들어가는 공개(publishable) 키다. 이벤트 보낸 사람이 그 방 학생인지 확인할 때만 쓴다.
# 관리자 판정은 Supabase is_admin()(admin_users 표)으로 한다. 관리자 이메일 인자는 그 함수가 아직 없을 때만 쓰는 예비 목록이다.
# Caddy는 /socket.io/ 와 /v2/ 만 이 서버로 보내고 나머지는 404다. 예전 ws 서버(relay.service, 8787)는 끈다.
set -euo pipefail

REF="${1:?git ref}"
UNIT_FILE=/etc/systemd/system/relay2.service
current_env() { [ -f "$UNIT_FILE" ] && sed -n "s/^Environment=$1=//p" "$UNIT_FILE" | head -n1 || true; }
SUPABASE_URL="${2:-$(current_env SUPABASE_URL)}"
SUPABASE_ANON_KEY="${3:-$(current_env SUPABASE_ANON_KEY)}"
RELAY_ADMIN_EMAILS="${4:-$(current_env RELAY_ADMIN_EMAILS)}"
RELAY_ADMIN_EMAILS="${RELAY_ADMIN_EMAILS:-withyeonedu@gmail.com,tjdud3617@gmail.com,withyeongpt@hyeonedu.com}"
: "${SUPABASE_URL:?supabase url (처음 배포면 둘째 인자로 주세요)}"
: "${SUPABASE_ANON_KEY:?supabase anon key (처음 배포면 셋째 인자로 주세요)}"
RAW="https://raw.githubusercontent.com/withyeon/quiz-dog/${REF}/relay"

mkdir -p /opt/relay2
curl -fsSL "${RAW}/socket-server.mjs" -o /opt/relay2/socket-server.next.mjs
node --check /opt/relay2/socket-server.next.mjs
mv /opt/relay2/socket-server.next.mjs /opt/relay2/socket-server.mjs
cat > /opt/relay2/package.json <<'PKG'
{ "name": "quizdog-relay2", "private": true, "type": "module", "dependencies": { "socket.io": "4.8.4" } }
PKG
(cd /opt/relay2 && /usr/local/bin/npm install --omit=dev --no-audit --no-fund)
chown -R relay:relay /opt/relay2

cat > /etc/systemd/system/relay2.service <<UNIT
[Unit]
Description=quizdog room relay (socket.io)
After=network-online.target
[Service]
User=relay
WorkingDirectory=/opt/relay2
Environment=PORT=8788
Environment=ALLOWED_ORIGINS=https://quizdog.kr,https://www.quizdog.kr,http://localhost:3000
Environment=SUPABASE_URL=${SUPABASE_URL}
Environment=SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
Environment=RELAY_ADMIN_EMAILS=${RELAY_ADMIN_EMAILS}
Environment=NODE_ENV=production
ExecStart=/usr/local/bin/node /opt/relay2/socket-server.mjs
Restart=always
RestartSec=1
LimitNOFILE=65536
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable relay2
systemctl restart relay2
systemctl disable --now relay 2>/dev/null || true

cat > /usr/local/bin/relay-caddyfile <<'GEN'
#!/bin/bash
IP=$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')
HOST="${IP//./-}.sslip.io"
cat > /etc/caddy/Caddyfile <<CADDY
rt.quizdog.kr, $HOST {
  handle /socket.io/* {
    reverse_proxy 127.0.0.1:8788
  }
  handle /v2/* {
    @metrics path /v2/metrics
    respond @metrics 404
    reverse_proxy 127.0.0.1:8788
  }
  handle {
    respond 404
  }
}
CADDY
echo "$HOST" > /etc/relay-host
GEN
chmod +x /usr/local/bin/relay-caddyfile
/usr/local/bin/relay-caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy

sleep 2
curl -fsS http://127.0.0.1:8788/v2/healthz && echo
systemctl is-active relay2 caddy
echo RELAY2_DEPLOYED
