# Démarre le backend MUTUALIS et le serveur vocal Piper en processus détachés.
Set-Location "$PSScriptRoot\backend"

# 1. Démarrer Piper TTS (port 5001 + 5002)
$piperLog = Join-Path $env:TEMP "mutualis_piper.log"
$piperErr = Join-Path $env:TEMP "mutualis_piper.err.log"
Start-Process -FilePath "node" -ArgumentList "piperServer.js" -WorkingDirectory (Get-Location) -WindowStyle Hidden -RedirectStandardOutput $piperLog -RedirectStandardError $piperErr

# 2. Démarrer Express Backend (port 5000)
$backendLog = Join-Path $env:TEMP "mutualis_backend.log"
$backendErr = Join-Path $env:TEMP "mutualis_backend.err.log"
Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory (Get-Location) -WindowStyle Hidden -RedirectStandardOutput $backendLog -RedirectStandardError $backendErr

Start-Sleep -Seconds 6
$okBackend = Test-NetConnection -ComputerName localhost -Port 5000 -InformationLevel Quiet -WarningAction SilentlyContinue
$okPiper = Test-NetConnection -ComputerName localhost -Port 5001 -InformationLevel Quiet -WarningAction SilentlyContinue

Write-Output "Backend Express :5000 : $okBackend"
Write-Output "Piper Voice TTS :5001 : $okPiper"
