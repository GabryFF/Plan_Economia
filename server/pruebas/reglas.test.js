import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { limpiarBD, vaciarDatos } from './ayuda.js';
import { cerrarBD, obtenerBD } from '../src/db/conexion.js';
import * as reglas from '../src/servicios/reglas.js';
import * as datos from '../src/servicios/datos.js';
import * as movimientos from '../src/servicios/movimientos.js';

const bd = obtenerBD();
const idCategoria = (nombre) => bd.prepare('SELECT id FROM categorias WHERE nombre = ?').get(nombre).id;

const ALIMENTACION = idCategoria('Alimentación');
const TRANSPORTE = idCategoria('Transporte');
const SUSCRIPCIONES = idCategoria('Suscripciones');
const NOMINA = idCategoria('Nómina');

beforeEach(() => {
  vaciarDatos(bd);
  bd.exec('DELETE FROM reglas');
});
after(() => { cerrarBD(); limpiarBD(); });

describe('gestión de reglas', () => {
  it('crea una regla y la coloca al final del orden', () => {
    const primera = reglas.crearRegla({ patron: 'MERCADONA', categoriaId: ALIMENTACION });
    const segunda = reglas.crearRegla({ patron: 'REPSOL', categoriaId: TRANSPORTE });

    assert.equal(primera.prioridad, 0);
    assert.equal(segunda.prioridad, 1);
    assert.equal(primera.coincidencia, 'contiene', 'por defecto');
    assert.equal(primera.categoriaNombre, 'Alimentación');
    assert.equal(primera.activa, true);
  });

  it('rechaza duplicados exactos y patrones vacíos', () => {
    reglas.crearRegla({ patron: 'MERCADONA', categoriaId: ALIMENTACION });

    assert.throws(
      () => reglas.crearRegla({ patron: 'mercadona', categoriaId: ALIMENTACION }),
      /Ya existe una regla/
    );
    assert.throws(() => reglas.crearRegla({ patron: '   ', categoriaId: ALIMENTACION }), /no puede estar vacío/);
  });

  it('rechaza una categoría inexistente', () => {
    assert.throws(() => reglas.crearRegla({ patron: 'X', categoriaId: 99999 }), /no existe/);
  });

  it('reordena intercambiando con la vecina y normaliza las prioridades', () => {
    const a = reglas.crearRegla({ patron: 'A', categoriaId: ALIMENTACION });
    const b = reglas.crearRegla({ patron: 'B', categoriaId: ALIMENTACION });
    reglas.crearRegla({ patron: 'C', categoriaId: ALIMENTACION });

    const trasSubir = reglas.moverRegla(b.id, 'subir');
    assert.deepEqual(trasSubir.map((r) => r.patron), ['B', 'A', 'C']);
    assert.deepEqual(trasSubir.map((r) => r.prioridad), [0, 1, 2]);

    // En el extremo no hace nada, en vez de fallar.
    const trasTope = reglas.moverRegla(trasSubir[0].id, 'subir');
    assert.deepEqual(trasTope.map((r) => r.patron), ['B', 'A', 'C']);

    reglas.borrarRegla(a.id);
    assert.equal(reglas.listarReglas().length, 2);
  });
});

