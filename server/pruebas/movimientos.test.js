import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { limpiarBD, vaciarDatos } from './ayuda.js';
import { cerrarBD, obtenerBD } from '../src/db/conexion.js';
import * as movimientos from '../src/servicios/movimientos.js';

const bd = obtenerBD();
const idCategoria = (nombre) => bd.prepare('SELECT id FROM categorias WHERE nombre = ?').get(nombre).id;

const ALIMENTACION = idCategoria('Alimentación');
const NOMINA = idCategoria('Nómina');

beforeEach(() => vaciarDatos(bd));
after(() => { cerrarBD(); limpiarBD(); });

describe('CRUD de movimientos', () => {
  it('crea y recupera un movimiento con su categoría', () => {
    const creado = movimientos.crearMovimiento({
      fecha: '2026-08-10', importe: 64.35, descripcion: 'Compra', tipo: 'gasto', categoriaId: ALIMENTACION,
    });

    assert.equal(creado.importe, 64.35);
    assert.equal(creado.categoriaNombre, 'Alimentación');
    assert.equal(creado.origen, 'manual');
    // Se guarda en céntimos enteros, no en flotante.
    const fila = bd.prepare('SELECT importe_centimos FROM movimientos WHERE id = ?').get(creado.id);
    assert.equal(fila.importe_centimos, 6435);
  });

  it('rechaza una categoría de tipo incompatible', () => {
    assert.throws(
      () => movimientos.crearMovimiento({ fecha: '2026-08-10', importe: 10, tipo: 'ingreso', categoriaId: ALIMENTACION }),
      /es de tipo gasto/
    );
  });

  it('rechaza una categoría inexistente', () => {
    assert.throws(
      () => movimientos.crearMovimiento({ fecha: '2026-08-10', importe: 10, tipo: 'gasto', categoriaId: 99999 }),
      /no existe/
    );
  });

  it('al cambiar de tipo desasigna la categoría que deja de ser válida', () => {
    const creado = movimientos.crearMovimiento({
      fecha: '2026-08-10', importe: 20, tipo: 'gasto', categoriaId: ALIMENTACION,
    });

    const actualizado = movimientos.actualizarMovimiento(creado.id, { tipo: 'ingreso' });
    assert.equal(actualizado.tipo, 'ingreso');
    assert.equal(actualizado.categoriaId, null);
  });

  it('actualiza sin perder los campos no enviados', () => {
    const creado = movimientos.crearMovimiento({
      fecha: '2026-08-10', importe: 20, descripcion: 'Original', tipo: 'gasto', categoriaId: ALIMENTACION,
    });

    const actualizado = movimientos.actualizarMovimiento(creado.id, { importe: 25 });
    assert.equal(actualizado.importe, 25);
    assert.equal(actualizado.descripcion, 'Original');
    assert.equal(actualizado.categoriaId, ALIMENTACION);
    assert.ok(actualizado.actualizadoEn);
  });

  it('borra y luego falla al buscarlo', () => {
    const creado = movimientos.crearMovimiento({ fecha: '2026-08-10', importe: 20, tipo: 'gasto' });
    assert.deepEqual(movimientos.borrarMovimiento(creado.id), { borrado: true });
    assert.throws(() => movimientos.obtenerMovimiento(creado.id), /no encontrado/);
    assert.throws(() => movimientos.borrarMovimiento(creado.id), /no encontrado/);
  });
});

