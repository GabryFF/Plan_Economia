import { obtenerAjustes } from './ajustes.js';
import { planificarMetas } from './metas.js';
import {
  ingresoMensualRecurrente, mediasMensuales, mesEnCurso, mesesCerradosConGastoVariable,
} from './medias.js';
import { resumenMensualFijos } from './recurrentes.js';

/**
 * Plan de ahorro: compara los números reales del usuario con referencias
 * generales de planificación financiera (regla 50/30/20, colchón de 3-6 meses
 * de gastos y la tasa de ahorro media de los hogares españoles).
 *
 * Son referencias divulgativas, no asesoramiento financiero: la interfaz lo
 * advierte de forma explícita.
 */

/** Tasa de ahorro media de los hogares en España sobre su renta disponible (INE, 2025). */
export const TASA_AHORRO_MEDIA_ESPANA = 12;

/** Reparto orientativo de los ingresos netos según la regla 50/30/20. */
export const REGLA_50_30_20 = { necesidades: 50, deseos: 30, ahorro: 20 };

const redondear = (n) => Math.round(n * 100) / 100;

/**
 * Los consejos son texto que lee una persona: los importes van formateados en
 * español (1.234,56 €), no como números crudos de JavaScript.
 */
const formateador = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const enEuros = (n) => formateador.format(redondear(n));
/** Decimales en español para porcentajes y puntos: 37,4 en lugar de 37.4. */
const enNumero = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : null);

