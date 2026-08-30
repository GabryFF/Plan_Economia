import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { limpiarBD, vaciarDatos } from './ayuda.js';
import { cerrarBD, obtenerBD } from '../src/db/conexion.js';
import * as resumen from '../src/servicios/resumen.js';
import * as movimientos from '../src/servicios/movimientos.js';
import * as recurrentes from '../src/servicios/recurrentes.js';
import { primerDiaDelMes, ultimoDiaDelMes } from '../src/utiles/fechas.js';

const bd = obtenerBD();
const idCategoria = (nombre) => bd.prepare('SELECT id FROM categorias WHERE nombre = ?').get(nombre).id;
const ALIMENTACION = idCategoria('Alimentación');
const VIVIENDA = idCategoria('Vivienda');
const NOMINA = idCategoria('Nómina');

const hoy = new Date();
const ANIO = hoy.getFullYear();
const MES = hoy.getMonth() + 1;
const enEsteMes = (dia) => `${ANIO}-${String(MES).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

beforeEach(() => vaciarDatos(bd));
after(() => { cerrarBD(); limpiarBD(); });

describe('resumen general', () => {
  beforeEach(() => {
    movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 2000, tipo: 'ingreso', categoriaId: NOMINA });
    movimientos.crearMovimiento({ fecha: '2026-08-02', importe: 750, tipo: 'gasto', categoriaId: VIVIENDA });
    movimientos.crearMovimiento({ fecha: '2026-08-03', importe: 250, tipo: 'gasto', categoriaId: ALIMENTACION });
  });

  const deAgosto = () => resumen.resumenGeneral({ desde: '2026-08-01', hasta: '2026-08-31' });

  it('calcula balance y tasa de ahorro', () => {
    const r = deAgosto();
    assert.equal(r.ingresos, 2000);
    assert.equal(r.gastos, 1000);
    assert.equal(r.balance, 1000);
    assert.equal(r.tasaAhorro, 50);
    assert.equal(r.movimientos, 3);
  });

  it('desglosa por categoría con porcentajes que suman 100', () => {
    const { gastosPorCategoria } = deAgosto();
    assert.equal(gastosPorCategoria.length, 2);
    assert.equal(gastosPorCategoria[0].nombre, 'Vivienda', 'ordenado de mayor a menor');
    assert.equal(gastosPorCategoria[0].porcentaje, 75);
    assert.equal(gastosPorCategoria[1].porcentaje, 25);
    assert.equal(gastosPorCategoria.reduce((s, c) => s + c.porcentaje, 0), 100);
  });

  it('agrupa los movimientos sin categoría en vez de descartarlos', () => {
    movimientos.crearMovimiento({ fecha: '2026-08-04', importe: 100, tipo: 'gasto' });
    const sinCategoria = deAgosto().gastosPorCategoria.find((c) => c.categoriaId === null);

    assert.ok(sinCategoria, 'aparece una fila "Sin categoría"');
    assert.equal(sinCategoria.nombre, 'Sin categoría');
    assert.equal(sinCategoria.total, 100);
  });

  it('devuelve tasa de ahorro nula si no hay ingresos, sin dividir por cero', () => {
    vaciarDatos(bd);
    movimientos.crearMovimiento({ fecha: '2026-08-02', importe: 100, tipo: 'gasto' });

    const r = deAgosto();
    assert.equal(r.tasaAhorro, null);
    assert.equal(r.balance, -100);
  });

  it('el rango vacío significa todo el histórico', () => {
    movimientos.crearMovimiento({ fecha: '2020-01-01', importe: 500, tipo: 'ingreso' });
    assert.equal(resumen.resumenGeneral({}).ingresos, 2500);
    assert.equal(deAgosto().ingresos, 2000);
  });
});

describe('evolución mensual', () => {
  it('devuelve una serie continua, rellenando los meses sin movimientos', () => {
    movimientos.crearMovimiento({ fecha: enEsteMes(5), importe: 1000, tipo: 'ingreso' });

    const serie = resumen.evolucionMensual({ meses: 6 });
    assert.equal(serie.length, 6, 'sin huecos aunque falten meses');
    assert.equal(serie.at(-1).ingresos, 1000, 'el último punto es el mes en curso');
    assert.ok(serie.every((punto) => typeof punto.balance === 'number'));
    assert.ok(serie.at(-1).etiqueta.length > 0);
  });

  it('el balance de cada punto es ingresos menos gastos', () => {
    movimientos.crearMovimiento({ fecha: enEsteMes(5), importe: 1000, tipo: 'ingreso' });
    movimientos.crearMovimiento({ fecha: enEsteMes(6), importe: 400, tipo: 'gasto' });

    const ultimo = resumen.evolucionMensual({ meses: 3 }).at(-1);
    assert.equal(ultimo.ingresos, 1000);
    assert.equal(ultimo.gastos, 400);
    assert.equal(ultimo.balance, 600);
  });
});

describe('panel de ahorro', () => {
  it('separa el gasto fijo del variable en el mes en curso', () => {
    recurrentes.crearRecurrente({
      nombre: 'Alquiler', importe: 850, tipo: 'gasto', categoriaId: VIVIENDA,
      diaDelMes: 1, fechaInicio: primerDiaDelMes(ANIO, MES),
    });
    recurrentes.materializarPendientes();
    movimientos.crearMovimiento({ fecha: enEsteMes(2), importe: 150, tipo: 'gasto', categoriaId: ALIMENTACION });

    const panel = resumen.panelAhorro();
    assert.equal(panel.mesActual.gastoFijo, 850);
    assert.equal(panel.mesActual.gastoVariable, 150);
  });

  it('mide el peso de los fijos sobre los ingresos fijos', () => {
    recurrentes.crearRecurrente({ nombre: 'Nómina', importe: 2000, tipo: 'ingreso', diaDelMes: 25, fechaInicio: '2020-01-25' });
    recurrentes.crearRecurrente({ nombre: 'Alquiler', importe: 500, tipo: 'gasto', diaDelMes: 1, fechaInicio: '2020-01-01' });

    const { compromisosFijos } = resumen.panelAhorro();
    assert.equal(compromisosFijos.ingresosFijos, 2000);
    assert.equal(compromisosFijos.gastosFijos, 500);
    assert.equal(compromisosFijos.pesoSobreIngresos, 25);
    assert.equal(compromisosFijos.mayores[0].nombre, 'Alquiler');
    assert.equal(compromisosFijos.mayores[0].porcentajeIngresosFijos, 25);
  });

  it('excluye el mes en curso de la media, por estar incompleto', () => {
    // Un gasto enorme hoy no debe hundir la media de los meses ya cerrados.
    movimientos.crearMovimiento({ fecha: enEsteMes(1), importe: 9999, tipo: 'gasto' });
    const panel = resumen.panelAhorro({ meses: 3 });

    assert.equal(panel.mesActual.gastos, 9999);
    assert.equal(panel.mediaMensual.gastos, 0);
  });

  it('no rompe con la base de datos vacía', () => {
    const panel = resumen.panelAhorro();
    assert.equal(panel.mesActual.ingresos, 0);
    assert.equal(panel.mediaMensual.meses, 0);
    assert.equal(panel.mediaMensual.tasaAhorro, null);
    assert.equal(panel.proyeccionAnual, 0);
    assert.deepEqual(panel.compromisosFijos.mayores, []);
  });

  it('proyecta a doce meses la media de ahorro', () => {
    const mesPasado = new Date(ANIO, MES - 2, 15);
    const fecha = `${mesPasado.getFullYear()}-${String(mesPasado.getMonth() + 1).padStart(2, '0')}-15`;
    movimientos.crearMovimiento({ fecha, importe: 1000, tipo: 'ingreso' });

    const panel = resumen.panelAhorro({ meses: 3 });
    assert.equal(panel.mediaMensual.ahorro * 12, panel.proyeccionAnual);
  });
});

describe('coherencia entre vistas', () => {
  it('el resumen del mes coincide con el total del listado filtrado', () => {
    movimientos.crearMovimiento({ fecha: enEsteMes(3), importe: 1234.56, tipo: 'ingreso' });
    movimientos.crearMovimiento({ fecha: enEsteMes(4), importe: 78.9, tipo: 'gasto' });

    const rango = { desde: primerDiaDelMes(ANIO, MES), hasta: ultimoDiaDelMes(ANIO, MES) };
    const r = resumen.resumenGeneral(rango);
    const { totales } = movimientos.listarMovimientos(rango);

    assert.equal(r.ingresos, totales.ingresos);
    assert.equal(r.gastos, totales.gastos);
    assert.equal(r.balance, totales.balance);
  });
});
