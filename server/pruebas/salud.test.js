import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { limpiarBD, vaciarDatos } from './ayuda.js';
import { cerrarBD, obtenerBD } from '../src/db/conexion.js';
import * as ajustes from '../src/servicios/ajustes.js';
import * as movimientos from '../src/servicios/movimientos.js';
import * as recurrentes from '../src/servicios/recurrentes.js';
import { saludFinanciera, TASA_AHORRO_MEDIA_ESPANA } from '../src/servicios/salud.js';
import * as metas from '../src/servicios/metas.js';

const bd = obtenerBD();

const hoy = new Date();
/** Fecha dentro de un mes ya cerrado (el mes en curso no cuenta para las medias). */
const haceMeses = (n, dia = 10) => {
  const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - n, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

const consejo = (resultado, clave) => resultado.consejos.find((c) => c.clave === clave);

/** El objetivo de vivienda es ahora una meta con clave propia. */
const metaVivienda = (objetivo, ahorrado = 0) =>
  metas.crearMeta({ nombre: 'Entrada de la vivienda', objetivo, ahorrado, clave: 'vivienda' });

beforeEach(() => {
  vaciarDatos(bd);
  bd.exec('DELETE FROM ajustes; DELETE FROM metas;');
});
after(() => { cerrarBD(); limpiarBD(); });

describe('ajustes del plan de ahorro', () => {
  it('devuelve los valores por defecto cuando no se ha guardado nada', () => {
    assert.deepEqual(ajustes.obtenerAjustes(), {
      objetivoAhorro: 20,
      mesesFondoEmergencia: 6,
      colchonActual: 0,
      pagasAlAnio: 12,
      modoAutonomo: 0,
      asistenteCompletado: 0,
      autonomoCuota: 0,
      autonomoTipoIva: 21,
      autonomoTipoIrpf: 15,
    });
  });

  it('guarda solo los campos enviados', () => {
    const guardados = ajustes.guardarAjustes({ colchonActual: 5000 });
    assert.equal(guardados.colchonActual, 5000);
    assert.equal(guardados.objetivoAhorro, 20, 'los demás mantienen su valor por defecto');
  });

  it('acota los valores fuera de rango en lugar de aceptarlos', () => {
    assert.equal(ajustes.guardarAjustes({ objetivoAhorro: 300 }).objetivoAhorro, 90);
    assert.equal(ajustes.guardarAjustes({ mesesFondoEmergencia: 0 }).mesesFondoEmergencia, 1);
    assert.equal(ajustes.guardarAjustes({ colchonActual: -100 }).colchonActual, 0);
  });

  it('ignora claves desconocidas', () => {
    const guardados = ajustes.guardarAjustes({ loQueSea: 1 });
    assert.equal(guardados.loQueSea, undefined);
  });
});

describe('salud financiera sin datos', () => {
  it('no rompe y guía sobre qué hacer', () => {
    const resultado = saludFinanciera();

    assert.equal(resultado.medias, null);
    assert.equal(resultado.tasaAhorro, null);
    assert.equal(resultado.reparto, null);
    assert.equal(resultado.fondoEmergencia.objetivo, 0);
    assert.ok(consejo(resultado, 'sin-datos'), 'el único consejo es empezar a registrar');
    assert.equal(resultado.consejos.length, 1);
  });
});

describe('salud financiera con histórico', () => {
  /** Dos meses cerrados: ingresos 2.000 y gastos 1.500 (de los cuales 1.000 fijos). */
  const sembrarDosMeses = () => {
    const alquiler = recurrentes.crearRecurrente({
      nombre: 'Alquiler', importe: 1000, tipo: 'gasto', diaDelMes: 1, fechaInicio: haceMeses(2, 1),
    });
    recurrentes.materializarPendientes();
    // El fijo también genera el mes en curso: se descuenta para no ensuciar la media.
    bd.prepare('DELETE FROM movimientos WHERE recurrente_id = ? AND fecha >= ?')
      .run(alquiler.id, `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`);

    for (const n of [1, 2]) {
      movimientos.crearMovimiento({ fecha: haceMeses(n, 25), importe: 2000, tipo: 'ingreso' });
      movimientos.crearMovimiento({ fecha: haceMeses(n, 15), importe: 500, tipo: 'gasto' });
    }
  };

  beforeEach(sembrarDosMeses);

  it('calcula medias, tasa de ahorro y reparto 50/30/20', () => {
    const resultado = saludFinanciera({ meses: 6 });

    assert.equal(resultado.medias.meses, 2);
    assert.equal(resultado.medias.ingresos, 2000);
    assert.equal(resultado.medias.gastos, 1500);
    assert.equal(resultado.medias.gastosFijos, 1000);
    assert.equal(resultado.medias.gastosVariables, 500);

    assert.equal(resultado.ahorroMensual, 500);
    assert.equal(resultado.tasaAhorro, 25);

    assert.equal(resultado.reparto.necesidades.porcentaje, 50);
    assert.equal(resultado.reparto.deseos.porcentaje, 25);
    assert.equal(resultado.reparto.ahorro.porcentaje, 25);
    assert.equal(resultado.reparto.ahorro.referencia, 20);
  });

  it('marca el objetivo como cumplido y lo compara con la media española', () => {
    const resultado = saludFinanciera();

    assert.equal(resultado.objetivo.porcentaje, 20);
    assert.equal(resultado.objetivo.euros, 400);
    assert.equal(resultado.objetivo.cumplido, true);
    assert.ok(consejo(resultado, 'objetivo-cumplido'));

    const comparativa = consejo(resultado, 'comparativa-espana');
    assert.ok(comparativa.titulo.includes('por encima'), '25 % supera el 12 % medio');
    assert.ok(comparativa.detalle.includes(`${TASA_AHORRO_MEDIA_ESPANA} %`));
  });

  it('avisa y cuantifica cuando no se llega al objetivo', () => {
    ajustes.guardarAjustes({ objetivoAhorro: 40 });
    const resultado = saludFinanciera();

    assert.equal(resultado.objetivo.cumplido, false);
    assert.equal(resultado.objetivo.euros, 800);
    assert.equal(resultado.objetivo.diferenciaEuros, 300, 'faltan 300 € al mes');
    assert.ok(consejo(resultado, 'objetivo-lejos').titulo.includes('300,00'), 'importe en formato español');
  });

  it('dimensiona el fondo de emergencia sobre el gasto real', () => {
    const resultado = saludFinanciera();
    const fondo = resultado.fondoEmergencia;

    assert.equal(fondo.gastoMensualReferencia, 1500);
    assert.equal(fondo.objetivo, 9000, '6 meses x 1.500 €');
    assert.equal(fondo.actual, 0);
    assert.equal(fondo.restante, 9000);
    assert.equal(fondo.mesesCubiertos, 0);
    assert.equal(fondo.mesesParaCompletarlo, 18, 'a 500 €/mes');
    assert.equal(consejo(resultado, 'fondo-insuficiente').prioridad, 'alta');
  });

  it('reconoce el progreso del colchón y no pasa del 100 %', () => {
    ajustes.guardarAjustes({ colchonActual: 6000 });
    const enCamino = saludFinanciera();

    assert.equal(enCamino.fondoEmergencia.mesesCubiertos, 4);
    assert.equal(enCamino.fondoEmergencia.progreso, 66.7);
    assert.ok(!consejo(enCamino, 'fondo-insuficiente'), '4 meses ya supera el mínimo de 3');
    assert.ok(consejo(enCamino, 'fondo-en-camino'));

    ajustes.guardarAjustes({ colchonActual: 20000 });
    const cubierto = saludFinanciera();
    assert.equal(cubierto.fondoEmergencia.progreso, 100);
    assert.equal(cubierto.fondoEmergencia.restante, 0);
    assert.ok(!consejo(cubierto, 'fondo-en-camino'));
  });

  it('detecta que los gastos fijos pesan más de la mitad de los ingresos', () => {
    recurrentes.crearRecurrente({ nombre: 'Nómina', importe: 2000, tipo: 'ingreso', diaDelMes: 25, fechaInicio: haceMeses(6) });
    recurrentes.crearRecurrente({ nombre: 'Coche', importe: 300, tipo: 'gasto', diaDelMes: 5, fechaInicio: haceMeses(6) });

    // 1.000 (alquiler) + 300 (coche) = 1.300 sobre 2.000 -> 65 %
    const aviso = consejo(saludFinanciera(), 'fijos-altos');
    assert.ok(aviso, 'se avisa al superar el 50 %');
    assert.equal(aviso.prioridad, 'media');
    assert.ok(aviso.titulo.includes('65'));
  });

  it('escribe todos los números de los consejos en formato español', () => {
    ajustes.guardarAjustes({ objetivoAhorro: 40, colchonActual: 6000 });
    const { consejos } = saludFinanciera();
    const texto = consejos.map((c) => `${c.titulo} ${c.detalle}`).join(' ');

    // Un punto entre dígitos delataría un decimal sin traducir (3.05 en vez de 3,05).
    // El separador de miles español sí lo usa, así que se comprueba el patrón decimal.
    assert.ok(!/\d\.\d{1,2}(?!\d)/.test(texto), `hay decimales con punto en: ${texto}`);
    assert.ok(texto.includes('€'));
  });

  it('prioriza los consejos: primero lo urgente', () => {
    ajustes.guardarAjustes({ objetivoAhorro: 40 });
    const { consejos } = saludFinanciera();

    const prioridades = consejos.map((c) => c.prioridad);
    const orden = { alta: 0, media: 1, info: 2 };
    const ordenados = [...prioridades].sort((a, b) => orden[a] - orden[b]);
    assert.deepEqual(prioridades, ordenados);
    assert.equal(consejos[0].prioridad, 'alta', 'el fondo de emergencia manda');
  });
});

describe('reacción al gasto del mes en curso', () => {
  /** Fecha dentro del mes actual. */
  const esteMes = (dia) =>
    `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

  it('sin meses cerrados con variable, usa la proyección del mes en curso', () => {
    // Nómina y un fijo en meses anteriores: la media solo conoce los fijos.
    recurrentes.crearRecurrente({ nombre: 'Nómina', importe: 1600, tipo: 'ingreso', diaDelMes: 25, fechaInicio: haceMeses(6) });
    recurrentes.crearRecurrente({ nombre: 'Alquiler', importe: 300, tipo: 'gasto', diaDelMes: 1, fechaInicio: haceMeses(6) });
    recurrentes.materializarPendientes();

    const antes = saludFinanciera();
    assert.equal(antes.referenciaGasto.origen, 'solo-fijos');

    // Se apunta gasto variable de este mes.
    movimientos.crearMovimiento({ fecha: esteMes(1), importe: 200, tipo: 'gasto' });

    const despues = saludFinanciera();
    assert.equal(despues.referenciaGasto.origen, 'mes-en-curso');
    assert.equal(despues.referenciaGasto.provisional, true);
    assert.ok(
      despues.referenciaGasto.importe > antes.referenciaGasto.importe,
      'el plan tiene que reaccionar al apuntar gastos, no esperar a que cierre el mes'
    );
  });

  it('la proyección no extrapola los gastos fijos', () => {
    recurrentes.crearRecurrente({ nombre: 'Alquiler', importe: 300, tipo: 'gasto', diaDelMes: 1, fechaInicio: haceMeses(6) });
    recurrentes.materializarPendientes();
    movimientos.crearMovimiento({ fecha: esteMes(1), importe: 100, tipo: 'gasto' });

    const { mesEnCurso: curso } = saludFinanciera();

    assert.equal(curso.gastosFijos, 300);
    assert.equal(curso.gastosVariables, 100);
    // Extrapolar los 300 € del alquiler daría una previsión disparatada.
    assert.ok(curso.gastoProyectado < 300 + 100 * curso.diasDelMes, 'los fijos no se multiplican');
    assert.ok(curso.gastoProyectado >= 400);
  });

  it('con meses cerrados manda el dato real, no la proyección', () => {
    for (let n = 1; n <= 3; n += 1) {
      movimientos.crearMovimiento({ fecha: haceMeses(n, 25), importe: 1600, tipo: 'ingreso' });
      movimientos.crearMovimiento({ fecha: haceMeses(n, 15), importe: 900, tipo: 'gasto' });
    }
    movimientos.crearMovimiento({ fecha: esteMes(1), importe: 5000, tipo: 'gasto' });

    const salud = saludFinanciera();
    assert.equal(salud.referenciaGasto.origen, 'meses-cerrados');
    assert.equal(salud.referenciaGasto.provisional, false);
    assert.equal(salud.referenciaGasto.importe, 900, 'un mes atípico no secuestra la referencia');
  });

  it('los consejos citan la misma cifra con la que se calcula el fondo', () => {
    recurrentes.crearRecurrente({ nombre: 'Alquiler', importe: 300, tipo: 'gasto', diaDelMes: 1, fechaInicio: haceMeses(6) });
    recurrentes.materializarPendientes();
    movimientos.crearMovimiento({ fecha: esteMes(1), importe: 400, tipo: 'gasto' });

    const salud = saludFinanciera();
    const aviso = salud.consejos.find((c) => c.clave === 'fondo-insuficiente');

    // El fondo se dimensiona sobre la referencia; el texto no puede citar otra.
    const referencia = salud.referenciaGasto.importe.toLocaleString('es-ES', { minimumFractionDigits: 2 });
    assert.ok(
      aviso.detalle.includes(referencia),
      `el consejo cita otra cifra distinta de la referencia (${referencia}): ${aviso.detalle}`
    );
  });

  it('el fondo de emergencia se redimensiona con el gasto real', () => {
    recurrentes.crearRecurrente({ nombre: 'Alquiler', importe: 300, tipo: 'gasto', diaDelMes: 1, fechaInicio: haceMeses(6) });
    recurrentes.materializarPendientes();

    const antes = saludFinanciera().fondoEmergencia.objetivo;
    movimientos.crearMovimiento({ fecha: esteMes(1), importe: 400, tipo: 'gasto' });
    const despues = saludFinanciera().fondoEmergencia.objetivo;

    assert.ok(despues > antes, 'si gastas más, el colchón necesario sube');
  });
});

describe('pagas extra', () => {
  it('no cuenta las extras dos veces al proyectar la tasa anual', () => {
    ajustes.guardarAjustes({ pagasAlAnio: 14 });

    // Doce meses cerrados: diez de 1.600 € y dos con paga extra (3.200 €).
    // Gasto estable de 1.200 € al mes.
    for (let n = 1; n <= 12; n += 1) {
      const esExtra = n === 6 || n === 12;
      movimientos.crearMovimiento({ fecha: haceMeses(n, 25), importe: esExtra ? 3200 : 1600, tipo: 'ingreso' });
      movimientos.crearMovimiento({ fecha: haceMeses(n, 15), importe: 1200, tipo: 'gasto' });
    }

    const { extras } = saludFinanciera({ meses: 12 });

    assert.equal(extras.pagas, 2);
    assert.equal(extras.mensualRecurrente, 1600, 'el mes normal sale de la mediana');
    assert.equal(extras.importeAnual, 3200);
    assert.equal(extras.netoAnual, 22400);
    assert.equal(extras.ahorroMesNormal, 400, '1.600 - 1.200');

    // (400 x 12 + 3.200) / 22.400 = 35,7 %. Con la media mensual (1.866,67 €, que
    // ya prorratea las extras) habría salido un 50 %: las extras contadas dos veces.
    assert.equal(extras.tasaAnualSiSeAhorran, 35.7);
    assert.ok(extras.tasaAnualSiSeAhorran <= 100, 'una tasa de ahorro no puede superar el 100 %');
  });

  it('sin gastos registrados la tasa anual no se dispara por encima del 100 %', () => {
    ajustes.guardarAjustes({ pagasAlAnio: 14 });
    for (let n = 1; n <= 12; n += 1) {
      movimientos.crearMovimiento({
        fecha: haceMeses(n, 25),
        importe: n === 6 || n === 12 ? 3200 : 1600,
        tipo: 'ingreso',
      });
    }

    assert.equal(saludFinanciera({ meses: 12 }).extras.tasaAnualSiSeAhorran, 100);
  });

  it('con 12 pagas no hay bloque de extras', () => {
    movimientos.crearMovimiento({ fecha: haceMeses(1, 25), importe: 1600, tipo: 'ingreso' });
    assert.equal(saludFinanciera().extras, null);
  });
});

describe('meta de ahorro para vivienda', () => {
  /** 1.600 € al mes en 14 pagas, 900 € de gastos: 700 €/mes + 3.200 € de extras. */
  const sembrarPerfil = () => {
    ajustes.guardarAjustes({ pagasAlAnio: 14 });
    for (let n = 1; n <= 12; n += 1) {
      const esExtra = n === 6 || n === 12;
      movimientos.crearMovimiento({ fecha: haceMeses(n, 25), importe: esExtra ? 3200 : 1600, tipo: 'ingreso' });
      movimientos.crearMovimiento({ fecha: haceMeses(n, 15), importe: 900, tipo: 'gasto' });
    }
  };

  it('está desactivada mientras no se fije un objetivo', () => {
    sembrarPerfil();
    assert.equal(saludFinanciera({ meses: 12 }).vivienda, null);
  });

  it('calcula el aporte anual contando las pagas extra', () => {
    sembrarPerfil();
    ajustes.guardarAjustes({ colchonActual: 99000 });
    metaVivienda(30000, 5000);

    const { vivienda } = saludFinanciera({ meses: 12 });

    assert.equal(vivienda.objetivo, 30000);
    assert.equal(vivienda.restante, 25000);
    assert.equal(vivienda.progreso, 16.7);
    assert.equal(vivienda.aporteMensual, 700, '1.600 - 900');
    assert.equal(vivienda.aporteAnual, 11600, '700 x 12 + 3.200 de extras');
    // Colchón ya cubierto: 25.000 / 11.600 al año = 25,9 meses -> 26.
    assert.equal(vivienda.mesesEstimados, 26);
  });

  it('el colchón de imprevistos va antes que la entrada', () => {
    sembrarPerfil();
    ajustes.guardarAjustes({ colchonActual: 0 });
    metaVivienda(30000, 5000);

    const salud = saludFinanciera({ meses: 12 });
    const conColchonPendiente = salud.vivienda.mesesEstimados;

    ajustes.guardarAjustes({ colchonActual: 99000 });
    const sinColchonPendiente = saludFinanciera({ meses: 12 }).vivienda.mesesEstimados;

    assert.ok(
      conColchonPendiente > sinColchonPendiente,
      'completar el colchón primero retrasa la vivienda, y hay que decirlo'
    );
  });

  it('no divide por cero si no se ahorra nada', () => {
    metaVivienda(30000);
    movimientos.crearMovimiento({ fecha: haceMeses(1, 25), importe: 1000, tipo: 'ingreso' });
    movimientos.crearMovimiento({ fecha: haceMeses(1, 15), importe: 1000, tipo: 'gasto' });

    assert.equal(saludFinanciera().vivienda.mesesEstimados, null);
  });

  it('el progreso no pasa del 100 %', () => {
    sembrarPerfil();
    metaVivienda(10000, 10000);

    const { vivienda } = saludFinanciera({ meses: 12 });
    assert.equal(vivienda.progreso, 100);
    assert.equal(vivienda.restante, 0);
  });
});

describe('salud financiera en números rojos', () => {
  it('detecta el balance negativo como problema de máxima prioridad', () => {
    movimientos.crearMovimiento({ fecha: haceMeses(1, 5), importe: 1000, tipo: 'ingreso' });
    movimientos.crearMovimiento({ fecha: haceMeses(1, 6), importe: 1300, tipo: 'gasto' });

    const resultado = saludFinanciera();
    assert.equal(resultado.ahorroMensual, -300);
    assert.equal(resultado.tasaAhorro, -30);

    const aviso = consejo(resultado, 'balance-negativo');
    assert.equal(aviso.prioridad, 'alta');
    assert.ok(aviso.detalle.includes('300,00'), 'importe en formato español');
    assert.equal(resultado.fondoEmergencia.mesesParaCompletarlo, null, 'sin ahorro no hay plazo que estimar');
  });
});
