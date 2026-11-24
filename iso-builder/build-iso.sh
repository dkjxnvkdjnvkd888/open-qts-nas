#!/usr/bin/env bash
# ==============================================================================
# OpenQTS 5.2 — Debian 12 Bookworm Bootable Hybrid ISO Builder (UEFI + BIOS)
# Outputs: dist-iso/open-qts-5.2-amd64.iso
# Run on Debian 12 / Ubuntu 22.04-24.04 / WSL2 Ubuntu / Docker Builder Container
# ==============================================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "[ERROR] Please run as root: sudo bash iso-builder/build-iso.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORK_DIR="${REPO_ROOT}/iso-work"
OUT_DIR="${REPO_ROOT}/dist-iso"
ISO_NAME="open-qts-5.2-amd64.iso"

echo "=================================================================="
echo "  OpenQTS 5.2 — Building Debian 12 Bookworm Bootable PC NAS ISO"
echo "=================================================================="

echo "[1/5] Installing ISO build toolchain (live-build, xorriso, squashfs-tools)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y live-build debootstrap squashfs-tools xorriso isolinux \
  syslinux-common grub-pc-bin grub-efi-amd64-bin mtools dosfstools curl rsync

echo "[2/5] Pre-building OpenQTS React UI & TypeScript Server..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
cd "${REPO_ROOT}"
npm run install:all
npm run build

echo "[3/5] Preparing live-build configuration (Debian 12 Bookworm amd64)..."
rm -rf "${WORK_DIR}"
mkdir -p "${WORK_DIR}" "${OUT_DIR}"
cd "${WORK_DIR}"

lb config \
  --distribution bookworm \
  --architectures amd64 \
  --archive-areas "main contrib non-free non-free-firmware" \
  --binary-images iso-hybrid \
  --bootloaders "syslinux,grub-efi" \
  --debian-installer none \
  --iso-application "OpenQTS 5.2 DIY PC NAS OS" \
  --iso-publisher "OpenQTS Project" \
  --iso-volume "OPENQTS_5_2" \
  --memtest none \
  --apt-recommends false \
  --linux-packages "linux-image"

# Package list embedded into the Bootable Debian 12 NAS OS
mkdir -p config/package-lists
cat >config/package-lists/openqts.list.chroot <<'EOF'
systemd-sysv
systemd-resolved
network-manager
openssh-server
sudo
curl
wget
ca-certificates
gnupg
whiptail
dialog
parted
gdisk
dosfstools
e2fsprogs
btrfs-progs
mdadm
smartmontools
lsblk
lvm2
rsync
squashfs-tools
grub-pc-bin
grub-efi-amd64-bin
grub-common
grub2-common
samba
samba-common-bin
nfs-kernel-server
avahi-daemon
ufw
htop
net-tools
iproute2
firmware-linux-free
firmware-realtek
firmware-intel-sound
EOF

echo "[4/5] Staging OpenQTS application, systemd service, and TUI installer into chroot..."
mkdir -p config/includes.chroot/opt/open-qts \
  config/includes.chroot/usr/local/sbin \
  config/includes.chroot/etc/systemd/system/getty@tty1.service.d \
  config/includes.chroot/etc/default \
  config/hooks/normal

rsync -a \
  --exclude node_modules \
  --exclude .git \
  --exclude .open-adm-data \
  --exclude iso-work \
  --exclude dist-iso \
  "${REPO_ROOT}/" config/includes.chroot/opt/open-qts/

# Copy pre-installed server production dependencies
cp -a "${REPO_ROOT}/server/node_modules" config/includes.chroot/opt/open-qts/server/node_modules

install -m 0755 "${SCRIPT_DIR}/includes.chroot/usr/local/sbin/openqts-installer" \
  config/includes.chroot/usr/local/sbin/openqts-installer
install -m 0755 "${SCRIPT_DIR}/includes.chroot/usr/local/sbin/openqts-console" \
  config/includes.chroot/usr/local/sbin/openqts-console

# Live USB marker: boots directly into TUI Installer on TTY1
touch config/includes.chroot/etc/openqts-live-mode

cat >config/includes.chroot/etc/systemd/system/getty@tty1.service.d/override.conf <<'EOF'
[Service]
ExecStart=
ExecStart=-/usr/local/sbin/openqts-installer
StandardInput=tty
StandardOutput=tty
TTYPath=/dev/tty1
Restart=always
EOF

cat >config/includes.chroot/etc/default/open-qts <<'EOF'
NODE_ENV=production
PORT=8000
OPEN_ADM_DATA=/srv/open-qts
OPEN_ADM_STORAGE=/srv/open-qts/storage
OPEN_QTS_APPLIANCE=true
OPEN_QTS_FIRST_BOOT=true
EOF

cat >config/includes.chroot/etc/systemd/system/open-qts.service <<'EOF'
[Unit]
Description=OpenQTS 5.2 DIY PC NAS Web OS & Management Agent
After=network-online.target docker.service smbd.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/open-qts
EnvironmentFile=-/etc/default/open-qts
ExecStart=/usr/bin/node --expose-gc /opt/open-qts/server/dist/index.js
Restart=always
RestartSec=3
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

# Chroot hook: install Node.js 20 LTS, Docker Engine, and Caddy inside the ISO rootfs
cat >config/hooks/normal/0500-install-openqts-runtime.hook.chroot <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh || true

# Install Caddy (for myQNAPcloud Reverse Proxy + Auto-SSL)
apt-get install -y caddy || true

mkdir -p /srv/open-qts/storage/{Public,Media/Music,Media/Movies,Media/Photos,Backups,Home,Downloads}
systemctl enable open-qts.service smbd nmbd avahi-daemon docker systemd-networkd || true
EOF
chmod +x config/hooks/normal/0500-install-openqts-runtime.hook.chroot

echo "[5/5] Running lb build (generating Hybrid UEFI+BIOS ISO)..."
lb build

BUILT_ISO=$(ls -1 "${WORK_DIR}"/*.iso | head -n 1)
cp "${BUILT_ISO}" "${OUT_DIR}/${ISO_NAME}"

echo "=================================================================="
echo "  SUCCESS! Bootable ISO generated:"
echo "  ${OUT_DIR}/${ISO_NAME}"
echo "  Flash to USB with Rufus (DD Mode) or BalenaEtcher and boot on PC!"
echo "=================================================================="
