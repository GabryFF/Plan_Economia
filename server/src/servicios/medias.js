import { obtenerBD } from '../db/conexion.js';
import { aEuros } from '../utiles/dinero.js';
import { primerDiaDelMes, ultimoDiaDelMes, ultimosMeses } from '../utiles/fechas.js';

const redondear = (n) => Math.round(n * 100) / 100;

/**
 * Medias mensuales sobre meses ya cerrados: el mes en curso está incompleto y
 * hundiría cualquier proyección.
 */
export function mediasMensuales(meses) {
  const bd = obtenerBD();
  const periodos = ultimosMeses(meses + 1).slice(0, -1);
  if (periodos.length === 0) return null;

  const desde = primerDiaDelMes(periodos[0].anio, periodos[0].mes);
  const hasta = ultimoDiaDelMes(periodos.at(-1).anio, periodos.at(-1).mes);

  const filas = bd
    .prepare(
      `SELECT strftime('%Y-%m', fecha) AS periodo,
              COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN importe_centimos END), 0) AS ingresos,
              COALESCE(SUM(CASE WHEN tipo = 'gasto'   THEN importe_centimos END), 0) AS gastos,
              COALESCE(SUM(CASE WHEN tipo = 'gasto' AND recurrente_id IS NOT NULL
                                THEN importe_centimos END), 0) AS gastos_fijos
       FROM movimientos
       WHERE fecha BETWEEN ? AND ?
       GROUP BY periodo
       HAVING ingresos > 0 OR gastos > 0`
    )
    .all(desde, hasta);

  if (filas.length === 0) return null;

  const media = (campo) => filas.reduce((suma, fila) => suma + fila[campo], 0) / filas.length;

  return {
    meses: filas.length,
    ingresos: redondear(aEuros(media('ingresos'))),
    gastos: redondear(aEuros(media('gastos'))),
    gastosFijos: redondear(aEuros(media('gastos_fijos'))),
    gastosVariables: redondear(aEuros(media('gastos') - media('gastos_fijos'))),
  };
}

/**
 * Ingreso mensual recurrente, medido como MEDIANA de los meses cerrados.
 *
 * Con 14 pagas, dos meses del año valen el doble y la media aritmética queda por
 * encima de lo que se cobra un mes normal: presupuestar sobre ella llevaría a
 * gastar de más los otros diez meses. La mediana ignora esos dos picos.
 */
export function medianaIngresosMensuales(meses = 12) {
  const bd = obtenerBD();
  const periodos = ultimosMeses(meses + 1).slice(0, -1);
  if (periodos.length === 0) return null;

  const desde = primerDiaDelMes(periodos[0].anio, periodos[0].mes);
  const hasta = ultimoDiaDelMes(periodos.at(-1).anio, periodos.at(-1).mes);

  const ingresos = bd
    .prepare(
      `SELECT COALESCE(SUM(importe_centimos), 0) AS total
       FROM movimientos
       WHERE tipo = 'ingreso' AND fecha BETWEEN ? AND ?
       GROUP BY strftime('%Y-%m', fecha)
       HAVING total > 0
       ORDER BY total`
    )
    .all(desde, hasta)
    .map((f) => f.total);

  if (ingresos.length === 0) return null;

  const centro = Math.floor(ingresos.length / 2);
  const mediana =
    ingresos.length % 2 === 0 ? (ingresos[centro - 1] + ingresos[centro]) / 2 : ingresos[centro];

  return { meses: ingresos.length, importe: redondear(aEuros(mediana)) };
}

/**
 * El mes en curso, con proyección a fin de mes.
 *
 * Las medias solo miran meses cerrados, y con razón: un mes a medias las
 * distorsiona. Pero el efecto secundario era que el usuario apuntaba gastos
 * durante treinta días sin ver reaccionar nada. Esto lo resuelve sin contaminar
 * las medias: se calcula aparte y se marca como provisional.
 *
 * La proyección NO extrapola el gasto fijo, porque ya se conoce entero desde el
 * día 1; solo extrapola el variable. Extrapolar los 250 € del alquiler el día 3
 * daría una previsión absurda de 2.500 €.
 */
