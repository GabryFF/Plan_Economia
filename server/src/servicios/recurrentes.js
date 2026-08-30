import { enTransaccion, obtenerBD } from '../db/conexion.js';
import { aCentimos, aEuros } from '../utiles/dinero.js';
import { fechaDelMes, hoyISO } from '../utiles/fechas.js';
import { noEncontrado, peticionInvalida } from '../utiles/errores.js';
import { cuentaPorDefecto } from './movimientos.js';

/**
 * Gastos e ingresos fijos (nómina, alquiler, suscripciones...).
 *
 * Una plantilla recurrente no es un movimiento: es la regla que los genera.
 * `materializarPendientes` crea los movimientos reales que ya tocaban y es
 * idempotente gracias al índice único (recurrente_id, fecha).
 */

const SELECCION = `
  SELECT r.*, c.nombre AS categoria_nombre, c.color AS categoria_color
  FROM recurrentes r
  LEFT JOIN categorias c ON c.id = r.categoria_id`;

const mapear = (f) => ({
  id: f.id,
  nombre: f.nombre,
  importe: aEuros(f.importe_centimos),
  tipo: f.tipo,
  categoriaId: f.categoria_id,
  categoriaNombre: f.categoria_nombre,
  categoriaColor: f.categoria_color,
  diaDelMes: f.dia_del_mes,
  periodicidad: f.periodicidad,
  // Lo que cuesta al mes en términos comparables: un seguro anual de 600 € son
  // 50 € al mes, y así se puede sumar con el resto de fijos.
  costeMensual: Math.round((aEuros(f.importe_centimos) / f.periodicidad) * 100) / 100,
  fechaInicio: f.fecha_inicio,
  fechaFin: f.fecha_fin,
  activo: Boolean(f.activo),
  creadoEn: f.creado_en,
});

export function listarRecurrentes({ soloActivos = false } = {}) {
  return obtenerBD()
    .prepare(`${SELECCION} ${soloActivos ? 'WHERE r.activo = 1' : ''} ORDER BY r.tipo DESC, r.dia_del_mes, r.nombre`)
    .all()
    .map(mapear);
}

export function obtenerRecurrente(id) {
  const fila = obtenerBD().prepare(`${SELECCION} WHERE r.id = ?`).get(id);
  if (!fila) throw noEncontrado('Movimiento fijo');
  return mapear(fila);
}

function validarCategoria(categoriaId, tipo) {
  if (categoriaId === null || categoriaId === undefined) return null;
  const categoria = obtenerBD().prepare('SELECT id, tipo, nombre FROM categorias WHERE id = ?').get(categoriaId);
  if (!categoria) throw peticionInvalida('La categoría seleccionada no existe');
  if (categoria.tipo !== tipo) {
    throw peticionInvalida(`La categoría "${categoria.nombre}" es de tipo ${categoria.tipo}, no ${tipo}`);
  }
  return categoria.id;
}

