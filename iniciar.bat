@echo off
REM ---------------------------------------------------------------------------
REM  Gestor de Gastos - arranque para Windows.
REM  Haz doble clic en este fichero. Instala lo necesario la primera vez,
REM  prepara la aplicacion y la abre en el navegador.
REM ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"

title Gestor de Gastos

echo.
echo   ================================================
echo    Gestor de Gastos
echo   ================================================
echo.

REM --- 1. Comprobar que Node.js esta instalado -------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo   [!] No se ha encontrado Node.js en este ordenador.
  echo.
  echo   Instalalo desde https://nodejs.org ^(version 22 o superior^)
  echo   y vuelve a ejecutar este fichero.
  echo.
  pause
  exit /b 1
)

REM --- 2. Instalar dependencias la primera vez -------------------------------
if not exist "node_modules" (
  echo   Primera ejecucion: instalando componentes. Puede tardar un par de minutos...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   [!] La instalacion ha fallado. Revisa el mensaje de arriba.
    pause
    exit /b 1
  )
)

REM --- 3. Preparar la interfaz -----------------------------------------------
if not exist "web\dist\index.html" (
  echo   Preparando la aplicacion...
  echo.
  call npm run build
  if errorlevel 1 (
    echo.
    echo   [!] No se ha podido preparar la aplicacion. Revisa el mensaje de arriba.
    pause
    exit /b 1
  )
)

REM --- 4. Arrancar -----------------------------------------------------------
echo.
echo   Arrancando... se abrira sola en el navegador.
echo   IMPORTANTE: no cierres esta ventana negra mientras uses la aplicacion.
echo   Para cerrarla del todo, pulsa Ctrl+C o cierra esta ventana.
echo.

call npm start

echo.
echo   La aplicacion se ha detenido.
pause
