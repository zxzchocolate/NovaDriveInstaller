$ErrorActionPreference = "Stop"

$Base = "https://zxzchocolate.github.io/NovaDriveInstaller"
$Bin = Join-Path $env:LOCALAPPDATA "NovaDrive"

Write-Host "NovaDrive Installer"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js 18 or newer is required."
    Write-Host "Install Node.js and run the installer again."
    exit 1
}

$version = node -p "process.versions.node.split('.')[0]"

if ([int]$version -lt 18) {
    Write-Host "Node.js 18 or newer is required."
    exit 1
}

New-Item `
    -ItemType Directory `
    -Force `
    -Path $Bin | Out-Null

Write-Host "Downloading NovaDrive..."

Invoke-WebRequest `
    "$Base/novadrive.mjs" `
    -OutFile (Join-Path $Bin "novadrive.mjs")

Write-Host "Installing Puter.js..."

Push-Location $Bin

if (-not (Test-Path "package.json")) {
    Set-Content `
        -Path "package.json" `
        -Value '{"private":true,"dependencies":{"@heyputer/puter.js":"latest"}}'
}

npm install --silent

Pop-Location

$cmd = @"
@echo off
node "$Bin\novadrive.mjs" %*
"@

Set-Content `
    -Path (Join-Path $Bin "novadrive.cmd") `
    -Value $cmd

$userPath = [Environment]::GetEnvironmentVariable("Path","User")

if ($userPath -notlike "*$Bin*") {
    [Environment]::SetEnvironmentVariable(
        "Path",
        ($userPath.TrimEnd(";") + ";" + $Bin),
        "User"
    )
}

Write-Host ""
Write-Host "NovaDrive installed."
Write-Host ""
Write-Host "Open a new terminal and run:"
Write-Host ""
Write-Host "    novadrive"
Write-Host ""
