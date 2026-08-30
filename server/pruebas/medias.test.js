import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { limpiarBD, vaciarDatos } from './ayuda.js';
import { cerrarBD, obtenerBD } from '../src/db/conexion.js';
import {
  ingresoMensualRecurrente, mediasMensuales, medianaIngresosMensuales, mesEnCurso,
  mesesCerradosConGastoVariable,
} from '../src/servicios/medias.js';
import * as movimientos from '../src/servicios/movimientos.js';
import * as recurrentes from '../src/servicios/recurrentes.js';

const bd = obtenerBD();

const hoy = new Date();
const haceMeses = (n, dia = 10) => {
  const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - n, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};
const esteMes = (dia) =>
  `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

beforeEach(() => vaciarDatos(bd));
after(() => { cerrarBD(); limpiarBD(); });

describe('mediasMensuales', () => {
  it('devuelve null sin meses cerrados con datos', () => {
    movimientos.crearMovimiento({ fecha: esteMes(1), importe: 500, tipo: 'gasto' });
    assert.equal(mediasMensuales(6), null, 'el mes en curso no cuenta');
  });

  it('promedia solo los meses que tienen algo', () => {
    movimientos.crearMovimiento({ fecha: haceMeses(1, 5), importe: 1000, tipo: 'ingreso' });
    movimientos.crearMovimiento({ fecha: haceMeses(1, 6), importe: 400, tipo: 'gasto' });
    movimientos.crearMovimiento({ fecha: haceMeses(2, 5), importe: 1000, tipo: 'ingreso' });
    movimientos.crearMovimiento({ fecha: haceMeses(2, 6), importe: 600, tipo: 'gasto' });

    const medias = mediasMensuales(6);
    assert.equal(medias.meses, 2, 'los meses vacíos no diluyen la media');
    assert.equal(medias.ingresos, 1000);
    assert.equal(medias.gastos, 500);
  });

  it('separa el gasto fijo del variable', () => {
    recurrentes.crearRecurrente({ nombre: 'Alquiler', importe: 300, tipo: 'gasto', diaDelMes: 1, fechaInicio: haceMeses(2, 1) });
    recurrentes.materializarPendientes();
    movimientos.crearMovimiento({ fecha: haceMeses(1, 15), importe: 100, tipo: 'gasto' });

    const medias = mediasMensuales(6);
    assert.ok(medias.gastosFijos > 0);
    assert.equal(medias.gastosFijos + medias.gastosVariables, medias.gastos);
  });
});

describe('medianaIngresosMensuales', () => {
  it('ignora los picos de las pagas extra', () => {
    for (let n = 1; n <= 12; n += 1) {
      const esExtra = n === 6 || n === 12;
      movimientos.crearMovimiento({ fecha: haceMeses(n, 25), importe: esExtra ? 3200 : 1600, tipo: 'ingreso' });
    }

    assert.equal(medianaIngresosMensuales(12).importe, 1600);
  });

  it('con número par de meses hace la media de los dos centrales', () => {
    movimientos.crearMovimiento({ fecha: haceMeses(1, 5), importe: 1000, tipo: 'ingreso' });
    movimientos.crearMovimiento({ fecha: haceMeses(2, 5), importe: 2000, tipo: 'ingreso' });

    assert.equal(medianaIngresosMensuales(6).importe, 1500);
  });

  it('devuelve null sin ingresos', () => {
    assert.equal(medianaIngresosMensuales(6), null);
  });
});

describe('ingresoMensualRecurrente', () => {
  it('prefiere la nómina declarada al histórico', () => {
    movimientos.crearMovimiento({ fecha: haceMeses(1, 25), importe: 1000, tipo: 'ingreso' });
    assert.equal(ingresoMensualRecurrente().origen, 'mediana');

    recurrentes.crearRecurrente({ nombre: 'Nómina', importe: 1800, tipo: 'ingreso', diaDelMes: 25, fechaInicio: haceMeses(1) });

    const resultado = ingresoMensualRecurrente();
    assert.equal(resultado.origen, 'nomina-declarada');
    assert.equal(resultado.importe, 1800, 'una subida de sueldo se refleja al momento');
  });

  it('no cuenta las nóminas caducadas', () => {
    recurrentes.crearRecurrente({
      nombre: 'Antigua', importe: 1200, tipo: 'ingreso', diaDelMes: 25,
      fechaInicio: haceMeses(12), fechaFin: haceMeses(6),
    });

    assert.equal(ingresoMensualRecurrente().origen, 'sin-datos');
  });

  it('sin nada devuelve cero, no revienta', () => {
    assert.deepEqual(ingresoMensualRecurrente(), { importe: 0, origen: 'sin-datos' });
  });
});

describe('mesEnCurso', () => {
  it('cuenta lo que llevas gastado este mes', () => {
    movimientos.crearMovimiento({ fecha: esteMes(1), importe: 120, tipo: 'gasto' });
    movimientos.crearMovimiento({ fecha: esteMes(2), importe: 80, tipo: 'gasto' });

    const curso = mesEnCurso();
    assert.equal(curso.gastos, 200);
    assert.equal(curso.gastosVariables, 200);
    assert.equal(curso.movimientosVariables, 2);
    assert.equal(curso.diasTranscurridos, Math.min(hoy.getDate(), curso.diasDelMes));
  });

  it('no proyecta en los primeros días del mes', () => {
    const curso = mesEnCurso(new Date(hoy.getFullYear(), hoy.getMonth(), 3));
    assert.equal(curso.proyectable, false, 'con tres días la extrapolación sería ruido');
  });

  it('no proyecta si no hay ningún gasto variable', () => {
    recurrentes.crearRecurrente({ nombre: 'Alquiler', importe: 300, tipo: 'gasto', diaDelMes: 1, fechaInicio: esteMes(1) });
    recurrentes.materializarPendientes();

    const curso = mesEnCurso(new Date(hoy.getFullYear(), hoy.getMonth(), 20));
    assert.equal(curso.proyectable, false);
    assert.equal(curso.gastoProyectado, curso.gastos, 'sin variables, la previsión es lo ya gastado');
  });
});

describe('mesesCerradosConGastoVariable', () => {
  it('no cuenta los meses que solo tienen fijos', () => {
    recurrentes.crearRecurrente({ nombre: 'Alquiler', importe: 300, tipo: 'gasto', diaDelMes: 1, fechaInicio: haceMeses(4, 1) });
    recurrentes.materializarPendientes();

    assert.equal(mesesCerradosConGastoVariable(6), 0);

    movimientos.crearMovimiento({ fecha: haceMeses(2, 15), importe: 50, tipo: 'gasto' });
    assert.equal(mesesCerradosConGastoVariable(6), 1);
  });

  it('no cuenta el mes en curso', () => {
    movimientos.crearMovimiento({ fecha: esteMes(1), importe: 50, tipo: 'gasto' });
    assert.equal(mesesCerradosConGastoVariable(6), 0);
  });
});
