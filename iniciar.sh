#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Gestor de Gastos - arranque para macOS y Linux.
#  Uso: ./iniciar.sh
# ---------------------------------------------------------------------------
set -e
cd "$(dirname "$0")"

echo
echo "  ================================================"
echo "   Gestor de Gastos"
echo "  ================================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "  [!] No se ha encontrado Node.js."
  echo "      Instálalo desde https://nodejs.org (versión 22 o superior)."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "  Primera ejecución: instalando componentes..."
  npm install
fi

if [ ! -f web/dist/index.html ]; then
  echo "  Preparando la aplicación..."
  npm run build
fi

echo
echo "  Arrancando... se abrirá sola en el navegador."
echo "  Deja esta ventana abierta mientras uses la aplicación (Ctrl+C para salir)."
echo

npm start