/** Reglas que traducen los números en recomendaciones accionables y priorizadas. */
function construirConsejos({ medias, ahorroMensual, tasaAhorro, ajustes, fondo, fijos, extras, vivienda, referenciaGasto }) {
  const consejos = [];

  if (!medias) {
    consejos.push({
      clave: 'sin-datos',
      prioridad: 'info',
      titulo: 'Aún no hay meses completos que analizar',
      detalle:
        'Registra al menos un mes entero de ingresos y gastos (o da de alta tus fijos con su fecha de inicio real) ' +
        'y aquí verás tu plan de ahorro con tus propios números.',
    });
    return consejos;
  }

  if (ahorroMensual < 0) {
    consejos.push({
      clave: 'balance-negativo',
      prioridad: 'alta',
      titulo: 'Estás gastando más de lo que ingresas',
      detalle:
        `De media gastas ${enEuros(Math.abs(ahorroMensual))} más de lo que ingresas cada mes. ` +
        'Antes que ninguna otra cosa, revisa los gastos fijos: son los que se repiten sin que vuelvas a decidirlos.',
    });
  }

  if (fondo.mesesCubiertos !== null && fondo.mesesCubiertos < 3) {
    consejos.push({
      clave: 'fondo-insuficiente',
      prioridad: 'alta',
      titulo: 'Tu colchón cubre menos de 3 meses',
      detalle:
        `Con tu gasto de referencia (${enEuros(referenciaGasto.importe)} al mes${referenciaGasto.provisional ? ', estimado' : ''}), ` +
        `un colchón de 3 meses serían ${enEuros(referenciaGasto.importe * 3)}. ` +
        'La recomendación habitual es tener entre 3 y 6 meses de gastos disponibles y sin riesgo, ' +
        'para que un imprevisto no se convierta en deuda.',
    });
  } else if (fondo.mesesCubiertos !== null && fondo.mesesCubiertos < ajustes.mesesFondoEmergencia) {
    consejos.push({
      clave: 'fondo-en-camino',
      prioridad: 'media',
      titulo: `Te faltan ${enEuros(fondo.objetivo - fondo.actual)} para tu colchón objetivo`,
      detalle:
        `Ya cubres ${enNumero(fondo.mesesCubiertos)} meses de gastos. ` +
        (ahorroMensual > 0
          ? `Al ritmo actual lo completarías en unos ${Math.ceil((fondo.objetivo - fondo.actual) / ahorroMensual)} meses.`
          : 'Necesitas un ahorro mensual positivo para completarlo.'),
    });
  }

  if (vivienda && vivienda.mesesEstimados !== null) {
    const anios = Math.floor(vivienda.mesesEstimados / 12);
    const meses = vivienda.mesesEstimados % 12;
    const plazo = anios > 0 ? `${anios} año(s)${meses > 0 ? ` y ${meses} mes(es)` : ''}` : `${meses} mes(es)`;

    consejos.push({
      clave: 'meta-vivienda',
      prioridad: fondo.mesesCubiertos !== null && fondo.mesesCubiertos < 3 ? 'info' : 'media',
      titulo: `Tu vivienda: te faltan ${enEuros(vivienda.restante)}, unos ${plazo}`,
      detalle:
        `Aportando ${enEuros(vivienda.aporteMensual)} al mes más las pagas extra son ` +
        `${enEuros(vivienda.aporteAnual)} al año. ` +
        (fondo.restante > 0
          ? 'La estimación cuenta con completar antes el colchón de imprevistos: sin él, cualquier susto te obligaría a gastar la entrada.'
          : 'Con el colchón ya cubierto, todo lo que ahorres va a la entrada.'),
    });
  }

  if (tasaAhorro !== null && tasaAhorro < ajustes.objetivoAhorro) {
    const faltan = redondear((medias.ingresos * ajustes.objetivoAhorro) / 100 - ahorroMensual);
    consejos.push({
      clave: 'objetivo-lejos',
      prioridad: 'media',
      titulo: `Para llegar a tu objetivo del ${ajustes.objetivoAhorro} % te faltan ${enEuros(faltan)} al mes`,
      detalle:
        `Ahora ahorras un ${enNumero(tasaAhorro)} % de lo que ingresas. ` +
        'Es más fácil recortar una suscripción de 15 € que se paga sola cada mes que dejar de gastar 15 € sueltos.',
    });
  } else if (tasaAhorro !== null) {
    consejos.push({
      clave: 'objetivo-cumplido',
      prioridad: 'info',
      titulo: `Estás cumpliendo tu objetivo: ahorras un ${enNumero(tasaAhorro)} %`,
      detalle:
        `A este ritmo apartas ${enEuros(ahorroMensual * 12)} al año. ` +
        'Con el colchón de imprevistos ya cubierto, el siguiente paso suele ser decidir qué destino darle a ese excedente.',
    });
  }

  if (extras && extras.importeAnual > 0) {
    consejos.push({
      clave: 'pagas-extra',
      prioridad: 'media',
      titulo: `Tus ${ajustes.pagasAlAnio - 12} pagas extra suman ${enEuros(extras.importeAnual)} al año`,
      detalle:
        `Equivalen a ${enEuros(extras.importeAnual / 12)} al mes, pero no las cobras cada mes: ` +
        'presupuesta con lo que entra un mes normal y manda las extras íntegras al ahorro. ' +
        `Solo con eso tu tasa de ahorro anual sería del ${enNumero(extras.tasaAnualSiSeAhorran)} %.`,
    });
  }

  if (fijos.pesoSobreIngresos !== null && fijos.pesoSobreIngresos > REGLA_50_30_20.necesidades) {
    consejos.push({
      clave: 'fijos-altos',
      prioridad: 'media',
      titulo: `Tus gastos fijos se llevan el ${enNumero(fijos.pesoSobreIngresos)} % de tus ingresos fijos`,
      detalle:
        'Por encima del 50 % el margen de maniobra se estrecha mucho: cualquier imprevisto entra en terreno negativo. ' +
        'Vivienda, seguros y suscripciones son donde una sola gestión ahorra todos los meses del año.',
    });
  }

  if (tasaAhorro !== null) {
    const diferencia = redondear(tasaAhorro - TASA_AHORRO_MEDIA_ESPANA);
    consejos.push({
      clave: 'comparativa-espana',
      prioridad: 'info',
      titulo:
        diferencia >= 0
          ? `Ahorras ${enNumero(diferencia)} puntos por encima de la media española`
          : `Ahorras ${enNumero(Math.abs(diferencia))} puntos por debajo de la media española`,
      detalle:
        `La tasa de ahorro media de los hogares en España fue del ${TASA_AHORRO_MEDIA_ESPANA} % de su renta ` +
        'disponible en 2025, según el INE. Es una referencia de contexto, no un objetivo: lo que te sirve a ti ' +
        'depende de tus gastos y tus planes.',
    });
  }

  const orden = { alta: 0, media: 1, info: 2 };
  return consejos.sort((a, b) => orden[a.prioridad] - orden[b.prioridad]);
}

