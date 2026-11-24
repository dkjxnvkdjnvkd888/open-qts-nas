# Build OpenQTS 5.2 Bootable Debian 12 ISO from Windows using Docker Desktop
# Requires Docker Desktop (Linux containers / WSL2 backend)
$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path "$PSScriptRoot\.."

Write-Host "Building OpenQTS Debian 12 ISO Builder Docker image..." -ForegroundColor Cyan
docker build -t openqts-iso-builder "$PSScriptRoot"

Write-Host "Running privileged ISO builder container (outputs dist-iso\open-qts-5.2-amd64.iso)..." -ForegroundColor Cyan
docker run --rm --privileged `
  -v "${RepoRoot}:/workspace" `
  openqts-iso-builder

Write-Host "Done! Flash dist-iso\open-qts-5.2-amd64.iso to USB with Rufus or BalenaEtcher." -ForegroundColor Green
