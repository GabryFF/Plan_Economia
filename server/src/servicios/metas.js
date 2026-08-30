import { enTransaccion, obtenerBD } from '../db/conexion.js';
import { aCentimos, aEuros } from '../utiles/dinero.js';
import { conflicto, noEncontrado, peticionInvalida } from '../utiles/errores.js';

/**
 * Objetivos de ahorro con nombre: un viaje, un coche, la entrada de un piso.
 *
 * POR QUÉ NO SON GASTOS FIJOS: apartar dinero no es gastarlo. Registrar
 * «vacaciones, 100 €/mes» como gasto hundiría la tasa de ahorro, inflaría el
 * fondo de emergencia (que se dimensiona sobre el gasto) y contaría dos veces
 * cuando llegue el viaje y se pague de verdad. El gasto se apunta cuando ocurre;
 * lo de antes es ahorro con destino.
 *
 * El fondo de emergencia NO vive aquí porque no es un importe fijo: se calcula
 * como N meses de tu gasto y cambia cuando cambia tu gasto.
 */

const mapear = (f) => {
  const objetivo = aEuros(f.objetivo_centimos);
  const ahorrado = aEuros(f.ahorrado_centimos);

  return {
    id: f.id,
    nombre: f.nombre,
    objetivo,
    ahorrado,
    restante: Math.round(Math.max(objetivo - ahorrado, 0) * 100) / 100,
    progreso: Math.min(Math.round((ahorrado / objetivo) * 1000) / 10, 100),
    fechaObjetivo: f.fecha_objetivo,
    prioridad: f.prioridad,
    clave: f.clave,
    notas: f.notas,
    completada: ahorrado >= objetivo,
  };
};

export function listarMetas() {
  return obtenerBD().prepare('SELECT * FROM metas ORDER BY prioridad, id').all().map(mapear);
}

export function obtenerMeta(id) {
  const fila = obtenerBD().prepare('SELECT * FROM metas WHERE id = ?').get(id);
  if (!fila) throw noEncontrado('Objetivo');
  return mapear(fila);
}

export function crearMeta({ nombre, objetivo, ahorrado = 0, fechaObjetivo = null, notas = '', clave = null }) {
  const bd = obtenerBD();

  const duplicada = bd.prepare('SELECT id FROM metas WHERE nombre = ? COLLATE NOCASE').get(nombre);
  if (duplicada) throw conflicto(`Ya tienes un objetivo llamado "${nombre}"`);
  if (ahorrado > objetivo) throw peticionInvalida('Lo ahorrado no puede superar al objetivo');

  const { p } = bd.prepare('SELECT COALESCE(MAX(prioridad), -1) + 1 AS p FROM metas').get();

  const { lastInsertRowid } = bd
    .prepare(
      `INSERT INTO metas (nombre, objetivo_centimos, ahorrado_centimos, fecha_objetivo, prioridad, clave, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(nombre, aCentimos(objetivo), aCentimos(ahorrado), fechaObjetivo, p, clave, notas);

  return obtenerMeta(Number(lastInsertRowid));
}

export function actualizarMeta(id, cambios) {
  const bd = obtenerBD();
  const actual = obtenerMeta(id);

  const nombre = cambios.nombre ?? actual.nombre;
  const duplicada = bd
    .prepare('SELECT id FROM metas WHERE nombre = ? COLLATE NOCASE AND id <> ?')
    .get(nombre, id);
  if (duplicada) throw conflicto(`Ya tienes un objetivo llamado "${nombre}"`);

  const objetivo = cambios.objetivo ?? actual.objetivo;
  const ahorrado = cambios.ahorrado ?? actual.ahorrado;
  if (objetivo <= 0) throw peticionInvalida('El objetivo tiene que ser mayor que 0');

  bd.prepare(
    `UPDATE metas SET nombre = ?, objetivo_centimos = ?, ahorrado_centimos = ?, fecha_objetivo = ?, notas = ?
     WHERE id = ?`
  ).run(
    nombre,
    aCentimos(objetivo),
    aCentimos(Math.max(ahorrado, 0)),
    cambios.fechaObjetivo !== undefined ? cambios.fechaObjetivo : actual.fechaObjetivo,
    cambios.notas ?? actual.notas,
    id
  );

  return obtenerMeta(id);
}

/** Suma (o resta, con importe negativo) una aportación a lo ya ahorrado. */
export function aportar(id, importe) {
  const actual = obtenerMeta(id);
  const nuevo = Math.max(actual.ahorrado + importe, 0);

  obtenerBD().prepare('UPDATE metas SET ahorrado_centimos = ? WHERE id = ?').run(aCentimos(nuevo), id);
  return obtenerMeta(id);
}

export function borrarMeta(id) {
  const { changes } = obtenerBD().prepare('DELETE FROM metas WHERE id = ?').run(id);
  if (changes === 0) throw noEncontrado('Objetivo');
  return { borrado: true };
}

/** Sube o baja un objetivo en el orden en que se van llenando. */
export function moverMeta(id, direccion) {
  const bd = obtenerBD();
  const metas = listarMetas();
  const posicion = metas.findIndex((m) => m.id === id);
  if (posicion === -1) throw noEncontrado('Objetivo');

  const destino = direccion === 'subir' ? posicion - 1 : posicion + 1;
  if (destino < 0 || destino >= metas.length) return listarMetas();

  return enTransaccion(() => {
    const reordenadas = [...metas];
    [reordenadas[posicion], reordenadas[destino]] = [reordenadas[destino], reordenadas[posicion]];

    const actualizar = bd.prepare('UPDATE metas SET prioridad = ? WHERE id = ?');
    reordenadas.forEach((meta, indice) => actualizar.run(indice, meta.id));

    return listarMetas();
  });
}

/**
 * Reparte el ahorro entre los objetivos y estima cuándo cae cada uno.
 *
 * El reparto es en CASCADA, no proporcional: se llena el primero y luego el
 * siguiente. Repartir a partes iguales entre cinco objetivos hace que no
 * termines ninguno en mucho tiempo, que es la forma más común de abandonarlos.
 *
 * `pendienteAntes` es lo que falta del colchón de imprevistos, que va por
 * delante de cualquier meta: sin él, un imprevisto obliga a vaciar una.
 */
export function planificarMetas({ aporteAnual, pendienteAntes = 0 }) {
  const metas = listarMetas();
  let acumulado = pendienteAntes;

  return metas.map((meta) => {
    acumulado += meta.restante;

    return {
      ...meta,
      // Meses hasta completarla contando con llenar antes lo que va por delante.
      mesesEstimados:
        meta.completada ? 0 : aporteAnual > 0 ? Math.ceil((acumulado / aporteAnual) * 12) : null,
      // Si tiene fecha límite, cuánto habría que apartar al mes para llegar.
      aporteMensualNecesario: calcularAporteNecesario(meta),
    };
  });
}

/** Con fecha objetivo, lo que hay que apartar cada mes para llegar a tiempo. */
function calcularAporteNecesario(meta) {
  if (!meta.fechaObjetivo || meta.completada) return null;

  const hoy = new Date();
  const limite = new Date(`${meta.fechaObjetivo}T00:00:00`);
  const meses = (limite.getFullYear() - hoy.getFullYear()) * 12 + (limite.getMonth() - hoy.getMonth());

  if (meses <= 0) return null;
  return Math.round((meta.restante / meses) * 100) / 100;
}
