import { obtenerBD } from '../db/conexion.js';
import { aCentimos, aEuros } from '../utiles/dinero.js';
import { conflicto, noEncontrado, peticionInvalida } from '../utiles/errores.js';

const SELECCION = `
  SELECT m.id, m.fecha, m.importe_centimos, m.descripcion, m.tipo, m.categoria_id,
         m.recurrente_id, m.origen, m.creado_en, m.actualizado_en,
         m.cuenta_id, c.nombre AS categoria_nombre, c.color AS categoria_color,
         cu.nombre AS cuenta_nombre, cu.color AS cuenta_color
  FROM movimientos m
  LEFT JOIN categorias c ON c.id = m.categoria_id
  LEFT JOIN cuentas cu ON cu.id = m.cuenta_id`;

const mapear = (f) => ({
  id: f.id,
  fecha: f.fecha,
  importe: aEuros(f.importe_centimos),
  descripcion: f.descripcion,
  tipo: f.tipo,
  categoriaId: f.categoria_id,
  categoriaNombre: f.categoria_nombre,
  categoriaColor: f.categoria_color,
  cuentaId: f.cuenta_id,
  cuentaNombre: f.cuenta_nombre,
  cuentaColor: f.cuenta_color,
  recurrenteId: f.recurrente_id,
  origen: f.origen,
  creadoEn: f.creado_en,
  actualizadoEn: f.actualizado_en,
});

/**
 * Cuenta a la que van los movimientos que no indican ninguna: la primera activa.
 * Con una sola cuenta el usuario ni se entera de que el concepto existe.
 */
export function cuentaPorDefecto() {
  const fila = obtenerBD().prepare('SELECT id FROM cuentas WHERE activa = 1 ORDER BY orden, id LIMIT 1').get();
  return fila?.id ?? null;
}

/** Traduce los filtros de la API a WHERE + parámetros, para reutilizar en listado y exportación. */
export function construirFiltro({ desde, hasta, tipo, categoriaId, cuentaId, texto, origen } = {}) {
  const condiciones = [];
  const parametros = [];

  if (desde) { condiciones.push('m.fecha >= ?'); parametros.push(desde); }
  if (hasta) { condiciones.push('m.fecha <= ?'); parametros.push(hasta); }
  if (tipo) { condiciones.push('m.tipo = ?'); parametros.push(tipo); }
  if (categoriaId) { condiciones.push('m.categoria_id = ?'); parametros.push(categoriaId); }
  if (cuentaId) { condiciones.push('m.cuenta_id = ?'); parametros.push(cuentaId); }
  if (origen) { condiciones.push('m.origen = ?'); parametros.push(origen); }
  if (texto) {
    condiciones.push('(m.descripcion LIKE ? COLLATE NOCASE OR c.nombre LIKE ? COLLATE NOCASE)');
    parametros.push(`%${texto}%`, `%${texto}%`);
  }

  return {
    where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '',
    parametros,
  };
}

