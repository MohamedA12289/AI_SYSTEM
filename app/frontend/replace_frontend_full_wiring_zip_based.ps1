$ErrorActionPreference = 'Stop'

function Write-Step($msg) {
  Write-Host "`n=== $msg ===" -ForegroundColor Cyan
}

$frontendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $frontendRoot

$payloadZip = Join-Path $frontendRoot 'frontend_full_wired_payload.zip'
if (-not (Test-Path $payloadZip)) {
  throw "Could not find frontend_full_wired_payload.zip next to this script. Put both files in D:\AI_SYSTEM\app\frontend and run again."
}

Write-Step "Frontend root"
Write-Host $frontendRoot

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupDir = Join-Path $frontendRoot ("_frontend_backup_" + $timestamp)
$tempDir = Join-Path $frontendRoot ("_frontend_payload_" + $timestamp)

Write-Step "Creating safety backup"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$backupItems = @(
  'src',
  'public',
  'index.html',
  'package.json',
  'package-lock.json',
  'bun.lock',
  'bun.lockb',
  'components.json',
  'eslint.config.js',
  'postcss.config.js',
  'tailwind.config.ts',
  'tsconfig.app.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts',
  'vitest.config.ts',
  'playwright.config.ts',
  'playwright-fixture.ts',
  'README.md',
  '.gitignore'
)

foreach ($item in $backupItems) {
  $source = Join-Path $frontendRoot $item
  if (Test-Path $source) {
    Copy-Item -Path $source -Destination $backupDir -Recurse -Force
  }
}

Write-Step "Removing old frontend app files"
foreach ($item in $backupItems) {
  $target = Join-Path $frontendRoot $item
  if (Test-Path $target) {
    Remove-Item -Path $target -Recurse -Force
  }
}

Write-Step "Extracting replacement payload"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
Expand-Archive -Path $payloadZip -DestinationPath $tempDir -Force

Write-Step "Copying replacement frontend"
Get-ChildItem -Path $tempDir -Force | ForEach-Object {
  Copy-Item -Path $_.FullName -Destination $frontendRoot -Recurse -Force
}

Write-Step "Installing dependencies"
if (Get-Command npm -ErrorAction SilentlyContinue) {
  npm install
} else {
  throw "npm was not found in PATH. Open a PowerShell window where Node/npm works and run this script again."
}

Write-Step "Building frontend"
npm run build

Write-Step "Done"
Write-Host "Frontend replacement complete." -ForegroundColor Green
Write-Host "Backup folder: $backupDir" -ForegroundColor Yellow
Write-Host "You can now run npm run dev or npm run dev:desktop" -ForegroundColor Yellow
