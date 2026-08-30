import { obtenerBD } from '../db/conexion.js';
import { aCentimos, aEuros } from '../utiles/dinero.js';
import { peticionInvalida } from '../utiles/errores.js';
import { obtenerAjustes } from './ajustes.js';
import {
  calcularSuministros, FUENTES_OFICIALES, GASTOS_DEDUCIBLES, LIMITES, OBLIGACIONES,
  REQUISITOS_DEDUCIBILIDAD, TRADE,
} from '../datos/fiscal-espana.js';

/**
 * Modo autónomo (España).
 *
 * La idea central, y la que de verdad salva a un autónomo: **el IVA que cobras
 * no es tuyo**. Lo tienes en depósito para Hacienda y hay que devolverlo cada
 * trimestre. Gastarlo y encontrarse el modelo 303 sin fondos es el error más
 * común y más caro del oficio. Por eso la sección se organiza alrededor de la
 * provisión, no del beneficio.
 *
 * Lo que NO hace esto: presentar modelos, calcular tu declaración ni sustituir a
 * una gestoría. Es una previsión de tesorería sobre tus propios datos.
 */

/**
 * Referencias de la cuota de autónomos (RETA) para 2026.
 *
 * OJO: las cuotas de 2026 se prorrogaron y son las mismas que en 2025, pero las
 * fuentes consultadas NO coinciden en los extremos (se publican 200 y 230 €/mes
 * de mínima, y 590 y 604,8 € de máxima). Por eso la aplicación no incluye la
 * tabla de los 15 tramos: la cuota la introduce el usuario, que la conoce
 * exactamente porque se la cobran cada mes. Estos valores son solo contexto.
 */
export const REFERENCIA_CUOTA = {
  fechaConsulta: '2026-08-30',
  tarifaPlana: 80,
  tarifaPlanaMeses: 12,
  tarifaPlanaNota:
    'Primeros 12 meses de alta, prorrogables otros 12 si los rendimientos quedan por debajo del SMI.',
  tramos: 15,
  tablaReducidaHasta: 1700,
  cuotaMinimaAproximada: 200,
  cuotaMaximaAproximada: 590,
  aviso:
    'Las fuentes públicas discrepan en los extremos de la tabla (200-230 € de mínima, 590-604,8 € de máxima). ' +
    'La tabla oficial es la de la Seguridad Social: introduce aquí la cuota que te cobran realmente.',
  deduccionGastosGenericos: 7,
};

/** Tipos habituales. El usuario puede cambiarlos en su configuración. */
export const TIPOS_HABITUALES = {
  ivaGeneral: 21,
  irpfGeneral: 15,
  irpfNuevoAutonomo: 7,
  irpfNuevoAutonomoAnios: 3,
  pagoFraccionado: 20,
};

/** Modelos trimestrales y sus plazos de presentación. */
export const CALENDARIO = [
  { trimestre: 1, periodo: 'enero a marzo', presentacion: 'del 1 al 20 de abril' },
  { trimestre: 2, periodo: 'abril a junio', presentacion: 'del 1 al 20 de julio' },
  { trimestre: 3, periodo: 'julio a septiembre', presentacion: 'del 1 al 20 de octubre' },
  { trimestre: 4, periodo: 'octubre a diciembre', presentacion: 'del 1 al 20 de enero' },
];

export const MODELOS = [
  { modelo: '303', que: 'IVA trimestral', quien: 'Todo autónomo con actividad sujeta a IVA.' },
  {
    modelo: '130',
    que: 'Pago fraccionado del IRPF (20 % del rendimiento neto acumulado)',
    quien: 'Quien NO factura mayoritariamente con retención. Si más del 70 % de tus facturas llevan retención, no lo presentas.',
  },
  { modelo: '390', que: 'Resumen anual de IVA', quien: 'En enero, junto al 303 del cuarto trimestre.' },
  { modelo: '100', que: 'Declaración de la renta', quien: 'De abril a junio del año siguiente.' },
];

const redondear = (n) => Math.round(n * 100) / 100;

const rangoTrimestre = (anio, trimestre) => {
  const primerMes = (trimestre - 1) * 3 + 1;
  const ultimoMes = primerMes + 2;
  const ultimoDia = new Date(anio, ultimoMes, 0).getDate();

  return {
    desde: `${anio}-${String(primerMes).padStart(2, '0')}-01`,
    hasta: `${anio}-${String(ultimoMes).padStart(2, '0')}-${ultimoDia}`,
  };
};

export function configuracion() {
  const ajustes = obtenerAjustes();

  return {
    activo: Boolean(ajustes.modoAutonomo),
    cuota: ajustes.autonomoCuota ?? 0,
    tipoIva: ajustes.autonomoTipoIva ?? TIPOS_HABITUALES.ivaGeneral,
    tipoIrpf: ajustes.autonomoTipoIrpf ?? TIPOS_HABITUALES.irpfGeneral,
    referencia: REFERENCIA_CUOTA,
    tipos: TIPOS_HABITUALES,
  };
}

