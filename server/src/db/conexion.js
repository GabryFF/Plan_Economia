import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { aplicarMigraciones } from './migraciones.js';
import { sembrarCategoriasIniciales, sembrarCuentaInicial } from './semilla.js';

let bd = null;

/**
 * Devuelve la conexión SQLite (singleton). La base de datos es un único
 * fichero: para hacer copia de seguridad basta con copiarlo.
 */
export function obtenerBD() {
  if (bd) return bd;

  fs.mkdirSync(path.dirname(config.rutaBaseDatos), { recursive: true });
  bd = new DatabaseSync(config.rutaBaseDatos);

  // WAL mejora la concurrencia lectura/escritura; foreign_keys no viene activo por defecto.
  bd.exec('PRAGMA journal_mode = WAL');
  bd.exec('PRAGMA foreign_keys = ON');

  aplicarMigraciones(bd);
  sembrarCategoriasIniciales(bd);
  sembrarCuentaInicial(bd);

  return bd;
}

export function cerrarBD() {
  if (bd) {
    bd.close();
    bd = null;
  }
}

/** Ejecuta `fn` dentro de una transacción, con rollback automático si lanza. */
export function enTransaccion(fn) {
  const db = obtenerBD();
  db.exec('BEGIN');
  try {
    const resultado = fn(db);
    db.exec('COMMIT');
    return resultado;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
