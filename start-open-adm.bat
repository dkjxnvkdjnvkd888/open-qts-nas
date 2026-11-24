@echo off
title OpenQTS 5.2 — DIY PC NAS Server
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"
echo Starting OpenQTS 5.2 DIY PC NAS on http://localhost:8000 ...
echo Default Login: admin / admin
node --expose-gc server\dist\index.js
pause
