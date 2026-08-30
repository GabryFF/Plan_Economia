import { obtenerBD } from '../db/conexion.js';
import { aEuros } from '../utiles/dinero.js';
import { primerDiaDelMes, ultimoDiaDelMes, ultimosMeses } from '../utiles/fechas.js';
import { construirFiltro } from './movimientos.js';
import { resumenMensualFijos } from './recurrentes.js';

const redondear = (n) => Math.round(n * 100) / 100;

/** Balance, totales y desglose por categoría del rango indicado. */
export function resumenGeneral(filtros = {}) {
  const bd = obtenerBD();
  const { where, parametros } = construirFiltro(filtros);

  const totales = bd
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.importe_centimos END), 0) AS ingresos,
              COALESCE(SUM(CASE WHEN m.tipo = 'gasto'   THEN m.importe_centimos END), 0) AS gastos,
              COUNT(*) AS movimientos
       FROM movimientos m LEFT JOIN categorias c ON c.id = m.categoria_id ${where}`
    )
    .get(...parametros);

  const porCategoria = bd
    .prepare(
      `SELECT m.tipo,
              COALESCE(c.id, 0)            AS categoria_id,
              COALESCE(c.nombre, 'Sin categoría') AS nombre,
              COALESCE(c.color, '#94a3b8') AS color,
              SUM(m.importe_centimos)      AS total,
              COUNT(*)                     AS movimientos
       FROM movimientos m LEFT JOIN categorias c ON c.id = m.categoria_id ${where}
       GROUP BY m.tipo, c.id
       ORDER BY total DESC`
    )
    .all(...parametros);

  const construirDesglose = (tipo, totalTipo) =>
    porCategoria
      .filter((f) => f.tipo === tipo)
      .map((f) => ({
        categoriaId: f.categoria_id || null,
        nombre: f.nombre,
        color: f.color,
        total: aEuros(f.total),
        movimientos: f.movimientos,
        porcentaje: totalTipo ? Math.round((f.total / totalTipo) * 1000) / 10 : 0,
      }));

  return {
    ingresos: aEuros(totales.ingresos),
    gastos: aEuros(totales.gastos),
    balance: aEuros(totales.ingresos - totales.gastos),
    movimientos: totales.movimientos,
    tasaAhorro: totales.ingresos
      ? Math.round(((totales.ingresos - totales.gastos) / totales.ingresos) * 1000) / 10
      : null,
    gastosPorCategoria: construirDesglose('gasto', totales.gastos),
    ingresosPorCategoria: construirDesglose('ingreso', totales.ingresos),
  };
}

/** Serie mensual de ingresos/gastos/balance para el gráfico de líneas. */
export function evolucionMensual({ meses = 12 } = {}) {
  const bd = obtenerBD();
  const periodos = ultimosMeses(meses);
  const desde = primerDiaDelMes(periodos[0].anio, periodos[0].mes);
  const hasta = ultimoDiaDelMes(periodos.at(-1).anio, periodos.at(-1).mes);

  const filas = bd
    .prepare(
      `SELECT strftime('%Y-%m', fecha) AS periodo,
              COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN importe_centimos END), 0) AS ingresos,
              COALESCE(SUM(CASE WHEN tipo = 'gasto'   THEN importe_centimos END), 0) AS gastos
       FROM movimientos
       WHERE fecha BETWEEN ? AND ?
       GROUP BY periodo`
    )
    .all(desde, hasta);

  const porPeriodo = new Map(filas.map((f) => [f.periodo, f]));

  // Se rellenan los meses sin movimientos para que la línea no tenga huecos.
  return periodos.map(({ anio, mes }) => {
    const clave = `${anio}-${String(mes).padStart(2, '0')}`;
    const fila = porPeriodo.get(clave) ?? { ingresos: 0, gastos: 0 };
    return {
      periodo: clave,
      anio,
      mes,
      etiqueta: new Date(anio, mes - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
      ingresos: aEuros(fila.ingresos),
      gastos: aEuros(fila.gastos),
      balance: aEuros(fila.ingresos - fila.gastos),
    };
  });
}

/**
 * Panel de ahorro: cuánto queda cada mes, qué parte del gasto está
 * comprometida en fijos y qué margen real hay para recortar.
 */
export function panelAhorro({ meses = 6 } = {}) {
  const bd = obtenerBD();
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = ahora.getMonth() + 1;

  const mesActual = resumenGeneral({
    desde: primerDiaDelMes(anio, mes),
    hasta: ultimoDiaDelMes(anio, mes),
  });

  const historico = evolucionMensual({ meses: meses + 1 }).slice(0, -1); // se excluye el mes en curso, incompleto
  const conDatos = historico.filter((m) => m.ingresos > 0 || m.gastos > 0);

  const media = (campo) =>
    conDatos.length ? redondear(conDatos.reduce((s, m) => s + m[campo], 0) / conDatos.length) : 0;

  const mediaIngresos = media('ingresos');
  const mediaGastos = media('gastos');
  const mediaAhorro = redondear(mediaIngresos - mediaGastos);

  // Fijo vs. variable en el mes en curso, según el origen del movimiento.
  const reparto = bd
    .prepare(
      `SELECT CASE WHEN recurrente_id IS NULL THEN 'variable' ELSE 'fijo' END AS clase,
              COALESCE(SUM(importe_centimos), 0) AS total
       FROM movimientos
       WHERE tipo = 'gasto' AND fecha BETWEEN ? AND ?
       GROUP BY clase`
    )
    .all(primerDiaDelMes(anio, mes), ultimoDiaDelMes(anio, mes));

  const porClase = Object.fromEntries(reparto.map((f) => [f.clase, aEuros(f.total)]));
  const gastoFijo = porClase.fijo ?? 0;
  const gastoVariable = porClase.variable ?? 0;

  const fijos = resumenMensualFijos();

  // Los mayores gastos fijos: la palanca de ahorro con más recorrido.
  const mayoresFijos = bd
    .prepare(
      `SELECT r.nombre, r.importe_centimos, c.nombre AS categoria, c.color
       FROM recurrentes r LEFT JOIN categorias c ON c.id = r.categoria_id
       WHERE r.activo = 1 AND r.tipo = 'gasto'
       ORDER BY r.importe_centimos DESC LIMIT 5`
    )
    .all()
    .map((f) => ({
      nombre: f.nombre,
      importe: aEuros(f.importe_centimos),
      categoria: f.categoria,
      color: f.color ?? '#94a3b8',
      porcentajeIngresosFijos: fijos.ingresosFijos
        ? Math.round((aEuros(f.importe_centimos) / fijos.ingresosFijos) * 1000) / 10
        : null,
    }));

  return {
    anio,
    mes,
    mesActual: {
      ingresos: mesActual.ingresos,
      gastos: mesActual.gastos,
      ahorro: mesActual.balance,
      tasaAhorro: mesActual.tasaAhorro,
      gastoFijo,
      gastoVariable,
    },
    mediaMensual: {
      meses: conDatos.length,
      ingresos: mediaIngresos,
      gastos: mediaGastos,
      ahorro: mediaAhorro,
      tasaAhorro: mediaIngresos ? Math.round((mediaAhorro / mediaIngresos) * 1000) / 10 : null,
    },
    compromisosFijos: {
      ...fijos,
      mayores: mayoresFijos,
    },
    proyeccionAnual: redondear(mediaAhorro * 12),
  };
}