/**
 * Registra una factura emitida o recibida.
 *
 * Se guarda como movimiento normal (para que cuente en el resto de la
 * aplicación) más el desglose fiscal. `importe` es lo que se mueve en el banco:
 * en una factura emitida, base + IVA − retención.
 */
export function registrarFactura({ fecha, base, tipoIva, tipoIrpf = 0, descripcion = '', tipo, categoriaId = null, cliente = null }) {
  if (base <= 0) throw peticionInvalida('La base imponible debe ser mayor que 0');

  const bd = obtenerBD();
  const iva = redondear((base * tipoIva) / 100);
  const irpf = tipo === 'ingreso' ? redondear((base * tipoIrpf) / 100) : 0;

  // Lo que realmente entra o sale de la cuenta.
  const importe = tipo === 'ingreso' ? redondear(base + iva - irpf) : redondear(base + iva);

  const { lastInsertRowid } = bd
    .prepare(
      `INSERT INTO movimientos
         (fecha, importe_centimos, descripcion, tipo, categoria_id, origen,
          base_centimos, iva_centimos, irpf_centimos, cliente)
       VALUES (?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?)`
    )
    .run(
      fecha, aCentimos(importe), descripcion, tipo, categoriaId,
      aCentimos(base), aCentimos(iva), aCentimos(irpf), cliente?.trim() || null
    );

  return { id: Number(lastInsertRowid), base, iva, irpf, importe, cliente: cliente?.trim() || null };
}

/**
 * Resumen fiscal de un trimestre y provisión recomendada.
 *
 * El IVA a ingresar es repercutido menos soportado. El IRPF ya retenido en las
 * facturas es un adelanto: si supera lo que tocaría por pago fraccionado, no hay
 * que provisionar más por ese concepto.
 */
