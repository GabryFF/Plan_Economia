import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Aísla cada fichero de pruebas en su propia base de datos temporal.
 *
 * Debe importarse ANTES que cualquier módulo de `src/`: los módulos ES se
 * evalúan en el orden de sus imports, así que al fijar RUTA_BD aquí,
 * `config.js` ya la lee cuando le toca cargarse.
 */
const rutaBD = path.join(os.tmpdir(), `gastos-prueba-${process.pid}-${Date.now()}.db`);
process.env.RUTA_BD = rutaBD;
process.env.ABRIR_NAVEGADOR = '0';

export function limpiarBD() {
  for (const sufijo of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(`${rutaBD}${sufijo}`, { force: true });
    } catch {
      /* en Windows el fichero puede seguir bloqueado; no es motivo para fallar */
    }
  }
}

/** Vacía las tablas de datos dejando el esquema y las categorías iniciales. */
export function vaciarDatos(bd) {
  bd.exec('DELETE FROM traspasos; DELETE FROM movimientos; DELETE FROM recurrentes; DELETE FROM presupuestos;');
}

export { rutaBD };
