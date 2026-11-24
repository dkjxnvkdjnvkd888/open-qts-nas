# OpenQTS 5.2 — Debian 12 Bootable DIY PC NAS Operating System

A complete QNAP QTS 5.x–inspired DIY PC NAS Operating System built with **Node.js / TypeScript + React**, designed to test directly on Windows, install onto Ubuntu/Debian PCs with one command, or build into a **Bootable Debian 12 Hybrid ISO (UEFI + BIOS)** for USB installation on any x86_64 PC.

## Key Capabilities

- **QNAP QTS 5.x Desktop Web OS**: Dark top bar with slide-out Main Menu drawer, open window tabs with inline close, Background Tasks progress monitor, Notification Board, zero-lag pointer window dragging, crisp `150ms` transitions, and floating circular **Qboost** RAM/CPU optimizer.
- **First-Boot Smart Installation Wizard**: Guides new NAS owners through naming the NAS, setting the admin/SMB password, and choosing timezone on first boot.
- **File Station 5**: Dark tree sidebar, file upload/download, preview, rename, search, and quick snapshots.
- **Storage & Snapshots**: Real PC drive & S.M.A.R.T. detection, `mdadm` RAID (Single/JBOD/RAID 0, 1, 5, 6, 10), and **Btrfs Read-Only Snapshots**.
- **Music Station 5 & QuMagie Photo/Video Station**: Stream `.mp3`, `.flac`, `.wav`, photos, and `.mp4`/`.webm` videos from `Media/` with true HTTP `206 Partial Content` seeking.
- **myQNAPcloud (DDNS + Reverse Proxy)**: Real DuckDNS and Cloudflare DNS API updater + Reverse Proxy manager with auto-generated **Caddyfile** & **Nginx** configs.
- **App Center (Docker Compose)**: 12 NAS apps (Jellyfin, Immich, Nextcloud, qBittorrent, Home Assistant, Pi-hole, Portainer, Syncthing, Vaultwarden, Plex, Duplicati, Nginx Proxy Manager) backed by generated `docker-compose.yml` stacks.
- **Control Panel (OS-Level Integration)**: Auto-syncs Users & Shared Folders to `/etc/samba/smb.conf` and `/etc/exports`, manages DHCP/Static IP (`systemd-networkd`), Backup/Restore config JSON, OTA Firmware Updates, and real Reboot/Shutdown in Appliance Mode.

## 1. Quick Test on Windows

Double-click **`start-open-adm.bat`** (or run `npm run build && npm start`), then open **http://localhost:8000** (`admin` / `admin`).

## 2. Build the Bootable Debian 12 PC NAS `.iso` (UEFI + BIOS)

Choose whichever method fits your environment:

- **GitHub Actions (Cloud — Easiest from Windows)**: Push this folder to a GitHub repo -> open **Actions** -> run **`Build OpenQTS 5.2 Bootable Debian 12 ISO`** -> download `open-qts-5.2-amd64.iso`.
- **WSL2 (Ubuntu/Debian) or Linux PC**:
  ```bash
  sudo bash iso-builder/build-iso.sh
  ```
- **Windows with Docker Desktop**:
  ```powershell
  powershell -ExecutionPolicy Bypass -File iso-builder\build-with-docker.ps1
  ```

Flash `dist-iso/open-qts-5.2-amd64.iso` onto a USB drive using **Rufus (DD Mode)**, **BalenaEtcher**, or **Ventoy**. Boot any PC from USB -> follow the **OpenQTS TUI Disk Installer** -> remove USB & reboot -> manage via the LAN IP displayed on the console!

## 3. One-Command Install on Existing Ubuntu / Debian PC

```bash
sudo bash scripts/install-linux-nas.sh
```