export function crearRecurrente(datos) {
  const bd = obtenerBD();
  const categoriaId = validarCategoria(datos.categoriaId ?? null, datos.tipo);
  if (datos.fechaFin && datos.fechaFin < datos.fechaInicio) {
    throw peticionInvalida('La fecha de fin no puede ser anterior a la de inicio');
  }

  const { lastInsertRowid } = bd
    .prepare(
      `INSERT INTO recurrentes
         (nombre, importe_centimos, tipo, categoria_id, dia_del_mes, fecha_inicio, fecha_fin, activo, periodicidad)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      datos.nombre,
      aCentimos(datos.importe),
      datos.tipo,
      categoriaId,
      datos.diaDelMes,
      datos.fechaInicio,
      datos.fechaFin ?? null,
      datos.activo === false ? 0 : 1,
      datos.periodicidad ?? 1
    );

  return obtenerRecurrente(Number(lastInsertRowid));
}

export function actualizarRecurrente(id, cambios) {
  const bd = obtenerBD();
  const actual = obtenerRecurrente(id);
  const tipo = cambios.tipo ?? actual.tipo;
  const categoriaIdPedido =
    cambios.categoriaId !== undefined ? cambios.categoriaId : tipo === actual.tipo ? actual.categoriaId : null;
  const categoriaId = validarCategoria(categoriaIdPedido, tipo);

  const fechaInicio = cambios.fechaInicio ?? actual.fechaInicio;
  const fechaFin = cambios.fechaFin !== undefined ? cambios.fechaFin : actual.fechaFin;
  if (fechaFin && fechaFin < fechaInicio) {
    throw peticionInvalida('La fecha de fin no puede ser anterior a la de inicio');
  }

  bd.prepare(
    `UPDATE recurrentes
     SET nombre = ?, importe_centimos = ?, tipo = ?, categoria_id = ?, dia_del_mes = ?,
         fecha_inicio = ?, fecha_fin = ?, activo = ?, periodicidad = ?
     WHERE id = ?`
  ).run(
    cambios.nombre ?? actual.nombre,
    aCentimos(cambios.importe ?? actual.importe),
    tipo,
    categoriaId,
    cambios.diaDelMes ?? actual.diaDelMes,
    fechaInicio,
    fechaFin ?? null,
    (cambios.activo ?? actual.activo) ? 1 : 0,
    cambios.periodicidad ?? actual.periodicidad,
    id
  );

  return obtenerRecurrente(id);
}

/**
 * Borra la plantilla. Los movimientos ya generados se conservan (quedan como
 * histórico real) salvo que se pida borrarlos también.
 */
export function borrarRecurrente(id, { borrarGenerados = false } = {}) {
  const bd = obtenerBD();
  obtenerRecurrente(id);

  return enTransaccion(() => {
    let generadosBorrados = 0;
    if (borrarGenerados) {
      generadosBorrados = bd.prepare('DELETE FROM movimientos WHERE recurrente_id = ?').run(id).changes;
    }
    bd.prepare('DELETE FROM recurrentes WHERE id = ?').run(id);
    return { borrado: true, generadosBorrados };
  });
}

/** Fechas en las que un recurrente debía generar movimiento entre su inicio y `hasta`. */
function fechasPrevistas(recurrente, hasta) {
  const fechas = [];
  const inicio = new Date(`${recurrente.fecha_inicio}T00:00:00`);
  const limite = new Date(`${(recurrente.fecha_fin && recurrente.fecha_fin < hasta ? recurrente.fecha_fin : hasta)}T00:00:00`);

  const paso = Math.max(recurrente.periodicidad ?? 1, 1);
  let anio = inicio.getFullYear();
  let mes = inicio.getMonth() + 1;

  while (true) {
    const fecha = fechaDelMes(anio, mes, recurrente.dia_del_mes);
    const fechaDate = new Date(`${fecha}T00:00:00`);
    if (fechaDate > limite) break;
    if (fecha >= recurrente.fecha_inicio) fechas.push(fecha);

    // Con periodicidad 12 se salta un año entero: es un seguro o una ITV.
    mes += paso;
    while (mes > 12) { mes -= 12; anio += 1; }
    if (fechas.length > 1200) break; // cinturón de seguridad (100 años)
  }

  return fechas;
}

/**
 * Genera los movimientos pendientes de todos los recurrentes activos hasta hoy.
 * Se ejecuta al arrancar y bajo demanda desde la UI. Idempotente.
 */
export function materializarPendientes({ hasta = hoyISO() } = {}) {
  const bd = obtenerBD();
  const activos = bd.prepare('SELECT * FROM recurrentes WHERE activo = 1').all();

  return enTransaccion(() => {
    // Los recibos van a la cuenta por defecto igual que un alta manual. Sin
    // esto quedaban con cuenta_id NULL y el saldo de la cuenta ignoraba la
    // nómina y los fijos, que son la mayor parte del dinero que se mueve.
    const cuenta = cuentaPorDefecto();

    const insertar = bd.prepare(
      `INSERT OR IGNORE INTO movimientos
         (fecha, importe_centimos, descripcion, tipo, categoria_id, recurrente_id, origen, cuenta_id)
       VALUES (?, ?, ?, ?, ?, ?, 'recurrente', ?)`
    );

    let creados = 0;
    for (const recurrente of activos) {
      for (const fecha of fechasPrevistas(recurrente, hasta)) {
        const { changes } = insertar.run(
          fecha,
          recurrente.importe_centimos,
          recurrente.nombre,
          recurrente.tipo,
          recurrente.categoria_id,
          recurrente.id,
          cuenta
        );
        creados += changes;
      }
    }
    return { creados };
  });
}

/** Compromisos mensuales fijos: lo que entra y lo que sale sí o sí cada mes. */
export function resumenMensualFijos() {
  const hoy = hoyISO();
  // Se divide entre la periodicidad para obtener el coste mensual equivalente:
  // un seguro de 720 € al año pesa 60 € en el presupuesto de cada mes.
  const filas = obtenerBD()
    .prepare(
      `SELECT tipo, COALESCE(SUM(CAST(importe_centimos AS REAL) / periodicidad), 0) AS total
       FROM recurrentes
       WHERE activo = 1 AND fecha_inicio <= ? AND (fecha_fin IS NULL OR fecha_fin >= ?)
       GROUP BY tipo`
    )
    .all(hoy, hoy);

  const porTipo = Object.fromEntries(filas.map((f) => [f.tipo, f.total]));
  const ingresos = porTipo.ingreso ?? 0;
  const gastos = porTipo.gasto ?? 0;

  return {
    ingresosFijos: aEuros(ingresos),
    gastosFijos: aEuros(gastos),
    margenFijo: aEuros(ingresos - gastos),
    // Qué porcentaje de los ingresos fijos se come el gasto fijo. Lo consumen
    // tanto el panel de ahorro como las recomendaciones: se calcula aquí una vez.
    pesoSobreIngresos: ingresos > 0 ? Math.round((gastos / ingresos) * 1000) / 10 : null,
  };
}
