import { exec } from 'node:child_process';
import { config } from './config.js';
import { crearApp } from './app.js';
import { obtenerBD, cerrarBD } from './db/conexion.js';
import { materializarPendientes } from './servicios/recurrentes.js';

obtenerBD();
const { creados } = materializarPendientes();
if (creados > 0) console.log(`[fijos] ${creados} movimiento(s) recurrente(s) generado(s)`);

const servidor = crearApp().listen(config.puerto, '127.0.0.1', () => {
  const url = `http://localhost:${config.puerto}`;
  console.log(`\n  Gestor de Gastos en marcha  ->  ${url}`);
  console.log(`  Base de datos: ${config.rutaBaseDatos}\n`);

  if (config.abrirNavegador) abrirNavegador(url);
});

servidor.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `\n  El puerto ${config.puerto} ya está en uso.\n` +
        '  Puede que la aplicación ya esté abierta en otra ventana, o que otro programa lo ocupe.\n' +
        `  Prueba con: PUERTO=3002 npm start\n`
    );
    process.exit(1);
  }
  throw error;
});

function abrirNavegador(url) {
  const comando =
    process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(comando, { windowsHide: true }, () => {});
}

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    servidor.close(() => {
      cerrarBD();
      process.exit(0);
    });
  });
}
