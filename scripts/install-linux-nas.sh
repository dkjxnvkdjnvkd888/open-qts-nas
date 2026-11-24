#!/usr/bin/env bash
# ==============================================================================
# OpenQTS 5.2 — Single-Command DIY PC NAS Installer (Ubuntu 22.04/24.04 & Debian 12)
# Installs: Node.js 20 LTS, Samba (SMB Shares), NFS, mdadm RAID, smartmontools,
#           Avahi (.local discovery), Caddy (myQNAPcloud Reverse Proxy), Docker,
#           and systemd auto-start daemon (open-qts.service).
# ==============================================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "[ERROR] Please run as root: sudo bash scripts/install-linux-nas.sh"
  exit 1
fi

INSTALL_DIR="/opt/open-qts"
DATA_DIR="/srv/open-qts"
STORAGE_DIR="${DATA_DIR}/storage"
PORT="${OPEN_QTS_PORT:-8000}"
SMB_USER="${OPEN_QTS_SMB_USER:-nasadmin}"
SMB_PASS="${OPEN_QTS_SMB_PASS:-admin123}"

echo "=================================================================="
echo "  OpenQTS 5.2 — DIY PC NAS Production Installer"
echo "  Target OS: Ubuntu / Debian (x86_64 / ARM64)"
echo "=================================================================="

echo "[1/7] Installing system packages (Samba, NFS, RAID, SMART, Avahi, Caddy)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl gnupg ca-certificates lsb-release rsync \
  samba samba-common-bin nfs-kernel-server smartmontools mdadm btrfs-progs parted \
  avahi-daemon ufw caddy

echo "[2/7] Ensuring Node.js 20 LTS..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "[3/7] Ensuring Docker Engine (for App Center / Container Station)..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "[4/7] Deploying OpenQTS application files to ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}" "${STORAGE_DIR}/Public" "${STORAGE_DIR}/Media/Music" \
  "${STORAGE_DIR}/Media/Movies" "${STORAGE_DIR}/Media/Photos" \
  "${STORAGE_DIR}/Backups" "${STORAGE_DIR}/Home" "${STORAGE_DIR}/Downloads"

rsync -a --exclude node_modules --exclude .git --exclude .open-adm-data ./ "${INSTALL_DIR}/"
cd "${INSTALL_DIR}"
npm run install:all
npm run build

echo "[5/7] Configuring Samba (SMB/CIFS) Shared Folders..."
if ! id -u "${SMB_USER}" >/dev/null 2>&1; then
  useradd -M -s /usr/sbin/nologin "${SMB_USER}"
fi
(echo "${SMB_PASS}"; echo "${SMB_PASS}") | smbpasswd -s -a "${SMB_USER}"
smbpasswd -e "${SMB_USER}"

chown -R "${SMB_USER}:${SMB_USER}" "${STORAGE_DIR}"
chmod -R 0775 "${STORAGE_DIR}"

cp /etc/samba/smb.conf "/etc/samba/smb.conf.bak.$(date +%s)" 2>/dev/null || true
cat >/etc/samba/smb.conf <<EOF
[global]
   workgroup = WORKGROUP
   server string = OpenQTS DIY NAS Server
   security = user
   map to guest = Bad User
   min protocol = SMB2
   max protocol = SMB3
   ea support = yes
   vfs objects = fruit streams_xattr
   fruit:metadata = stream
   fruit:model = MacSamba

[Public]
   comment = OpenQTS Public Share
   path = ${STORAGE_DIR}/Public
   browseable = yes
   read only = no
   guest ok = yes
   create mask = 0775
   directory mask = 0775

[Media]
   comment = OpenQTS Media Library (Music Station / Jellyfin)
   path = ${STORAGE_DIR}/Media
   browseable = yes
   read only = no
   valid users = ${SMB_USER}
   create mask = 0775
   directory mask = 0775

[Backups]
   comment = OpenQTS Backups & Snapshots
   path = ${STORAGE_DIR}/Backups
   browseable = yes
   read only = no
   valid users = ${SMB_USER}
   create mask = 0775
   directory mask = 0775

[Home]
   comment = OpenQTS Home Folder
   path = ${STORAGE_DIR}/Home
   browseable = yes
   read only = no
   valid users = ${SMB_USER}
   create mask = 0775
   directory mask = 0775

[Downloads]
   comment = OpenQTS Downloads
   path = ${STORAGE_DIR}/Downloads
   browseable = yes
   read only = no
   valid users = ${SMB_USER}
   create mask = 0775
   directory mask = 0775
EOF

systemctl enable --now smbd nmbd avahi-daemon nfs-kernel-server
systemctl restart smbd nmbd

echo "[6/7] Configuring systemd auto-start service (open-qts.service)..."
cat >/etc/systemd/system/open-qts.service <<EOF
[Unit]
Description=OpenQTS 5.2 DIY PC NAS Web OS & Management Agent
After=network-online.target docker.service smbd.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=OPEN_ADM_DATA=${DATA_DIR}
Environment=OPEN_ADM_STORAGE=${STORAGE_DIR}
Environment=OPEN_QTS_APPLIANCE=true
ExecStart=/usr/bin/node --expose-gc ${INSTALL_DIR}/server/dist/index.js
Restart=always
RestartSec=3
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now open-qts.service

echo "[7/7] Opening firewall ports (if UFW is active)..."
if ufw status | grep -q "Status: active"; then
  ufw allow "${PORT}/tcp" comment "OpenQTS Web UI"
  ufw allow 445/tcp comment "SMB/CIFS"
  ufw allow 80/tcp comment "HTTP Reverse Proxy"
  ufw allow 443/tcp comment "HTTPS Reverse Proxy"
fi

IP_ADDR=$(hostname -I | awk '{print $1}')
HOST_NAME=$(hostname)
echo "=================================================================="
echo "  OpenQTS 5.2 Installed & Running Successfully!"
echo "  Web Desktop:  http://${IP_ADDR}:${PORT}"
echo "                http://${HOST_NAME}.local:${PORT}"
echo "  Web Login:    admin / admin"
echo "  SMB Network:  \\\\${IP_ADDR}\\Public  (Auth shares: ${SMB_USER} / ${SMB_PASS})"
echo "  Storage Path: ${STORAGE_DIR}"
echo "  Auto-Start:   systemctl status open-qts"
echo "=================================================================="
