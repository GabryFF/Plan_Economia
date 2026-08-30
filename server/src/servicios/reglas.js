import { enTransaccion, obtenerBD } from '../db/conexion.js';
import { conflicto, noEncontrado, peticionInvalida } from '../utiles/errores.js';
import { normalizar } from '../utiles/texto.js';
import { CATALOGO_REGLAS_ES } from './referencias.js';

/**
 * Reglas de autocategorización.
 *
 * Traducen el concepto que escribe el banco ("PAGO TARJETA MERCADONA 4471") en
 * una categoría. Se evalúan en orden de `prioridad` y gana la primera que casa,
 * igual que una lista de ACLs: así el usuario puede poner una regla específica
 * por delante de otra genérica.
 *
 * La coincidencia es por texto normalizado, no por expresión regular: cubre
 * todos los casos reales de un extracto bancario sin que un patrón mal escrito
 * pueda colgar el proceso con backtracking catastrófico.
 */

const SELECCION = `
  SELECT r.*, c.nombre AS categoria_nombre, c.color AS categoria_color, c.tipo AS categoria_tipo
  FROM reglas r
  JOIN categorias c ON c.id = r.categoria_id`;

const mapear = (f) => ({
  id: f.id,
  patron: f.patron,
  coincidencia: f.coincidencia,
  categoriaId: f.categoria_id,
  categoriaNombre: f.categoria_nombre,
  categoriaColor: f.categoria_color,
  categoriaTipo: f.categoria_tipo,
  prioridad: f.prioridad,
  activa: Boolean(f.activa),
});

export function listarReglas() {
  return obtenerBD().prepare(`${SELECCION} ORDER BY r.prioridad, r.id`).all().map(mapear);
}

export function obtenerRegla(id) {
  const fila = obtenerBD().prepare(`${SELECCION} WHERE r.id = ?`).get(id);
  if (!fila) throw noEncontrado('Regla');
  return mapear(fila);
}

function comprobarCategoria(categoriaId) {
  const categoria = obtenerBD().prepare('SELECT id FROM categorias WHERE id = ?').get(categoriaId);
  if (!categoria) throw peticionInvalida('La categoría seleccionada no existe');
}

export function crearRegla({ patron, coincidencia = 'contiene', categoriaId, prioridad, activa = true }) {
  const bd = obtenerBD();
  comprobarCategoria(categoriaId);

  const patronLimpio = patron.trim();
  if (!normalizar(patronLimpio)) throw peticionInvalida('El patrón no puede estar vacío');

  const duplicada = bd
    .prepare('SELECT id FROM reglas WHERE patron = ? COLLATE NOCASE AND coincidencia = ? AND categoria_id = ?')
    .get(patronLimpio, coincidencia, categoriaId);
  if (duplicada) throw conflicto(`Ya existe una regla idéntica para "${patronLimpio}"`);

  // Sin prioridad explícita, la nueva regla va al final de la lista.
  const siguiente =
    prioridad ?? (bd.prepare('SELECT COALESCE(MAX(prioridad), -1) + 1 AS p FROM reglas').get().p);

  const { lastInsertRowid } = bd
    .prepare('INSERT INTO reglas (patron, coincidencia, categoria_id, prioridad, activa) VALUES (?, ?, ?, ?, ?)')
    .run(patronLimpio, coincidencia, categoriaId, siguiente, activa ? 1 : 0);

  return obtenerRegla(Number(lastInsertRowid));
}

export function actualizarRegla(id, cambios) {
  const bd = obtenerBD();
  const actual = obtenerRegla(id);
  if (cambios.categoriaId !== undefined) comprobarCategoria(cambios.categoriaId);

  const patron = (cambios.patron ?? actual.patron).trim();
  if (!normalizar(patron)) throw peticionInvalida('El patrón no puede estar vacío');

  bd.prepare(
    'UPDATE reglas SET patron = ?, coincidencia = ?, categoria_id = ?, prioridad = ?, activa = ? WHERE id = ?'
  ).run(
    patron,
    cambios.coincidencia ?? actual.coincidencia,
    cambios.categoriaId ?? actual.categoriaId,
    cambios.prioridad ?? actual.prioridad,
    (cambios.activa ?? actual.activa) ? 1 : 0,
    id
  );

  return obtenerRegla(id);
}

export function borrarRegla(id) {
  const { changes } = obtenerBD().prepare('DELETE FROM reglas WHERE id = ?').run(id);
  if (changes === 0) throw noEncontrado('Regla');
  return { borrada: true };
}

/** Sube o baja una regla en el orden de evaluación intercambiándola con su vecina. */
export function moverRegla(id, direccion) {
  const bd = obtenerBD();
  const reglas = listarReglas();
  const posicion = reglas.findIndex((r) => r.id === id);
  if (posicion === -1) throw noEncontrado('Regla');

  const destino = direccion === 'subir' ? posicion - 1 : posicion + 1;
  if (destino < 0 || destino >= reglas.length) return listarReglas();

  return enTransaccion(() => {
    // Se reescribe el orden completo: así queda normalizado (0, 1, 2…) aunque
    // las prioridades vinieran repetidas o con huecos.
    const reordenadas = [...reglas];
    [reordenadas[posicion], reordenadas[destino]] = [reordenadas[destino], reordenadas[posicion]];

    const actualizar = bd.prepare('UPDATE reglas SET prioridad = ? WHERE id = ?');
    reordenadas.forEach((regla, indice) => actualizar.run(indice, regla.id));

    return listarReglas();
  });
}

