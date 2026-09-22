@echo off

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"irm https://zxzchocolate.github.io/NovaDriveInstaller/install.ps1 | iex"
