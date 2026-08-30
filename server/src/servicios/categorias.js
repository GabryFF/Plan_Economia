import { obtenerBD } from '../db/conexion.js';
import { conflicto, noEncontrado } from '../utiles/errores.js';

const mapear = (fila) => ({
  id: fila.id,
  nombre: fila.nombre,
  tipo: fila.tipo,
  color: fila.color,
  archivada: Boolean(fila.archivada),
  movimientos: fila.movimientos ?? 0,
});

export function listarCategorias({ incluirArchivadas = false } = {}) {
  const bd = obtenerBD();
  const filas = bd
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM movimientos m WHERE m.categoria_id = c.id) AS movimientos
       FROM categorias c
       ${incluirArchivadas ? '' : 'WHERE c.archivada = 0'}
       ORDER BY c.tipo DESC, c.nombre COLLATE NOCASE`
    )
    .all();
  return filas.map(mapear);
}

export function obtenerCategoria(id) {
  const bd = obtenerBD();
  // El contador de movimientos debe venir en la misma consulta: `borrarCategoria`
  // decide con el si protege el borrado.
  const fila = bd
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM movimientos m WHERE m.categoria_id = c.id) AS movimientos
       FROM categorias c WHERE c.id = ?`
    )
    .get(id);
  if (!fila) throw noEncontrado('Categoría');
  return mapear(fila);
}

export function crearCategoria({ nombre, tipo, color }) {
  const bd = obtenerBD();
  const existente = bd
    .prepare('SELECT id FROM categorias WHERE nombre = ? COLLATE NOCASE AND tipo = ?')
    .get(nombre, tipo);
  if (existente) throw conflicto(`Ya existe una categoría de ${tipo} llamada "${nombre}"`);

  const { lastInsertRowid } = bd
    .prepare('INSERT INTO categorias (nombre, tipo, color) VALUES (?, ?, ?)')
    .run(nombre, tipo, color);

  return obtenerCategoria(Number(lastInsertRowid));
}

export function actualizarCategoria(id, cambios) {
  const bd = obtenerBD();
  const actual = obtenerCategoria(id);

  const nombre = cambios.nombre ?? actual.nombre;
  const tipo = cambios.tipo ?? actual.tipo;
  const color = cambios.color ?? actual.color;
  const archivada = cambios.archivada ?? actual.archivada;

  const duplicada = bd
    .prepare('SELECT id FROM categorias WHERE nombre = ? COLLATE NOCASE AND tipo = ? AND id <> ?')
    .get(nombre, tipo, id);
  if (duplicada) throw conflicto(`Ya existe una categoría de ${tipo} llamada "${nombre}"`);

  bd.prepare(
    'UPDATE categorias SET nombre = ?, tipo = ?, color = ?, archivada = ? WHERE id = ?'
  ).run(nombre, tipo, color, archivada ? 1 : 0, id);

  return obtenerCategoria(id);
}

/**
 * Borra la categoría. Si tiene movimientos asociados no se elimina salvo que se
 * fuerce: en ese caso los movimientos quedan "sin categoría" (ON DELETE SET NULL),
 * nunca se borran datos económicos por arrastre.
 */
export function borrarCategoria(id, { forzar = false } = {}) {
  const bd = obtenerBD();
  const categoria = obtenerCategoria(id);

  if (categoria.movimientos > 0 && !forzar) {
    throw conflicto(
      `La categoría "${categoria.nombre}" tiene ${categoria.movimientos} movimiento(s). ` +
        'Archívala para dejar de usarla, o confirma el borrado para dejar esos movimientos sin categoría.'
    );
  }

  bd.prepare('DELETE FROM categorias WHERE id = ?').run(id);
  return { borrada: true, movimientosAfectados: categoria.movimientos };
}

/** Busca por nombre (case-insensitive) o la crea. Usado por la importación. */
export function buscarOCrearPorNombre(nombre, tipo, { crear = false } = {}) {
  const bd = obtenerBD();
  const fila = bd
    .prepare('SELECT id FROM categorias WHERE nombre = ? COLLATE NOCASE AND tipo = ?')
    .get(nombre, tipo);
  if (fila) return fila.id;
  if (!crear) return null;

  const { lastInsertRowid } = bd
    .prepare('INSERT INTO categorias (nombre, tipo) VALUES (?, ?)')
    .run(nombre, tipo);
  return Number(lastInsertRowid);
}
