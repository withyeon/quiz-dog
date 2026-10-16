#!/bin/bash
# Lightsail(quizdog-relay)에 Socket.IO 중계 서버(relay2, 포트 8788)를 설치·갱신한다.
# 처음 서버를 만든 시작 스크립트(Node 22, relay 사용자, Caddy)가 이미 돌아간 인스턴스에서 실행한다.
#
#   curl -fsSL https://raw.githubusercontent.com/withyeon/quiz-dog/<커밋>/relay/deploy-lightsail.sh \
#     | sudo bash -s -- <커밋> <SUPABASE_URL> <SUPABASE_ANON_KEY>
#
# SUPABASE_ANON_KEY는 앱 화면에도 들어가는 공개(publishable) 키다. 이벤트 보낸 사람이 그 방 학생인지 확인할 때만 쓴다.
# Caddy는 /socket.io/ 와 /v2/ 를 새 서버로, 나머지는 예전 ws 서버(8787)로 보낸다.
set -euo pipefail

REF="${1:?git ref}"
SUPABASE_URL="${2:?supabase url}"
SUPABASE_ANON_KEY="${3:?supabase anon key}"
RAW="https://raw.githubusercontent.com/withyeon/quiz-dog/${REF}/relay"

mkdir -p /opt/relay2
curl -fsSL "${RAW}/socket-server.mjs" -o /opt/relay2/socket-server.mjs.new
node --check /opt/relay2/socket-server.mjs.new
mv /opt/relay2/socket-server.mjs.new /opt/relay2/socket-server.mjs
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
  handle /metrics {
    respond 404
  }
  handle {
    reverse_proxy 127.0.0.1:8787
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
systemctl is-active relay2 relay caddy
echo RELAY2_DEPLOYED
