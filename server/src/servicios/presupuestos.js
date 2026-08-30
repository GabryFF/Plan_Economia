import { enTransaccion, obtenerBD } from '../db/conexion.js';
import { aCentimos, aEuros } from '../utiles/dinero.js';
import { primerDiaDelMes, ultimoDiaDelMes } from '../utiles/fechas.js';
import { noEncontrado, peticionInvalida } from '../utiles/errores.js';
import { ingresoMensualRecurrente } from './medias.js';
import { obtenerAjustes } from './ajustes.js';
import { FUENTE_REFERENCIAS, perfilPara, referenciaDe } from './referencias.js';

/**
 * Presupuesto = tope de gasto de una categoría en un mes concreto.
 * El "consumido" se calcula al vuelo desde los movimientos, nunca se denormaliza.
 */

/**
 * Ingresos netos mensuales sobre los que calcular los porcentajes de referencia.
 *
 * Se usa la media de los meses ya cerrados; si aún no hay histórico, se recurre
 * a los ingresos fijos declarados (la nómina). Sin ninguno de los dos no hay
 * base sobre la que recomendar nada, y se devuelve 0.
 */
function ingresoMensualDeReferencia() {
  // Prioriza la nómina declarada (reacciona el mismo día a una subida) y cae a
  // la mediana del histórico si no la hay. Mediana y no media: con 14 pagas dos
  // meses valen el doble e inflarían el presupuesto de los otros diez.
  return ingresoMensualRecurrente();
}

export function listarPresupuestos({ anio, mes }) {
  const bd = obtenerBD();
  const desde = primerDiaDelMes(anio, mes);
  const hasta = ultimoDiaDelMes(anio, mes);
  const ingresoBase = ingresoMensualDeReferencia();
  const perfil = perfilPara(ingresoBase.importe);
  const { pagasAlAnio } = obtenerAjustes();

  const filas = bd
    .prepare(
      `SELECT c.id AS categoria_id, c.nombre, c.color, c.archivada,
              p.id AS presupuesto_id, p.importe_centimos AS presupuesto,
              COALESCE((SELECT SUM(m.importe_centimos) FROM movimientos m
                        WHERE m.categoria_id = c.id AND m.tipo = 'gasto'
                          AND m.fecha BETWEEN ? AND ?), 0) AS gastado
       FROM categorias c
       LEFT JOIN presupuestos p ON p.categoria_id = c.id AND p.anio = ? AND p.mes = ?
       WHERE c.tipo = 'gasto' AND (c.archivada = 0 OR p.id IS NOT NULL)
       ORDER BY c.nombre COLLATE NOCASE`
    )
    .all(desde, hasta, anio, mes);

  const presupuestos = filas.map((f) => {
    const presupuesto = f.presupuesto ?? null;
    const porcentaje = presupuesto ? Math.round((f.gastado / presupuesto) * 1000) / 10 : null;

    // Referencia orientativa: qué porcentaje de los ingresos suele destinarse a
    // esta partida. Solo existe para las categorías por defecto.
    const referencia = referenciaDe(f.nombre, perfil.referencias);
    const enEuros = (porcentajeReferencia) =>
      ingresoBase.importe > 0 ? Math.round(((ingresoBase.importe * porcentajeReferencia) / 100) * 100) / 100 : null;

    const recomendado = referencia
      ? {
          minPorcentaje: referencia.min,
          maxPorcentaje: referencia.max,
          mediaEspana: referencia.mediaEspana,
          nota: referencia.nota,
          min: enEuros(referencia.min),
          max: enEuros(referencia.max),
          // El punto medio es lo que se aplica al pulsar "usar recomendado".
          sugerido: enEuros((referencia.min + referencia.max) / 2),
        }
      : null;

    return {
      recomendado,
      categoriaId: f.categoria_id,
      categoriaNombre: f.nombre,
      categoriaColor: f.color,
      archivada: Boolean(f.archivada),
      presupuestoId: f.presupuesto_id,
      presupuesto: presupuesto === null ? null : aEuros(presupuesto),
      gastado: aEuros(f.gastado),
      restante: presupuesto === null ? null : aEuros(presupuesto - f.gastado),
      porcentaje,
      estado:
        presupuesto === null ? 'sin-presupuesto'
        : porcentaje > 100 ? 'excedido'
        : porcentaje >= 85 ? 'riesgo'
        : 'ok',
    };
  });

  const conPresupuesto = presupuestos.filter((p) => p.presupuesto !== null);
  const totalPresupuestado = conPresupuesto.reduce((s, p) => s + p.presupuesto, 0);
  const totalGastadoConPresupuesto = conPresupuesto.reduce((s, p) => s + p.gastado, 0);

  return {
    anio,
    mes,
    presupuestos,
    ingresoBase: {
      ...ingresoBase,
      pagasAlAnio,
      // Con 14 pagas el presupuesto se hace sobre el mes normal y las extras van aparte.
      anual: ingresoBase.importe > 0 ? Math.round(ingresoBase.importe * pagasAlAnio * 100) / 100 : 0,
      extrasAlAnio: pagasAlAnio > 12 ? Math.round(ingresoBase.importe * (pagasAlAnio - 12) * 100) / 100 : 0,
    },
    perfil: { clave: perfil.clave, etiqueta: perfil.etiqueta },
    fuenteReferencias: FUENTE_REFERENCIAS,
    totales: {
      presupuestado: Math.round(totalPresupuestado * 100) / 100,
      gastado: Math.round(totalGastadoConPresupuesto * 100) / 100,
      restante: Math.round((totalPresupuestado - totalGastadoConPresupuesto) * 100) / 100,
      categoriasExcedidas: conPresupuesto.filter((p) => p.estado === 'excedido').length,
    },
  };
}