describe('listado, filtros y totales', () => {
  beforeEach(() => {
    movimientos.crearMovimiento({ fecha: '2026-07-01', importe: 100, descripcion: 'Julio', tipo: 'gasto', categoriaId: ALIMENTACION });
    movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 50, descripcion: 'Agosto', tipo: 'gasto' });
    movimientos.crearMovimiento({ fecha: '2026-08-25', importe: 2000, descripcion: 'Nómina', tipo: 'ingreso', categoriaId: NOMINA });
  });

  it('calcula los totales del conjunto filtrado, no solo de la página', () => {
    const { totales, total } = movimientos.listarMovimientos({ porPagina: 1 });
    assert.equal(total, 3);
    assert.equal(totales.ingresos, 2000);
    assert.equal(totales.gastos, 150);
    assert.equal(totales.balance, 1850);
  });

  it('filtra por rango de fechas incluyendo los extremos', () => {
    const { total, totales } = movimientos.listarMovimientos({ desde: '2026-08-01', hasta: '2026-08-25' });
    assert.equal(total, 2);
    assert.equal(totales.gastos, 50);
  });

  it('filtra por tipo y por categoría', () => {
    assert.equal(movimientos.listarMovimientos({ tipo: 'ingreso' }).total, 1);
    assert.equal(movimientos.listarMovimientos({ categoriaId: ALIMENTACION }).total, 1);
  });

  it('busca en la descripción y en el nombre de la categoría', () => {
    assert.equal(movimientos.listarMovimientos({ texto: 'agosto' }).total, 1, 'la búsqueda ignora mayúsculas');
    assert.equal(movimientos.listarMovimientos({ texto: 'aliment' }).total, 1, 'busca también por categoría');
  });

  it('pagina y ordena de más reciente a más antiguo', () => {
    const pagina = movimientos.listarMovimientos({ porPagina: 2, pagina: 1 });
    assert.equal(pagina.paginas, 2);
    assert.equal(pagina.movimientos[0].fecha, '2026-08-25');
    assert.equal(movimientos.listarMovimientos({ porPagina: 2, pagina: 2 }).movimientos.length, 1);
  });
});

describe('deshacer un borrado', () => {
  const datos = {
    fecha: '2026-08-10', importe: 64.35, descripcion: 'Compra', tipo: 'gasto', categoriaId: ALIMENTACION,
  };

  it('devuelve el movimiento tal y como estaba', () => {
    const original = movimientos.crearMovimiento(datos);
    movimientos.borrarMovimiento(original.id);

    const vuelto = movimientos.restaurarMovimiento({ ...datos, origen: 'manual', recurrenteId: null });

    assert.equal(vuelto.importe, 64.35);
    assert.equal(vuelto.descripcion, 'Compra');
    assert.equal(vuelto.fecha, '2026-08-10');
    assert.equal(vuelto.categoriaNombre, 'Alimentación');
    assert.notEqual(vuelto.id, original.id, 'es una fila nueva, no resucita el id');
  });

  it('conserva el origen: un movimiento importado no se convierte en manual', () => {
    const vuelto = movimientos.restaurarMovimiento({ ...datos, origen: 'importacion', recurrenteId: null });
    assert.equal(vuelto.origen, 'importacion');
  });

  it('conserva el vínculo con el gasto fijo que lo generó', async () => {
    const recurrentes = await import('../src/servicios/recurrentes.js');
    const fijo = recurrentes.crearRecurrente({
      nombre: 'Gimnasio', importe: 40, tipo: 'gasto', categoriaId: ALIMENTACION,
      diaDelMes: 1, fechaInicio: '2026-08-01',
    });
    recurrentes.materializarPendientes();

    const recibo = bd.prepare('SELECT id, fecha FROM movimientos WHERE recurrente_id = ?').get(fijo.id);
    movimientos.borrarMovimiento(recibo.id);

    const vuelto = movimientos.restaurarMovimiento({
      fecha: recibo.fecha, importe: 40, descripcion: 'Gimnasio', tipo: 'gasto',
      categoriaId: ALIMENTACION, origen: 'recurrente', recurrenteId: fijo.id,
    });

    assert.equal(vuelto.recurrenteId, fijo.id, 'sin el vínculo, el recibo se volvería a generar duplicado');

    // Y con el vínculo puesto, materializar de nuevo no lo duplica.
    recurrentes.materializarPendientes();
    const { n } = bd.prepare('SELECT COUNT(*) AS n FROM movimientos WHERE recurrente_id = ?').get(fijo.id);
    assert.equal(n, 1);
  });

  it('no recupera un recibo que la aplicación ya ha vuelto a generar', async () => {
    const recurrentes = await import('../src/servicios/recurrentes.js');
    const fijo = recurrentes.crearRecurrente({
      nombre: 'Luz', importe: 50, tipo: 'gasto', categoriaId: ALIMENTACION,
      diaDelMes: 1, fechaInicio: '2026-08-01',
    });
    recurrentes.materializarPendientes();
    const recibo = bd.prepare('SELECT fecha FROM movimientos WHERE recurrente_id = ?').get(fijo.id);

    assert.throws(
      () => movimientos.restaurarMovimiento({
        fecha: recibo.fecha, importe: 50, descripcion: 'Luz', tipo: 'gasto',
        categoriaId: ALIMENTACION, origen: 'recurrente', recurrenteId: fijo.id,
      }),
      /ya se ha vuelto a generar/
    );
  });
});
