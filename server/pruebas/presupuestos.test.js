import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { limpiarBD, vaciarDatos } from './ayuda.js';
import { cerrarBD, obtenerBD } from '../src/db/conexion.js';
import * as presupuestos from '../src/servicios/presupuestos.js';
import * as movimientos from '../src/servicios/movimientos.js';

const bd = obtenerBD();
const idCategoria = (nombre) => bd.prepare('SELECT id FROM categorias WHERE nombre = ?').get(nombre).id;
const ALIMENTACION = idCategoria('Alimentación');
const NOMINA = idCategoria('Nómina');

const filaDe = (resultado, categoriaId) => resultado.presupuestos.find((p) => p.categoriaId === categoriaId);

beforeEach(() => vaciarDatos(bd));
after(() => { cerrarBD(); limpiarBD(); });

describe('guardar presupuestos', () => {
  it('crea y luego actualiza sin duplicar (upsert)', () => {
    presupuestos.guardarPresupuesto({ categoriaId: ALIMENTACION, anio: 2026, mes: 8, importe: 300 });
    const resultado = presupuestos.guardarPresupuesto({ categoriaId: ALIMENTACION, anio: 2026, mes: 8, importe: 350 });

    assert.equal(filaDe(resultado, ALIMENTACION).presupuesto, 350);
    assert.equal(bd.prepare('SELECT COUNT(*) AS n FROM presupuestos').get().n, 1);
  });

  it('un importe de 0 elimina el presupuesto', () => {
    presupuestos.guardarPresupuesto({ categoriaId: ALIMENTACION, anio: 2026, mes: 8, importe: 300 });
    const resultado = presupuestos.guardarPresupuesto({ categoriaId: ALIMENTACION, anio: 2026, mes: 8, importe: 0 });

    assert.equal(filaDe(resultado, ALIMENTACION).presupuesto, null);
    assert.equal(bd.prepare('SELECT COUNT(*) AS n FROM presupuestos').get().n, 0);
  });

  it('no deja presupuestar categorías de ingreso', () => {
    assert.throws(
      () => presupuestos.guardarPresupuesto({ categoriaId: NOMINA, anio: 2026, mes: 8, importe: 100 }),
      /categorías de gasto/
    );
  });
});

describe('consumo del presupuesto', () => {
  const gastar = (importe, fecha) =>
    movimientos.crearMovimiento({ fecha, importe, tipo: 'gasto', categoriaId: ALIMENTACION });

  it('cuenta solo los gastos del mes presupuestado', () => {
    presupuestos.guardarPresupuesto({ categoriaId: ALIMENTACION, anio: 2026, mes: 8, importe: 300 });
    gastar(100, '2026-08-05');
    gastar(50, '2026-08-31');
    gastar(999, '2026-07-31'); // mes anterior: no debe contar
    gastar(999, '2026-09-01'); // mes siguiente: tampoco

    const fila = filaDe(presupuestos.listarPresupuestos({ anio: 2026, mes: 8 }), ALIMENTACION);
    assert.equal(fila.gastado, 150);
    assert.equal(fila.restante, 150);
    assert.equal(fila.porcentaje, 50);
    assert.equal(fila.estado, 'ok');
  });

  it('clasifica el estado en ok, riesgo y excedido', () => {
    presupuestos.guardarPresupuesto({ categoriaId: ALIMENTACION, anio: 2026, mes: 8, importe: 100 });

    gastar(85, '2026-08-05');
    assert.equal(filaDe(presupuestos.listarPresupuestos({ anio: 2026, mes: 8 }), ALIMENTACION).estado, 'riesgo');

    gastar(20, '2026-08-06');
    const excedido = filaDe(presupuestos.listarPresupuestos({ anio: 2026, mes: 8 }), ALIMENTACION);
    assert.equal(excedido.estado, 'excedido');
    assert.equal(excedido.restante, -5, 'el restante puede ser negativo');
    assert.equal(excedido.porcentaje, 105);
  });

  it('las categorías sin presupuesto no ensucian los totales', () => {
    presupuestos.guardarPresupuesto({ categoriaId: ALIMENTACION, anio: 2026, mes: 8, importe: 100 });
    gastar(40, '2026-08-05');
    movimientos.crearMovimiento({ fecha: '2026-08-05', importe: 500, tipo: 'gasto' }); // sin categoría

    const { totales } = presupuestos.listarPresupuestos({ anio: 2026, mes: 8 });
    assert.equal(totales.presupuestado, 100);
    assert.equal(totales.gastado, 40, 'solo cuenta el gasto de categorías presupuestadas');
    assert.equal(totales.restante, 60);
    assert.equal(totales.categoriasExcedidas, 0);
  });

  it('no divide por cero cuando no hay presupuesto', () => {
    const fila = filaDe(presupuestos.listarPresupuestos({ anio: 2026, mes: 8 }), ALIMENTACION);
    assert.equal(fila.presupuesto, null);
    assert.equal(fila.porcentaje, null);
    assert.equal(fila.estado, 'sin-presupuesto');
  });
});

describe('copiar del mes anterior', () => {
  it('copia los importes sin pisar los ya definidos', () => {
    presupuestos.guardarPresupuesto({ categoriaId: ALIMENTACION, anio: 2026, mes: 7, importe: 300 });
    const resultado = presupuestos.copiarDelMesAnterior({ anio: 2026, mes: 8 });

    assert.equal(resultado.copiados, 1);
    assert.equal(filaDe(resultado, ALIMENTACION).presupuesto, 300);

    presupuestos.guardarPresupuesto({ categoriaId: ALIMENTACION, anio: 2026, mes: 8, importe: 500 });
    const segunda = presupuestos.copiarDelMesAnterior({ anio: 2026, mes: 8 });
    assert.equal(segunda.copiados, 0, 'no vuelve a copiar');
    assert.equal(filaDe(segunda, ALIMENTACION).presupuesto, 500, 'respeta el valor ya fijado');
  });

  it('cruza bien el cambio de año', () => {
    presupuestos.guardarPresupuesto({ categoriaId: ALIMENTACION, anio: 2025, mes: 12, importe: 250 });
    const resultado = presupuestos.copiarDelMesAnterior({ anio: 2026, mes: 1 });

    assert.equal(resultado.copiados, 1);
    assert.equal(filaDe(resultado, ALIMENTACION).presupuesto, 250);
  });
});
