# Script de démarrage du Backend - MUTUALIS DAKAR
# Assure l'encodage UTF-8 dans la console PowerShell
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   DÉMARRAGE DU BACKEND - MUTUALIS DAKAR" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Vérification de l'installation des dépendances Node.js
if (-not (Test-Path "node_modules")) {
    Write-Host "Installation des dépendances npm pour le backend..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Erreur lors de l'installation des dépendances."
        Exit 1
    }
    Write-Host "Dépendances installées avec succès.`n" -ForegroundColor Green
}

# 2. Proposition d'initialisation de la base de données PostgreSQL 17
Write-Host "Souhaitez-vous initialiser et peupler la base de données PostgreSQL 17 'MUTUALIS DAKAR' ?" -ForegroundColor Yellow
Write-Host "Attention : Cela recréera toutes les tables et effacera les données précédentes." -ForegroundColor DarkYellow
$choice = Read-Host "Entrez 'O' pour oui, ou appuyez sur Entrée pour passer"

if ($choice -eq 'O' -or $choice -eq 'o') {
    Write-Host "`nInitialisation de la base de données PostgreSQL..." -ForegroundColor Yellow
    node init_db.js
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "L'initialisation a échoué. Assurez-vous que PostgreSQL 17 est démarré et que la base 'MUTUALIS DAKAR' existe."
        Write-Host "Veuillez modifier le fichier .env si les identifiants postgres/postgres ne correspondent pas.`n" -ForegroundColor Yellow
    } else {
        Write-Host "Base de données initialisée avec succès.`n" -ForegroundColor Green
    }
}

# 3. Lancement du serveur backend
Write-Host "Démarrage du serveur backend Node.js/Express..." -ForegroundColor Green
npm start