export function mesEnCurso(referencia = new Date()) {
  const bd = obtenerBD();
  const anio = referencia.getFullYear();
  const mes = referencia.getMonth() + 1;

  const desde = primerDiaDelMes(anio, mes);
  const hasta = ultimoDiaDelMes(anio, mes);
  const diasDelMes = Number(hasta.slice(8));
  const diasTranscurridos = Math.min(referencia.getDate(), diasDelMes);

  const fila = bd
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN importe_centimos END), 0) AS ingresos,
              COALESCE(SUM(CASE WHEN tipo = 'gasto'   THEN importe_centimos END), 0) AS gastos,
              COALESCE(SUM(CASE WHEN tipo = 'gasto' AND recurrente_id IS NOT NULL
                                THEN importe_centimos END), 0) AS gastos_fijos,
              COUNT(CASE WHEN tipo = 'gasto' AND recurrente_id IS NULL THEN 1 END) AS movimientos_variables
       FROM movimientos WHERE fecha BETWEEN ? AND ?`
    )
    .get(desde, hasta);

  const gastos = redondear(aEuros(fila.gastos));
  const gastosFijos = redondear(aEuros(fila.gastos_fijos));
  const gastosVariables = redondear(gastos - gastosFijos);

  // Con menos de una semana transcurrida la extrapolación es ruido.
  const proyectable = diasTranscurridos >= 7 && fila.movimientos_variables > 0;
  const variablesProyectados = proyectable
    ? redondear((gastosVariables * diasDelMes) / diasTranscurridos)
    : gastosVariables;

  return {
    anio,
    mes,
    diasTranscurridos,
    diasDelMes,
    ingresos: redondear(aEuros(fila.ingresos)),
    gastos,
    gastosFijos,
    gastosVariables,
    movimientosVariables: fila.movimientos_variables,
    proyectable,
    // Los fijos ya se conocen enteros; solo se extrapola lo variable.
    gastoProyectado: redondear(gastosFijos + variablesProyectados),
  };
}

/** Meses cerrados que tienen algún gasto variable registrado. */
export function mesesCerradosConGastoVariable(meses = 6) {
  const bd = obtenerBD();
  const periodos = ultimosMeses(meses + 1).slice(0, -1);
  if (periodos.length === 0) return 0;

  const { total } = bd
    .prepare(
      `SELECT COUNT(DISTINCT strftime('%Y-%m', fecha)) AS total
       FROM movimientos
       WHERE tipo = 'gasto' AND recurrente_id IS NULL AND fecha BETWEEN ? AND ?`
    )
    .get(
      primerDiaDelMes(periodos[0].anio, periodos[0].mes),
      ultimoDiaDelMes(periodos.at(-1).anio, periodos.at(-1).mes)
    );

  return total;
}

/**
 * Ingreso mensual recurrente de referencia.
 *
 * Prioriza la nómina declarada como ingreso fijo por encima de la mediana del
 * histórico. Es deliberado: un presupuesto mira hacia delante, y la mediana de
 * doce meses tardaría medio año en reflejar una subida de sueldo. Si no hay
 * nómina declarada, se recurre al histórico.
 */
export function ingresoMensualRecurrente() {
  const bd = obtenerBD();
  const hoy = new Date().toISOString().slice(0, 10);

  const { total } = bd
    .prepare(
      `SELECT COALESCE(SUM(CAST(importe_centimos AS REAL) / periodicidad), 0) AS total
       FROM recurrentes
       WHERE activo = 1 AND tipo = 'ingreso'
         AND fecha_inicio <= ? AND (fecha_fin IS NULL OR fecha_fin >= ?)`
    )
    .get(hoy, hoy);

  if (total > 0) return { importe: redondear(aEuros(total)), origen: 'nomina-declarada' };

  const mediana = medianaIngresosMensuales(12);
  if (mediana && mediana.importe > 0) return { importe: mediana.importe, origen: 'mediana', meses: mediana.meses };

  return { importe: 0, origen: 'sin-datos' };
}
