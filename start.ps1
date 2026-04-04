# ValoAnalytics Pro - Launcher
# Ejecucion: doble clic en start.bat

$Host.UI.RawUI.WindowTitle = "ValoAnalytics Pro"
$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "  ValoAnalytics Pro Edition" -ForegroundColor Red
Write-Host "  ================================" -ForegroundColor DarkGray
Write-Host ""

# Funcion: esperar a que un puerto responda
function Wait-Port {
    param([string]$Url, [int]$MaxSeconds = 60, [string]$Label = "servicio")
    $elapsed = 0
    while ($elapsed -lt $MaxSeconds) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            return $true
        } catch {}
        Start-Sleep -Seconds 2
        $elapsed += 2
        Write-Host "  [..] Esperando $Label... ${elapsed}s" -ForegroundColor DarkGray
    }
    return $false
}

# Funcion: verificar si un puerto esta activo
function Test-Url {
    param([string]$Url)
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        return $true
    } catch { return $false }
}

# ---- 1. Servidor API ----
Write-Host "  [..] Comprobando servidor API (puerto 3001)..." -ForegroundColor Cyan

if (Test-Url "http://localhost:3001/health") {
    Write-Host "  [OK] Servidor API ya en marcha" -ForegroundColor Green
} else {
    Write-Host "  [>>] Arrancando servidor API..." -ForegroundColor Yellow
    
    # Buscar el archivo de la API
    $apiFile = Join-Path $PSScriptRoot "valoanalytics-api.cjs"
    if (-not (Test-Path $apiFile)) {
        Write-Host "  [ERROR] No se encontro valoanalytics-api.cjs en esta carpeta" -ForegroundColor Red
        Write-Host "  Ruta buscada: $apiFile" -ForegroundColor DarkGray
        Read-Host "Pulsa Enter para cerrar"
        exit 1
    }
    
    Start-Process "node" -ArgumentList "`"$apiFile`"" -WindowStyle Minimized
    
    $ok = Wait-Port -Url "http://localhost:3001/health" -MaxSeconds 30 -Label "API"
    if ($ok) {
        Write-Host "  [OK] Servidor API listo en http://localhost:3001" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] El servidor no arranco. Comprueba que Node.js esta instalado." -ForegroundColor Red
        Write-Host "  Puedes instalarlo en https://nodejs.org" -ForegroundColor DarkGray
        Read-Host "Pulsa Enter para cerrar"
        exit 1
    }
}

# ---- 2. Frontend Vite ----
Write-Host "  [..] Comprobando frontend (puerto 5173)..." -ForegroundColor Cyan

if (Test-Url "http://localhost:5173") {
    Write-Host "  [OK] Frontend ya en marcha" -ForegroundColor Green
} else {
    Write-Host "  [>>] Arrancando frontend (npm run dev)..." -ForegroundColor Yellow
    
    Start-Process "cmd" -ArgumentList "/k npm run dev" -WorkingDirectory $PSScriptRoot -WindowStyle Minimized
    
    $ok = Wait-Port -Url "http://localhost:5173" -MaxSeconds 60 -Label "Vite"
    if ($ok) {
        Write-Host "  [OK] Frontend listo en http://localhost:5173" -ForegroundColor Green
    } else {
        Write-Host "  [..] Tiempo agotado esperando Vite. Abriendo de todas formas..." -ForegroundColor Yellow
    }
}

# ---- 3. Abrir navegador ----
Write-Host "  [>>] Abriendo ValoAnalytics en el navegador..." -ForegroundColor Cyan
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "  ================================" -ForegroundColor DarkGray
Write-Host "  App : http://localhost:5173" -ForegroundColor White
Write-Host "  API : http://localhost:3001" -ForegroundColor Gray
Write-Host "  ================================" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Manten esta ventana abierta para mantener los servidores." -ForegroundColor DarkGray
Write-Host "  Cierra la ventana para apagarlo todo." -ForegroundColor DarkGray
Write-Host ""
Read-Host "Pulsa Enter para cerrar esta ventana"