/** Crea o actualiza el presupuesto de (categoría, año, mes). Importe 0 lo elimina. */
export function guardarPresupuesto({ categoriaId, anio, mes, importe }) {
  const bd = obtenerBD();
  const categoria = bd.prepare('SELECT id, tipo, nombre FROM categorias WHERE id = ?').get(categoriaId);
  if (!categoria) throw peticionInvalida('La categoría seleccionada no existe');
  if (categoria.tipo !== 'gasto') {
    throw peticionInvalida('Solo se pueden presupuestar categorías de gasto');
  }

  if (importe === 0) {
    bd.prepare('DELETE FROM presupuestos WHERE categoria_id = ? AND anio = ? AND mes = ?').run(categoriaId, anio, mes);
    return listarPresupuestos({ anio, mes });
  }

  bd.prepare(
    `INSERT INTO presupuestos (categoria_id, anio, mes, importe_centimos)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (categoria_id, anio, mes) DO UPDATE SET importe_centimos = excluded.importe_centimos`
  ).run(categoriaId, anio, mes, aCentimos(importe));

  return listarPresupuestos({ anio, mes });
}

export function borrarPresupuesto(id) {
  const { changes } = obtenerBD().prepare('DELETE FROM presupuestos WHERE id = ?').run(id);
  if (changes === 0) throw noEncontrado('Presupuesto');
  return { borrado: true };
}

/** Copia los presupuestos del mes anterior al indicado, sin pisar los ya definidos. */
export function copiarDelMesAnterior({ anio, mes }) {
  const bd = obtenerBD();
  const anioAnterior = mes === 1 ? anio - 1 : anio;
  const mesAnterior = mes === 1 ? 12 : mes - 1;

  return enTransaccion(() => {
    const { changes } = bd
      .prepare(
        `INSERT OR IGNORE INTO presupuestos (categoria_id, anio, mes, importe_centimos)
         SELECT categoria_id, ?, ?, importe_centimos FROM presupuestos WHERE anio = ? AND mes = ?`
      )
      .run(anio, mes, anioAnterior, mesAnterior);

    return { copiados: changes, ...listarPresupuestos({ anio, mes }) };
  });
}
