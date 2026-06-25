# Script de démarrage du Frontend - MUTUALIS DAKAR
# Assure l'encodage UTF-8 dans la console PowerShell
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   DÉMARRAGE DU FRONTEND - MUTUALIS DAKAR" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Vérification de l'installation des dépendances Node.js
if (-not (Test-Path "node_modules")) {
    Write-Host "Installation des dépendances npm pour le frontend..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Erreur lors de l'installation des dépendances."
        Exit 1
    }
    Write-Host "Dépendances installées avec succès.`n" -ForegroundColor Green
}

# 2. Lancement du serveur de développement Vite sur le port 5180 avec écoute réseau
Write-Host "Démarrage du serveur de développement Vite sur le port 5180 avec écoute réseau..." -ForegroundColor Green
npm run dev -- --port 5180 --host