function casa(textoNormalizado, regla) {
  const patron = normalizar(regla.patron);
  if (!patron) return false;

  switch (regla.coincidencia) {
    case 'empieza': return textoNormalizado.startsWith(patron);
    case 'termina': return textoNormalizado.endsWith(patron);
    case 'exacto': return textoNormalizado === patron;
    default: return textoNormalizado.includes(patron);
  }
}

/**
 * Busca la primera regla activa que case con la descripción.
 *
 * `tipo` es obligatorio: una regla que apunta a una categoría de gasto no puede
 * clasificar un ingreso, aunque el texto coincida (una devolución de MERCADONA
 * no es un gasto de alimentación).
 */
export function categorizar(descripcion, tipo, reglas = null) {
  const texto = normalizar(descripcion);
  if (!texto) return null;

  const candidatas = reglas ?? listarReglas();

  for (const regla of candidatas) {
    if (!regla.activa || regla.categoriaTipo !== tipo) continue;
    if (casa(texto, regla)) {
      return {
        categoriaId: regla.categoriaId,
        categoriaNombre: regla.categoriaNombre,
        categoriaColor: regla.categoriaColor,
        reglaId: regla.id,
        patron: regla.patron,
      };
    }
  }

  return null;
}

/**
 * Categoriza un lote de filas de una importación. Se cargan las reglas una sola
 * vez para no repetir la consulta por fila.
 */
export function sugerirParaFilas(filas) {
  const reglas = listarReglas();
  return filas.map((fila) => categorizar(fila.descripcion, fila.tipo, reglas));
}

/** Prueba un texto contra las reglas actuales, para el probador de la interfaz. */
export function probar(texto, tipo) {
  return categorizar(texto, tipo);
}

/**
 * Aplica las reglas a los movimientos que ya están guardados sin categoría.
 * Útil tras crear una regla nueva: recupera el histórico sin reimportar nada.
 */
export function aplicarAExistentes() {
  const bd = obtenerBD();
  const reglas = listarReglas();
  if (reglas.length === 0) return { revisados: 0, actualizados: 0, porCategoria: [] };

  const pendientes = bd
    .prepare('SELECT id, descripcion, tipo FROM movimientos WHERE categoria_id IS NULL')
    .all();

  return enTransaccion(() => {
    const actualizar = bd.prepare(
      "UPDATE movimientos SET categoria_id = ?, actualizado_en = datetime('now') WHERE id = ?"
    );

    const conteo = new Map();
    let actualizados = 0;

    for (const movimiento of pendientes) {
      const encontrada = categorizar(movimiento.descripcion, movimiento.tipo, reglas);
      if (!encontrada) continue;

      actualizar.run(encontrada.categoriaId, movimiento.id);
      conteo.set(encontrada.categoriaNombre, (conteo.get(encontrada.categoriaNombre) ?? 0) + 1);
      actualizados += 1;
    }

    return {
      revisados: pendientes.length,
      actualizados,
      porCategoria: [...conteo].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total),
    };
  });
}

/**
 * Inserta el catálogo de reglas típicas de España.
 *
 * Es idempotente: omite las que ya existan (mismo patrón y categoría) y las que
 * apunten a una categoría que el usuario haya borrado o renombrado. El orden del
 * catálogo se respeta, y las nuevas se añaden detrás de las que ya hubiera.
 */
export function cargarCatalogoTipico() {
  const bd = obtenerBD();

  return enTransaccion(() => {
    const categoriasPorNombre = new Map(
      bd.prepare('SELECT id, nombre FROM categorias').all().map((c) => [normalizar(c.nombre), c.id])
    );

    const existentes = new Set(
      bd
        .prepare('SELECT patron, categoria_id FROM reglas')
        .all()
        .map((r) => `${normalizar(r.patron)}|${r.categoria_id}`)
    );

    let prioridad = bd.prepare('SELECT COALESCE(MAX(prioridad), -1) + 1 AS p FROM reglas').get().p;
    const insertar = bd.prepare(
      'INSERT INTO reglas (patron, coincidencia, categoria_id, prioridad, activa) VALUES (?, ?, ?, ?, 1)'
    );

    let creadas = 0;
    let yaExistian = 0;
    const categoriasQueFaltan = new Set();

    for (const entrada of CATALOGO_REGLAS_ES) {
      const categoriaId = categoriasPorNombre.get(normalizar(entrada.categoria));
      if (!categoriaId) {
        categoriasQueFaltan.add(entrada.categoria);
        continue;
      }

      const clave = `${normalizar(entrada.patron)}|${categoriaId}`;
      if (existentes.has(clave)) {
        yaExistian += 1;
        continue;
      }

      insertar.run(entrada.patron, entrada.coincidencia ?? 'contiene', categoriaId, prioridad);
      existentes.add(clave);
      prioridad += 1;
      creadas += 1;
    }

    return {
      creadas,
      yaExistian,
      categoriasQueFaltan: [...categoriasQueFaltan],
      total: CATALOGO_REGLAS_ES.length,
      reglas: listarReglas(),
    };
  });
}
