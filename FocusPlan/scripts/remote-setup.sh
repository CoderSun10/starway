#!/bin/bash
# 在远程主机上安装依赖并启动。不写入任何密码；读取已有 .env / docker-compose。
set -e
export DEBIAN_FRONTEND=noninteractive
APP_USER="${DEPLOY_USER:?Set DEPLOY_USER}"
OPT="${DEPLOY_REMOTE_DIR:-/opt/ningshi}"

echo "=== install docker if needed ==="
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  usermod -aG docker "$APP_USER" || true
  systemctl enable --now docker
else
  echo "docker already installed"
  systemctl enable --now docker || true
fi

echo "=== install node if needed ==="
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "node already installed: $(node -v)"
fi

docker --version
node --version
npm --version

if [ ! -f "$OPT/.env" ]; then
  echo "ERROR: $OPT/.env is missing. Copy your local .env to the server first."
  exit 1
fi

echo "=== start mysql + api ==="
cd "$OPT"
docker compose down || true
docker compose up -d --build

echo "Waiting API..."
for i in $(seq 1 50); do
  if curl -sf http://127.0.0.1:3001/health >/dev/null 2>&1; then
    echo "API ready"
    break
  fi
  sleep 3
done
docker ps

echo "=== npm install (host node fallback) ==="
cd "$OPT/backend"
sudo -u "$APP_USER" npm install --omit=dev

echo "=== systemd ==="
cat > /etc/systemd/system/ningshi-api.service <<EOF
[Unit]
Description=Ningshi Focus API
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${OPT}/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ningshi-api
systemctl restart ningshi-api
sleep 2
systemctl --no-pager status ningshi-api || true

if command -v ufw >/dev/null 2>&1; then
  ufw allow 3001/tcp || true
  ufw allow 22/tcp || true
fi

echo "=== health ==="
sleep 1
curl -sS http://127.0.0.1:3001/health || true
echo
echo "=== SETUP DONE ==="