export function resumenTrimestre({ anio, trimestre }) {
  const bd = obtenerBD();
  const { desde, hasta } = rangoTrimestre(anio, trimestre);
  const config = configuracion();

  const fila = bd
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN base_centimos END), 0) AS base_ingresos,
         COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN iva_centimos  END), 0) AS iva_repercutido,
         COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN irpf_centimos END), 0) AS irpf_retenido,
         COALESCE(SUM(CASE WHEN tipo = 'gasto'   THEN base_centimos END), 0) AS base_gastos,
         COALESCE(SUM(CASE WHEN tipo = 'gasto'   THEN iva_centimos  END), 0) AS iva_soportado,
         COUNT(*) AS facturas
       FROM movimientos
       WHERE base_centimos IS NOT NULL AND fecha BETWEEN ? AND ?`
    )
    .get(desde, hasta);

  const baseIngresos = redondear(aEuros(fila.base_ingresos));
  const baseGastos = redondear(aEuros(fila.base_gastos));
  const ivaRepercutido = redondear(aEuros(fila.iva_repercutido));
  const ivaSoportado = redondear(aEuros(fila.iva_soportado));
  const irpfRetenido = redondear(aEuros(fila.irpf_retenido));

  const ivaAIngresar = redondear(ivaRepercutido - ivaSoportado);
  const rendimientoNeto = redondear(baseIngresos - baseGastos);

  // Pago fraccionado del modelo 130: 20 % del rendimiento neto, descontando lo
  // ya retenido en factura. Solo aplica a quien no factura con retención.
  const pagoFraccionadoBruto = redondear((Math.max(rendimientoNeto, 0) * TIPOS_HABITUALES.pagoFraccionado) / 100);
  const pagoFraccionado = redondear(Math.max(pagoFraccionadoBruto - irpfRetenido, 0));

  const cuotaTrimestre = redondear(config.cuota * 3);

  return {
    anio,
    trimestre,
    desde,
    hasta,
    facturas: fila.facturas,
    ingresos: { base: baseIngresos, iva: ivaRepercutido, irpfRetenido },
    gastos: { base: baseGastos, iva: ivaSoportado },
    rendimientoNeto,
    iva: {
      repercutido: ivaRepercutido,
      soportado: ivaSoportado,
      aIngresar: ivaAIngresar,
      // Un resultado negativo no se paga: se compensa en los trimestres siguientes.
      aCompensar: ivaAIngresar < 0 ? Math.abs(ivaAIngresar) : 0,
    },
    irpf: {
      retenidoEnFactura: irpfRetenido,
      pagoFraccionadoEstimado: pagoFraccionado,
      nota: 'El modelo 130 no se presenta si más del 70 % de tus ingresos ya llevan retención.',
    },
    cuotaAutonomos: { mensual: config.cuota, trimestre: cuotaTrimestre },
    // Lo que hay que tener guardado y NO gastar.
    provision: redondear(Math.max(ivaAIngresar, 0) + pagoFraccionado),
    // De cada euro facturado (base), cuánto acaba siendo tuyo de verdad.
    disponibleReal: redondear(rendimientoNeto - pagoFraccionado - cuotaTrimestre),
    calendario: CALENDARIO.find((c) => c.trimestre === trimestre),
  };
}

/** El trimestre natural de una fecha. */
export function trimestreDe(fecha = new Date()) {
  return { anio: fecha.getFullYear(), trimestre: Math.floor(fecha.getMonth() / 3) + 1 };
}

/** Resumen del trimestre en curso más el anterior, para no perder de vista lo que viene. */
export function panel() {
  const actual = trimestreDe();
  const anterior =
    actual.trimestre === 1
      ? { anio: actual.anio - 1, trimestre: 4 }
      : { anio: actual.anio, trimestre: actual.trimestre - 1 };

  return {
    configuracion: configuracion(),
    actual: resumenTrimestre(actual),
    anterior: resumenTrimestre(anterior),
    anual: resumenAnual({ anio: actual.anio }),
    clientes: concentracionClientes({ anio: actual.anio }),
    guia: guiaFiscal(),
    modelos: MODELOS,
    calendario: CALENDARIO,
  };
}

/**
 * Concentración de clientes en un año natural, y si eso te convierte en TRADE.
 *
 * Facturar casi todo a un cliente tiene dos lecturas y conviene ver las dos: te
 * puede dar derechos (vacaciones, indemnización) que un autónomo normal no
 * tiene, y es el mayor riesgo de tu negocio, porque si ese cliente se cae te
 * quedas sin ingresos de golpe.
 */
export function concentracionClientes({ anio }) {
  const bd = obtenerBD();

  const filas = bd
    .prepare(
      `SELECT COALESCE(cliente, 'Sin identificar') AS cliente,
              COALESCE(SUM(base_centimos), 0) AS total
       FROM movimientos
       WHERE tipo = 'ingreso' AND base_centimos IS NOT NULL
         AND fecha BETWEEN ? AND ?
       GROUP BY COALESCE(cliente, 'Sin identificar')
       ORDER BY total DESC`
    )
    .all(`${anio}-01-01`, `${anio}-12-31`);

  const totalFacturado = filas.reduce((suma, f) => suma + aEuros(f.total), 0);

  const clientes = filas.map((f) => ({
    cliente: f.cliente,
    facturado: redondear(aEuros(f.total)),
    porcentaje: totalFacturado > 0 ? Math.round((aEuros(f.total) / totalFacturado) * 1000) / 10 : 0,
  }));

  const principal = clientes[0] ?? null;
  const identificado = principal && principal.cliente !== 'Sin identificar';
  const superaUmbral = Boolean(identificado && principal.porcentaje > TRADE.umbralIngresos);

  return {
    anio,
    totalFacturado: redondear(totalFacturado),
    clientes,
    principal,
    umbral: TRADE.umbralIngresos,
    // Solo el primer requisito de los siete: el resto no los puede saber la aplicación.
    posibleTrade: superaUmbral,
    trade: TRADE,
  };
}

/**
 * Resumen anual: los cuatro trimestres y la reducción por gastos de difícil
 * justificación, que solo tiene sentido calcular sobre el año completo.
 */
export function resumenAnual({ anio }) {
  const trimestres = [1, 2, 3, 4].map((trimestre) => resumenTrimestre({ anio, trimestre }));

  const suma = (extraer) => redondear(trimestres.reduce((total, t) => total + extraer(t), 0));
  const rendimientoNeto = suma((t) => t.rendimientoNeto);

  // Estimación directa simplificada: 5 % del rendimiento neto, con tope anual.
  const dificilJustificacion = redondear(
    Math.min(
      (Math.max(rendimientoNeto, 0) * LIMITES.dificilJustificacionPorcentaje) / 100,
      LIMITES.dificilJustificacionTope
    )
  );

  return {
    anio,
    trimestres,
    facturado: suma((t) => t.ingresos.base),
    gastos: suma((t) => t.gastos.base),
    rendimientoNeto,
    ivaIngresado: suma((t) => Math.max(t.iva.aIngresar, 0)),
    irpfRetenido: suma((t) => t.ingresos.irpfRetenido),
    cuotaAnual: suma((t) => t.cuotaAutonomos.trimestre),
    dificilJustificacion: {
      porcentaje: LIMITES.dificilJustificacionPorcentaje,
      tope: LIMITES.dificilJustificacionTope,
      importe: dificilJustificacion,
      nota: 'Solo en estimación directa simplificada. Se aplica sobre el rendimiento neto, con tope anual.',
    },
    rendimientoTrasReduccion: redondear(rendimientoNeto - dificilJustificacion),
  };
}

/** Guía fiscal: qué se puede deducir, con qué reglas y dónde comprobarlo. */
export function guiaFiscal() {
  return {
    requisitos: REQUISITOS_DEDUCIBILIDAD,
    gastos: GASTOS_DEDUCIBLES,
    limites: LIMITES,
    obligaciones: OBLIGACIONES,
    trade: TRADE,
    fuentes: FUENTES_OFICIALES,
  };
}

/** Calculadora de suministros de la vivienda afecta a la actividad. */
export function suministrosDeducibles(datos) {
  return calcularSuministros(datos);
}
