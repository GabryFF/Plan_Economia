import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { limpiarBD, vaciarDatos } from './ayuda.js';
import { cerrarBD, obtenerBD } from '../src/db/conexion.js';
import * as recurrentes from '../src/servicios/recurrentes.js';

const bd = obtenerBD();
const idCategoria = (nombre) => bd.prepare('SELECT id FROM categorias WHERE nombre = ?').get(nombre).id;
const NOMINA = idCategoria('Nómina');
const VIVIENDA = idCategoria('Vivienda');

const contarMovimientos = () => bd.prepare('SELECT COUNT(*) AS n FROM movimientos').get().n;
const fechasGeneradas = () =>
  bd.prepare('SELECT fecha FROM movimientos ORDER BY fecha').all().map((f) => f.fecha);

beforeEach(() => vaciarDatos(bd));
after(() => { cerrarBD(); limpiarBD(); });

describe('materialización de movimientos fijos', () => {
  it('genera un movimiento por mes desde el inicio hasta la fecha indicada', () => {
    recurrentes.crearRecurrente({
      nombre: 'Nómina', importe: 2400, tipo: 'ingreso', categoriaId: NOMINA,
      diaDelMes: 25, fechaInicio: '2026-03-25',
    });

    const { creados } = recurrentes.materializarPendientes({ hasta: '2026-08-28' });
    assert.equal(creados, 6, 'marzo, abril, mayo, junio, julio y agosto');
    assert.deepEqual(fechasGeneradas(), [
      '2026-03-25', '2026-04-25', '2026-05-25', '2026-06-25', '2026-07-25', '2026-08-25',
    ]);
  });

  it('es idempotente: llamarla dos veces no duplica nada', () => {
    recurrentes.crearRecurrente({
      nombre: 'Alquiler', importe: 850, tipo: 'gasto', categoriaId: VIVIENDA,
      diaDelMes: 1, fechaInicio: '2026-06-01',
    });

    recurrentes.materializarPendientes({ hasta: '2026-08-28' });
    const tras1 = contarMovimientos();
    assert.equal(recurrentes.materializarPendientes({ hasta: '2026-08-28' }).creados, 0);
    assert.equal(contarMovimientos(), tras1);
  });

  it('no genera un movimiento el día que aún no ha llegado', () => {
    recurrentes.crearRecurrente({
      nombre: 'Nómina', importe: 2400, tipo: 'ingreso', diaDelMes: 30, fechaInicio: '2026-08-30',
    });
    recurrentes.materializarPendientes({ hasta: '2026-08-28' });
    assert.equal(contarMovimientos(), 0);
  });

  it('ajusta el día 31 al último día de cada mes', () => {
    recurrentes.crearRecurrente({
      nombre: 'Cuota', importe: 30, tipo: 'gasto', diaDelMes: 31, fechaInicio: '2026-01-31',
    });
    recurrentes.materializarPendientes({ hasta: '2026-04-30' });
    assert.deepEqual(fechasGeneradas(), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('respeta la fecha de fin', () => {
    recurrentes.crearRecurrente({
      nombre: 'Gimnasio', importe: 40, tipo: 'gasto',
      diaDelMes: 5, fechaInicio: '2026-01-05', fechaFin: '2026-03-31',
    });
    recurrentes.materializarPendientes({ hasta: '2026-08-28' });
    assert.deepEqual(fechasGeneradas(), ['2026-01-05', '2026-02-05', '2026-03-05']);
  });

  it('ignora los pausados', () => {
    const fijo = recurrentes.crearRecurrente({
      nombre: 'Netflix', importe: 13, tipo: 'gasto', diaDelMes: 1, fechaInicio: '2026-01-01',
    });
    recurrentes.actualizarRecurrente(fijo.id, { activo: false });
    assert.equal(recurrentes.materializarPendientes({ hasta: '2026-08-28' }).creados, 0);
  });

  it('marca el origen y enlaza con la plantilla', () => {
    const fijo = recurrentes.crearRecurrente({
      nombre: 'Luz', importe: 60, tipo: 'gasto', diaDelMes: 10, fechaInicio: '2026-08-10',
    });
    recurrentes.materializarPendientes({ hasta: '2026-08-28' });

    const movimiento = bd.prepare('SELECT * FROM movimientos').get();
    assert.equal(movimiento.origen, 'recurrente');
    assert.equal(movimiento.recurrente_id, fijo.id);
    assert.equal(movimiento.descripcion, 'Luz');
  });
});

describe('validación y borrado de fijos', () => {
  it('rechaza una fecha de fin anterior al inicio', () => {
    assert.throws(
      () => recurrentes.crearRecurrente({
        nombre: 'X', importe: 10, tipo: 'gasto', diaDelMes: 1,
        fechaInicio: '2026-05-01', fechaFin: '2026-01-01',
      }),
      /no puede ser anterior/
    );
  });

  it('rechaza una categoría de otro tipo', () => {
    assert.throws(
      () => recurrentes.crearRecurrente({
        nombre: 'X', importe: 10, tipo: 'gasto', categoriaId: NOMINA, diaDelMes: 1, fechaInicio: '2026-05-01',
      }),
      /es de tipo ingreso/
    );
  });

  it('por defecto conserva el histórico al borrar la plantilla', () => {
    const fijo = recurrentes.crearRecurrente({
      nombre: 'Luz', importe: 60, tipo: 'gasto', diaDelMes: 10, fechaInicio: '2026-06-10',
    });
    recurrentes.materializarPendientes({ hasta: '2026-08-28' });
    const antes = contarMovimientos();

    const resultado = recurrentes.borrarRecurrente(fijo.id);
    assert.equal(resultado.generadosBorrados, 0);
    assert.equal(contarMovimientos(), antes, 'los movimientos ya ocurridos siguen ahí');
    assert.equal(bd.prepare('SELECT recurrente_id FROM movimientos').get().recurrente_id, null);
  });

  it('borra también los generados si se pide expresamente', () => {
    const fijo = recurrentes.crearRecurrente({
      nombre: 'Luz', importe: 60, tipo: 'gasto', diaDelMes: 10, fechaInicio: '2026-06-10',
    });
    recurrentes.materializarPendientes({ hasta: '2026-08-28' });

    const resultado = recurrentes.borrarRecurrente(fijo.id, { borrarGenerados: true });
    assert.equal(resultado.generadosBorrados, 3);
    assert.equal(contarMovimientos(), 0);
  });
});

describe('gastos que no son mensuales', () => {
  it('un gasto anual solo se genera una vez al año', () => {
    recurrentes.crearRecurrente({
      nombre: 'ITV', importe: 45, tipo: 'gasto', diaDelMes: 15,
      fechaInicio: '2024-03-15', periodicidad: 12,
    });
    recurrentes.materializarPendientes({ hasta: '2026-08-30' });

    assert.deepEqual(fechasGeneradas(), ['2024-03-15', '2025-03-15', '2026-03-15']);
  });

  it('un gasto semestral se genera cada seis meses, cruzando el año', () => {
    recurrentes.crearRecurrente({
      nombre: 'Taller', importe: 180, tipo: 'gasto', diaDelMes: 20,
      fechaInicio: '2025-10-20', periodicidad: 6,
    });
    recurrentes.materializarPendientes({ hasta: '2026-08-30' });

    assert.deepEqual(fechasGeneradas(), ['2025-10-20', '2026-04-20']);
  });

  it('prorratea el coste mensual equivalente', () => {
    const itv = recurrentes.crearRecurrente({
      nombre: 'ITV', importe: 45, tipo: 'gasto', diaDelMes: 15,
      fechaInicio: '2026-03-15', periodicidad: 12,
    });
    const seguro = recurrentes.crearRecurrente({
      nombre: 'Seguro', importe: 60, tipo: 'gasto', diaDelMes: 10, fechaInicio: '2026-01-10',
    });

    assert.equal(itv.costeMensual, 3.75, '45 / 12');
    assert.equal(itv.periodicidad, 12);
    assert.equal(seguro.costeMensual, 60, 'mensual: el coste es el importe');
  });

  it('el resumen de fijos suma costes mensuales, no importes brutos', () => {
    recurrentes.crearRecurrente({ nombre: 'Seguro', importe: 60, tipo: 'gasto', diaDelMes: 10, fechaInicio: '2020-01-10' });
    recurrentes.crearRecurrente({
      nombre: 'ITV', importe: 45, tipo: 'gasto', diaDelMes: 15, fechaInicio: '2020-03-15', periodicidad: 12,
    });
    recurrentes.crearRecurrente({
      nombre: 'Taller', importe: 180, tipo: 'gasto', diaDelMes: 20, fechaInicio: '2020-04-20', periodicidad: 6,
    });

    // 60 + 45/12 + 180/6 = 60 + 3,75 + 30 = 93,75
    assert.equal(recurrentes.resumenMensualFijos().gastosFijos, 93.75);
  });

  it('por defecto todo es mensual, sin tocar nada', () => {
    const fijo = recurrentes.crearRecurrente({
      nombre: 'Alquiler', importe: 500, tipo: 'gasto', diaDelMes: 1, fechaInicio: '2026-01-01',
    });

    assert.equal(fijo.periodicidad, 1);
    assert.equal(fijo.costeMensual, 500);
  });
});

describe('cambios de sueldo', () => {
  it('subir la nómina se refleja de inmediato, sin esperar meses', async () => {
    const { ingresoMensualRecurrente } = await import('../src/servicios/medias.js');

    const nomina = recurrentes.crearRecurrente({
      nombre: 'Nómina', importe: 1600, tipo: 'ingreso', diaDelMes: 25, fechaInicio: '2025-01-25',
    });
    recurrentes.materializarPendientes({ hasta: '2026-08-30' });

    assert.equal(ingresoMensualRecurrente().importe, 1600);

    recurrentes.actualizarRecurrente(nomina.id, { importe: 1800 });

    const despues = ingresoMensualRecurrente();
    assert.equal(despues.importe, 1800, 'la referencia usa la nómina declarada, no la mediana del histórico');
    assert.equal(despues.origen, 'nomina-declarada');
  });

  it('los movimientos ya cobrados conservan el importe antiguo', () => {
    const nomina = recurrentes.crearRecurrente({
      nombre: 'Nómina', importe: 1600, tipo: 'ingreso', diaDelMes: 25, fechaInicio: '2026-06-25',
    });
    recurrentes.materializarPendientes({ hasta: '2026-08-30' });

    recurrentes.actualizarRecurrente(nomina.id, { importe: 1800 });
    recurrentes.materializarPendientes({ hasta: '2026-08-30' });

    const importes = bd
      .prepare('SELECT importe_centimos FROM movimientos ORDER BY fecha')
      .all()
      .map((f) => f.importe_centimos);

    assert.deepEqual(importes, [160000, 160000, 160000], 'el histórico no se reescribe hacia atrás');
  });
});

describe('resumen de compromisos fijos', () => {
  it('suma solo los vigentes hoy', () => {
    recurrentes.crearRecurrente({ nombre: 'Nómina', importe: 2400, tipo: 'ingreso', diaDelMes: 25, fechaInicio: '2020-01-25' });
    recurrentes.crearRecurrente({ nombre: 'Alquiler', importe: 850, tipo: 'gasto', diaDelMes: 1, fechaInicio: '2020-01-01' });
    recurrentes.crearRecurrente({
      nombre: 'Caducado', importe: 500, tipo: 'gasto', diaDelMes: 1,
      fechaInicio: '2020-01-01', fechaFin: '2021-01-01',
    });

    const resumen = recurrentes.resumenMensualFijos();
    assert.equal(resumen.ingresosFijos, 2400);
    assert.equal(resumen.gastosFijos, 850, 'el caducado no cuenta');
    assert.equal(resumen.margenFijo, 1550);
  });
});