describe('coincidencia de patrones', () => {
  it('ignora mayúsculas, tildes y espacios de relleno del banco', () => {
    reglas.crearRegla({ patron: 'mercadona', categoriaId: ALIMENTACION });

    const casos = [
      'COMPRA   MERCADONA  MADRID',
      'Pago en Mercadona',
      'compra mercadóna centro',
    ];

    for (const texto of casos) {
      assert.equal(reglas.categorizar(texto, 'gasto')?.categoriaId, ALIMENTACION, texto);
    }
  });

  it('soporta empieza, termina y exacto', () => {
    reglas.crearRegla({ patron: 'RECIBO', coincidencia: 'empieza', categoriaId: SUSCRIPCIONES });

    assert.ok(reglas.categorizar('RECIBO NETFLIX', 'gasto'));
    assert.equal(reglas.categorizar('PAGO RECIBO NETFLIX', 'gasto'), null, 'no empieza por RECIBO');

    bd.exec('DELETE FROM reglas');
    reglas.crearRegla({ patron: 'devolucion', coincidencia: 'termina', categoriaId: ALIMENTACION });
    assert.ok(reglas.categorizar('MERCADONA DEVOLUCION', 'gasto'));
    assert.equal(reglas.categorizar('DEVOLUCION MERCADONA', 'gasto'), null);

    bd.exec('DELETE FROM reglas');
    reglas.crearRegla({ patron: 'Nomina', coincidencia: 'exacto', categoriaId: NOMINA });
    assert.ok(reglas.categorizar('NÓMINA', 'ingreso'));
    assert.equal(reglas.categorizar('NOMINA AGOSTO', 'ingreso'), null);
  });

  it('gana la primera regla del orden, no la más específica', () => {
    reglas.crearRegla({ patron: 'AMAZON PRIME', categoriaId: SUSCRIPCIONES });
    const generica = reglas.crearRegla({ patron: 'AMAZON', categoriaId: ALIMENTACION });

    assert.equal(reglas.categorizar('COMPRA AMAZON PRIME', 'gasto').categoriaId, SUSCRIPCIONES);

    // Al subir la genérica, pasa a capturar también el caso específico.
    reglas.moverRegla(generica.id, 'subir');
    assert.equal(reglas.categorizar('COMPRA AMAZON PRIME', 'gasto').categoriaId, ALIMENTACION);
  });

  it('no aplica una regla de gasto a un ingreso', () => {
    reglas.crearRegla({ patron: 'MERCADONA', categoriaId: ALIMENTACION });

    assert.ok(reglas.categorizar('MERCADONA', 'gasto'));
    assert.equal(reglas.categorizar('DEVOLUCION MERCADONA', 'ingreso'), null, 'la categoría es de gasto');
  });

  it('ignora las reglas desactivadas', () => {
    const regla = reglas.crearRegla({ patron: 'MERCADONA', categoriaId: ALIMENTACION });
    reglas.actualizarRegla(regla.id, { activa: false });

    assert.equal(reglas.categorizar('MERCADONA', 'gasto'), null);
  });

  it('devuelve null con descripción vacía', () => {
    reglas.crearRegla({ patron: 'MERCADONA', categoriaId: ALIMENTACION });
    assert.equal(reglas.categorizar('', 'gasto'), null);
    assert.equal(reglas.categorizar(null, 'gasto'), null);
  });

  it('informa de qué regla ha casado, para poder explicarlo en la interfaz', () => {
    const regla = reglas.crearRegla({ patron: 'MERCADONA', categoriaId: ALIMENTACION });
    const encontrada = reglas.categorizar('COMPRA MERCADONA', 'gasto');

    assert.equal(encontrada.reglaId, regla.id);
    assert.equal(encontrada.patron, 'MERCADONA');
    assert.equal(encontrada.categoriaNombre, 'Alimentación');
  });
});

describe('sugerencias para la vista previa', () => {
  it('categoriza un lote respetando el tipo de cada fila', () => {
    reglas.crearRegla({ patron: 'MERCADONA', categoriaId: ALIMENTACION });
    reglas.crearRegla({ patron: 'NOMINA', categoriaId: NOMINA });

    const sugerencias = reglas.sugerirParaFilas([
      { descripcion: 'COMPRA MERCADONA', tipo: 'gasto' },
      { descripcion: 'NOMINA AGOSTO', tipo: 'ingreso' },
      { descripcion: 'BAR PEPE', tipo: 'gasto' },
      { descripcion: 'MERCADONA', tipo: 'ingreso' },
    ]);

    assert.equal(sugerencias[0].categoriaId, ALIMENTACION);
    assert.equal(sugerencias[1].categoriaId, NOMINA);
    assert.equal(sugerencias[2], null, 'sin regla que case');
    assert.equal(sugerencias[3], null, 'tipo incompatible');
  });
});