export function listarMovimientos(filtros = {}) {
  const bd = obtenerBD();
  const { pagina = 1, porPagina = 50 } = filtros;
  const { where, parametros } = construirFiltro(filtros);

  const { total, ingresos, gastos } = bd
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.importe_centimos END), 0) AS ingresos,
              COALESCE(SUM(CASE WHEN m.tipo = 'gasto'   THEN m.importe_centimos END), 0) AS gastos
       FROM movimientos m LEFT JOIN categorias c ON c.id = m.categoria_id ${where}`
    )
    .get(...parametros);

  const filas = bd
    .prepare(`${SELECCION} ${where} ORDER BY m.fecha DESC, m.id DESC LIMIT ? OFFSET ?`)
    .all(...parametros, porPagina, (pagina - 1) * porPagina);

  return {
    movimientos: filas.map(mapear),
    total,
    pagina,
    porPagina,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
    totales: {
      ingresos: aEuros(ingresos),
      gastos: aEuros(gastos),
      balance: aEuros(ingresos - gastos),
    },
  };
}

export function obtenerMovimiento(id) {
  const bd = obtenerBD();
  const fila = bd.prepare(`${SELECCION} WHERE m.id = ?`).get(id);
  if (!fila) throw noEncontrado('Movimiento');
  return mapear(fila);
}

/** La categoría debe existir y su tipo debe coincidir con el del movimiento. */
function validarCategoria(categoriaId, tipo) {
  if (categoriaId === null || categoriaId === undefined) return null;

  const categoria = obtenerBD()
    .prepare('SELECT id, tipo, nombre FROM categorias WHERE id = ?')
    .get(categoriaId);
  if (!categoria) throw peticionInvalida('La categoría seleccionada no existe');
  if (categoria.tipo !== tipo) {
    throw peticionInvalida(
      `La categoría "${categoria.nombre}" es de tipo ${categoria.tipo} y el movimiento es de tipo ${tipo}`
    );
  }
  return categoria.id;
}

export function crearMovimiento(datos, { origen = 'manual', recurrenteId = null } = {}) {
  const bd = obtenerBD();
  const categoriaId = validarCategoria(datos.categoriaId ?? null, datos.tipo);

  const { lastInsertRowid } = bd
    .prepare(
      `INSERT INTO movimientos
         (fecha, importe_centimos, descripcion, tipo, categoria_id, recurrente_id, origen, cuenta_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      datos.fecha, aCentimos(datos.importe), datos.descripcion ?? '', datos.tipo,
      categoriaId, recurrenteId, origen, datos.cuentaId ?? cuentaPorDefecto()
    );

  return obtenerMovimiento(Number(lastInsertRowid));
}

/**
 * Vuelve a crear un movimiento tal y como estaba, para deshacer un borrado.
 *
 * No recupera el `id` original: es una fila nueva. Lo que importa conservar es
 * el origen y el vínculo con el gasto fijo, porque de ellos dependen la
 * idempotencia de los recibos y de dónde dice la aplicación que salió el dato.
 */
export function restaurarMovimiento({ origen, recurrenteId, ...datos }) {
  if (recurrenteId) {
    const existe = obtenerBD()
      .prepare('SELECT id FROM movimientos WHERE recurrente_id = ? AND fecha = ?')
      .get(recurrenteId, datos.fecha);
    if (existe) throw conflicto('Ese recibo ya se ha vuelto a generar: no hace falta recuperarlo');
  }

  return crearMovimiento(datos, { origen, recurrenteId: recurrenteId ?? null });
}

export function actualizarMovimiento(id, cambios) {
  const bd = obtenerBD();
  const actual = obtenerMovimiento(id);

  const tipo = cambios.tipo ?? actual.tipo;
  // Al cambiar de tipo, una categoría del tipo anterior deja de ser válida.
  const categoriaIdPedido =
    cambios.categoriaId !== undefined ? cambios.categoriaId : tipo === actual.tipo ? actual.categoriaId : null;

  const categoriaId = validarCategoria(categoriaIdPedido, tipo);

  bd.prepare(
    `UPDATE movimientos
     SET fecha = ?, importe_centimos = ?, descripcion = ?, tipo = ?, categoria_id = ?, cuenta_id = ?,
         actualizado_en = datetime('now')
     WHERE id = ?`
  ).run(
    cambios.fecha ?? actual.fecha,
    aCentimos(cambios.importe ?? actual.importe),
    cambios.descripcion ?? actual.descripcion,
    tipo,
    categoriaId,
    cambios.cuentaId !== undefined ? cambios.cuentaId : actual.cuentaId,
    id
  );

  return obtenerMovimiento(id);
}

export function borrarMovimiento(id) {
  const bd = obtenerBD();
  const { changes } = bd.prepare('DELETE FROM movimientos WHERE id = ?').run(id);
  if (changes === 0) throw noEncontrado('Movimiento');
  return { borrado: true };
}

/** Todos los movimientos que cumplen el filtro, sin paginar. Para exportación. */
export function listarTodosParaExportar(filtros = {}) {
  const { where, parametros } = construirFiltro(filtros);
  return obtenerBD()
    .prepare(`${SELECCION} ${where} ORDER BY m.fecha ASC, m.id ASC`)
    .all(...parametros)
    .map(mapear);
}
