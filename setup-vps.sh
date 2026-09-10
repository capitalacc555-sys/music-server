#!/usr/bin/env bash
set -e

if [ "$EUID" -ne 0 ]; then
  echo "Execute como root: sudo bash setup-vps.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y curl ca-certificates gnupg lsb-release ufw git

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

cat > /etc/apt/sources.list.d/docker.list <<EOF
# Docker repository

deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable
EOF

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin nginx certbot python3-certbot-nginx

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

systemctl enable docker
systemctl enable nginx

mkdir -p /var/www/music-server

cat > /etc/nginx/conf.d/music-server.conf <<'EOF'
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

nginx -t
systemctl reload nginx

echo ""
echo "Agora configure seu dominio DNS para apontar para este servidor."
echo "Depois rode: certbot --nginx -d seu-dominio.com -d www.seu-dominio.com"
echo "Em seguida, rode no projeto: docker compose up -d --build"
