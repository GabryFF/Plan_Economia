import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { limpiarBD, vaciarDatos } from './ayuda.js';
import { cerrarBD, obtenerBD } from '../src/db/conexion.js';
import * as categorias from '../src/servicios/categorias.js';
import * as movimientos from '../src/servicios/movimientos.js';

const bd = obtenerBD();
const idDe = (nombre) => bd.prepare('SELECT id FROM categorias WHERE nombre = ?').get(nombre)?.id;

beforeEach(() => {
  vaciarDatos(bd);
  bd.prepare("DELETE FROM categorias WHERE nombre IN ('Mascota', 'mascota', 'Extra')").run();
});
after(() => { cerrarBD(); limpiarBD(); });

describe('listado de categorías', () => {
  it('trae las iniciales con su recuento de movimientos', () => {
    const alimentacion = idDe('Alimentación');
    movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 10, tipo: 'gasto', categoriaId: alimentacion });
    movimientos.crearMovimiento({ fecha: '2026-08-02', importe: 20, tipo: 'gasto', categoriaId: alimentacion });

    const fila = categorias.listarCategorias().find((c) => c.id === alimentacion);
    assert.equal(fila.movimientos, 2);
    assert.equal(fila.archivada, false);
  });

  it('oculta las archivadas salvo que se pidan', () => {
    const ocio = idDe('Ocio');
    categorias.actualizarCategoria(ocio, { archivada: true });

    assert.ok(!categorias.listarCategorias().some((c) => c.id === ocio));
    assert.ok(categorias.listarCategorias({ incluirArchivadas: true }).some((c) => c.id === ocio));
  });

  it('ordena poniendo los ingresos primero', () => {
    const tipos = categorias.listarCategorias().map((c) => c.tipo);
    assert.equal(tipos[0], 'ingreso', 'los ingresos van antes que los gastos');
  });
});

describe('crear y editar', () => {
  it('crea con color y devuelve el objeto completo', () => {
    const creada = categorias.crearCategoria({ nombre: 'Mascota', tipo: 'gasto', color: '#123456' });

    assert.equal(creada.nombre, 'Mascota');
    assert.equal(creada.color, '#123456');
    assert.equal(creada.movimientos, 0);
  });

  it('rechaza duplicados del mismo tipo ignorando mayúsculas', () => {
    categorias.crearCategoria({ nombre: 'Mascota', tipo: 'gasto', color: '#123456' });

    assert.throws(
      () => categorias.crearCategoria({ nombre: 'mascota', tipo: 'gasto', color: '#000000' }),
      /Ya existe una categoría/
    );
  });

  it('permite el mismo nombre en tipos distintos', () => {
    categorias.crearCategoria({ nombre: 'Extra', tipo: 'gasto', color: '#123456' });
    const ingreso = categorias.crearCategoria({ nombre: 'Extra', tipo: 'ingreso', color: '#123456' });

    assert.equal(ingreso.tipo, 'ingreso', 'un gasto y un ingreso pueden llamarse igual');
  });

  it('al editar tampoco deja chocar con otra existente', () => {
    const mascota = categorias.crearCategoria({ nombre: 'Mascota', tipo: 'gasto', color: '#123456' });

    assert.throws(
      () => categorias.actualizarCategoria(mascota.id, { nombre: 'Ocio' }),
      /Ya existe una categoría/
    );
  });

  it('falla al pedir una categoría inexistente', () => {
    assert.throws(() => categorias.obtenerCategoria(99999), /Categoría no encontrada/);
  });
});

describe('borrado protegido', () => {
  it('no borra una categoría con movimientos sin forzar', () => {
    const mascota = categorias.crearCategoria({ nombre: 'Mascota', tipo: 'gasto', color: '#123456' });
    movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 10, tipo: 'gasto', categoriaId: mascota.id });

    assert.throws(() => categorias.borrarCategoria(mascota.id), /Archívala/);
    assert.ok(categorias.obtenerCategoria(mascota.id), 'sigue existiendo');
  });

  it('al forzar, el movimiento sobrevive sin categoría', () => {
    const mascota = categorias.crearCategoria({ nombre: 'Mascota', tipo: 'gasto', color: '#123456' });
    const movimiento = movimientos.crearMovimiento({
      fecha: '2026-08-01', importe: 10, tipo: 'gasto', categoriaId: mascota.id,
    });

    const resultado = categorias.borrarCategoria(mascota.id, { forzar: true });

    assert.equal(resultado.movimientosAfectados, 1);
    assert.equal(movimientos.obtenerMovimiento(movimiento.id).categoriaId, null, 'nunca se borran datos económicos');
  });

  it('una categoría sin movimientos se borra sin ceremonia', () => {
    const mascota = categorias.crearCategoria({ nombre: 'Mascota', tipo: 'gasto', color: '#123456' });
    assert.deepEqual(categorias.borrarCategoria(mascota.id), { borrada: true, movimientosAfectados: 0 });
  });
});

describe('buscarOCrearPorNombre (lo usa la importación)', () => {
  it('encuentra la existente sin distinguir mayúsculas ni tipo equivocado', () => {
    const alimentacion = idDe('Alimentación');

    assert.equal(categorias.buscarOCrearPorNombre('alimentación', 'gasto'), alimentacion);
    assert.equal(categorias.buscarOCrearPorNombre('Alimentación', 'ingreso'), null, 'el tipo tiene que coincidir');
  });

  it('no crea nada si no se autoriza', () => {
    assert.equal(categorias.buscarOCrearPorNombre('Mascota', 'gasto'), null);
    assert.equal(idDe('Mascota'), undefined);
  });

  it('crea cuando se autoriza', () => {
    const id = categorias.buscarOCrearPorNombre('Mascota', 'gasto', { crear: true });

    assert.ok(id > 0);
    assert.equal(categorias.obtenerCategoria(id).nombre, 'Mascota');
  });
});