describe('reglas durante la importación', () => {
  const filas = [
    { fecha: '2026-08-01', importe: 64.35, descripcion: 'COMPRA MERCADONA MADRID', tipo: 'gasto', categoria: null },
    { fecha: '2026-08-02', importe: 60, descripcion: 'REPSOL E.S. 4471', tipo: 'gasto', categoria: null },
    { fecha: '2026-08-03', importe: 12, descripcion: 'BAR SIN REGLA', tipo: 'gasto', categoria: null },
  ];

  beforeEach(() => {
    reglas.crearRegla({ patron: 'MERCADONA', categoriaId: ALIMENTACION });
    reglas.crearRegla({ patron: 'REPSOL', categoriaId: TRANSPORTE });
  });

  it('categoriza automáticamente las filas sin categoría', () => {
    const resultado = datos.importarMovimientos({ movimientos: filas, crearCategorias: false });

    assert.equal(resultado.importados, 3);
    assert.equal(resultado.categorizadosPorRegla, 2);

    const guardados = movimientos.listarMovimientos({}).movimientos;
    const porDescripcion = Object.fromEntries(guardados.map((m) => [m.descripcion, m.categoriaNombre]));
    assert.equal(porDescripcion['COMPRA MERCADONA MADRID'], 'Alimentación');
    assert.equal(porDescripcion['REPSOL E.S. 4471'], 'Transporte');
    assert.equal(porDescripcion['BAR SIN REGLA'], null);
  });

  it('la categoría del fichero tiene prioridad sobre la regla', () => {
    const conCategoria = [{ ...filas[0], categoria: 'Ocio' }];
    const resultado = datos.importarMovimientos({ movimientos: conCategoria, crearCategorias: true });

    assert.equal(resultado.categorizadosPorRegla, 0);
    assert.equal(movimientos.listarMovimientos({}).movimientos[0].categoriaNombre, 'Ocio');
  });

  it('se pueden desactivar para una importación concreta', () => {
    const resultado = datos.importarMovimientos({ movimientos: filas, aplicarReglas: false });

    assert.equal(resultado.categorizadosPorRegla, 0);
    assert.ok(movimientos.listarMovimientos({}).movimientos.every((m) => m.categoriaId === null));
  });
});

describe('aplicar reglas al histórico', () => {
  it('recupera los movimientos que quedaron sin categoría', () => {
    movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 20, descripcion: 'COMPRA MERCADONA', tipo: 'gasto' });
    movimientos.crearMovimiento({ fecha: '2026-08-02', importe: 30, descripcion: 'REPSOL', tipo: 'gasto' });
    movimientos.crearMovimiento({ fecha: '2026-08-03', importe: 10, descripcion: 'BAR PEPE', tipo: 'gasto' });
    const yaCategorizado = movimientos.crearMovimiento({
      fecha: '2026-08-04', importe: 15, descripcion: 'MERCADONA', tipo: 'gasto', categoriaId: SUSCRIPCIONES,
    });

    reglas.crearRegla({ patron: 'MERCADONA', categoriaId: ALIMENTACION });
    reglas.crearRegla({ patron: 'REPSOL', categoriaId: TRANSPORTE });

    const resultado = reglas.aplicarAExistentes();

    assert.equal(resultado.revisados, 3, 'solo mira los que no tienen categoría');
    assert.equal(resultado.actualizados, 2);
    assert.deepEqual(resultado.porCategoria.map((c) => c.nombre).sort(), ['Alimentación', 'Transporte']);

    assert.equal(
      movimientos.obtenerMovimiento(yaCategorizado.id).categoriaNombre,
      'Suscripciones',
      'no se pisa una categoría ya asignada'
    );
  });

  it('es idempotente y no falla sin reglas', () => {
    movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 20, descripcion: 'COMPRA MERCADONA', tipo: 'gasto' });

    assert.deepEqual(reglas.aplicarAExistentes(), { revisados: 0, actualizados: 0, porCategoria: [] });

    reglas.crearRegla({ patron: 'MERCADONA', categoriaId: ALIMENTACION });
    assert.equal(reglas.aplicarAExistentes().actualizados, 1);
    assert.equal(reglas.aplicarAExistentes().actualizados, 0, 'ya no queda nada que categorizar');
  });
});