export function saludFinanciera({ meses = 6 } = {}) {
  const ajustes = obtenerAjustes();
  const medias = mediasMensuales(meses);
  const fijos = resumenMensualFijos();

  const enCurso = mesEnCurso();
  const mesesConVariable = mesesCerradosConGastoVariable(meses);

  /**
   * De dónde sale el gasto de referencia.
   *
   * Mientras no haya meses cerrados con gasto variable, la media solo contiene
   * los fijos y sale ridículamente baja. En ese hueco se usa la proyección del
   * mes en curso: así el plan reacciona desde la primera semana que se apunta,
   * en lugar de esperar al día 1 del mes siguiente.
   */
  const referenciaGasto =
    mesesConVariable > 0
      ? { importe: medias?.gastos ?? 0, origen: 'meses-cerrados', provisional: false }
      : enCurso.proyectable
        ? { importe: enCurso.gastoProyectado, origen: 'mes-en-curso', provisional: true }
        : { importe: medias?.gastos || fijos.gastosFijos, origen: 'solo-fijos', provisional: true };


  const ahorroMensual = medias ? redondear(medias.ingresos - medias.gastos) : 0;

  // Con más de 12 pagas, el mes normal (mediana) y la media anual difieren: la
  // diferencia son las extras, y de lo que se haga con ellas depende el año.
  const ingresoRecurrente = ingresoMensualRecurrente();
  const mensualRecurrente = ingresoRecurrente.importe;
  const pagasExtra = Math.max(ajustes.pagasAlAnio - 12, 0);
  const importeExtrasAnual = redondear(mensualRecurrente * pagasExtra);
  const netoAnual = redondear(mensualRecurrente * ajustes.pagasAlAnio);

  const extras =
    importeExtrasAnual > 0 && netoAnual > 0
      ? {
          pagas: pagasExtra,
          importeAnual: importeExtrasAnual,
          mensualRecurrente,
          netoAnual,
          // El ahorro de un MES NORMAL, no la media: la media ya reparte las
          // extras entre los doce meses, y volver a sumarlas las contaría dos
          // veces (llegaba a dar tasas por encima del 100 %).
          ahorroMesNormal: redondear(mensualRecurrente - referenciaGasto.importe),
          tasaAnualSiSeAhorran:
            Math.round((((mensualRecurrente - referenciaGasto.importe) * 12 + importeExtrasAnual) / netoAnual) * 1000) / 10,
        }
      : null;
  const tasaAhorro = medias ? porcentaje(medias.ingresos - medias.gastos, medias.ingresos) : null;

  const objetivoFondo = redondear(referenciaGasto.importe * ajustes.mesesFondoEmergencia);

  const fondo = {
    mesesObjetivo: ajustes.mesesFondoEmergencia,
    gastoMensualReferencia: redondear(referenciaGasto.importe),
    objetivo: objetivoFondo,
    actual: ajustes.colchonActual,
    restante: redondear(Math.max(objetivoFondo - ajustes.colchonActual, 0)),
    mesesCubiertos: referenciaGasto.importe > 0 ? redondear(ajustes.colchonActual / referenciaGasto.importe) : null,
    progreso: objetivoFondo > 0 ? Math.min(Math.round((ajustes.colchonActual / objetivoFondo) * 1000) / 10, 100) : null,
    // Con el ahorro actual, cuánto tardaría en completarlo.
    mesesParaCompletarlo:
      ahorroMensual > 0 && objetivoFondo > ajustes.colchonActual
        ? Math.ceil((objetivoFondo - ajustes.colchonActual) / ahorroMensual)
        : null,
  };

  // Objetivos de ahorro con nombre. A diferencia del fondo de emergencia, aquí
  // también cuentan las pagas extra: no forman parte del ciclo mensual y su
  // destino natural es un objetivo a años vista.
  const ahorroMesNormal = extras?.ahorroMesNormal ?? ahorroMensual;
  const aporteAnual = redondear(ahorroMesNormal * 12 + (extras?.importeAnual ?? 0));

  const metas = planificarMetas({ aporteAnual, pendienteAntes: fondo.restante }).map((meta) => ({
    ...meta,
    aporteMensual: ahorroMesNormal,
    aporteAnual,
  }));

  // Atajo para las pantallas que hablan específicamente de la vivienda.
  const vivienda = metas.find((m) => m.clave === 'vivienda') ?? null;

  // Aproximación a la regla 50/30/20: los fijos hacen de "necesidades" y los
  // variables de "deseos". No es exacto (la compra del súper es una necesidad
  // variable), pero es el corte que la aplicación puede hacer sin pedir al
  // usuario que clasifique cada categoría a mano.
  const reparto = medias
    ? {
        necesidades: { euros: medias.gastosFijos, porcentaje: porcentaje(medias.gastosFijos, medias.ingresos), referencia: REGLA_50_30_20.necesidades },
        deseos: { euros: medias.gastosVariables, porcentaje: porcentaje(medias.gastosVariables, medias.ingresos), referencia: REGLA_50_30_20.deseos },
        ahorro: { euros: ahorroMensual, porcentaje: tasaAhorro, referencia: REGLA_50_30_20.ahorro },
      }
    : null;

  return {
    ajustes,
    medias,
    ahorroMensual,
    tasaAhorro,
    objetivo: {
      porcentaje: ajustes.objetivoAhorro,
      euros: medias ? redondear((medias.ingresos * ajustes.objetivoAhorro) / 100) : null,
      cumplido: tasaAhorro !== null && tasaAhorro >= ajustes.objetivoAhorro,
      diferenciaEuros: medias ? redondear((medias.ingresos * ajustes.objetivoAhorro) / 100 - ahorroMensual) : null,
    },
    fondoEmergencia: fondo,
    metas,
    mesEnCurso: enCurso,
    referenciaGasto,
    vivienda,
    reparto,
    referencias: {
      tasaAhorroMediaEspana: TASA_AHORRO_MEDIA_ESPANA,
      regla: REGLA_50_30_20,
    },
    extras,
    consejos: construirConsejos({ medias, ahorroMensual, tasaAhorro, ajustes, fondo, fijos, extras, vivienda, referenciaGasto }),
  };
}
