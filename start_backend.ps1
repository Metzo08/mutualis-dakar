# Démarre le backend MUTUALIS dans un processus détaché (survit à la session shell).
Set-Location "$PSScriptRoot\backend"
$log = Join-Path $env:TEMP "mutualis_backend.log"
Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory (Get-Location) -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError "$env:TEMP\mutualis_backend.err.log"
Start-Sleep -Seconds 8
$ok = Test-NetConnection -ComputerName localhost -Port 5000 -InformationLevel Quiet -WarningAction SilentlyContinue
Write-Output "Listener :5000 : $ok"
