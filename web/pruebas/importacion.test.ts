import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parsearFecha, parsearImporte, prepararFilas, type Mapeo } from '../src/utiles/importacion.ts';

/**
 * El parseo de la importación vive en el navegador (la vista previa se calcula
 * sin llamar al servidor), así que se prueba aquí. Node 24 ejecuta TypeScript
 * directamente, sin paso de compilación.
 */

const MAPEO_BASE: Mapeo = {
  fecha: 'Fecha',
  importe: 'Importe',
  descripcion: 'Concepto',
  categoria: 'Categoria',
  tipo: 'Tipo',
  reglaTipo: 'signo',
};

describe('parsearImporte en el navegador', () => {
  it('conserva el signo, que es lo que decide ingreso o gasto', () => {
    assert.equal(parsearImporte('-45,20'), -45.2);
    assert.equal(parsearImporte('45,20'), 45.2);
    assert.equal(parsearImporte('(45,20)'), -45.2);
  });

  it('entiende ambos formatos de separadores', () => {
    assert.equal(parsearImporte('1.234,56'), 1234.56);
    assert.equal(parsearImporte('1,234.56'), 1234.56);
    assert.equal(parsearImporte('1,500'), 1500, 'tres decimales tras la coma son miles');
  });

  it('devuelve null ante valores no numéricos', () => {
    assert.equal(parsearImporte('pendiente'), null);
    assert.equal(parsearImporte(''), null);
    assert.equal(parsearImporte(null), null);
  });
});

describe('parsearFecha en el navegador', () => {
  it('coincide con el criterio del servidor: día primero', () => {
    assert.equal(parsearFecha('03/04/2026'), '2026-04-03');
    assert.equal(parsearFecha('2026-04-03'), '2026-04-03');
    assert.equal(parsearFecha('3-4-26'), '2026-04-03');
  });

  it('rechaza fechas imposibles', () => {
    assert.equal(parsearFecha('31/02/2026'), null);
    assert.equal(parsearFecha('sin fecha'), null);
  });
});

describe('prepararFilas: vista previa de la importación', () => {
  const filas = [
    { Fecha: '01/08/2026', Importe: '-64,35', Concepto: 'Compra', Categoria: 'Alimentación', Tipo: 'Cargo' },
    { Fecha: '25/08/2026', Importe: '2.400,00', Concepto: 'Nómina', Categoria: 'Nómina', Tipo: 'Abono' },
  ];

  it('deduce el tipo por el signo y devuelve el importe siempre en positivo', () => {
    const preparadas = prepararFilas(filas, MAPEO_BASE);

    assert.equal(preparadas[0].tipo, 'gasto');
    assert.equal(preparadas[0].importe, 64.35, 'el signo ya no viaja en el importe');
    assert.equal(preparadas[1].tipo, 'ingreso');
    assert.equal(preparadas[1].importe, 2400);
    assert.ok(preparadas.every((f) => f.errores.length === 0));
  });

  it('deduce el tipo por una columna de texto del banco', () => {
    const preparadas = prepararFilas(filas, { ...MAPEO_BASE, reglaTipo: 'columna' });

    assert.equal(preparadas[0].tipo, 'gasto', 'Cargo es gasto');
    assert.equal(preparadas[1].tipo, 'ingreso', 'Abono es ingreso');
  });

  it('permite forzar que todo el fichero sea de un tipo', () => {
    const todoGasto = prepararFilas(filas, { ...MAPEO_BASE, reglaTipo: 'todo-gasto' });
    assert.ok(todoGasto.every((f) => f.tipo === 'gasto'));

    const todoIngreso = prepararFilas(filas, { ...MAPEO_BASE, reglaTipo: 'todo-ingreso' });
    assert.ok(todoIngreso.every((f) => f.tipo === 'ingreso'));
  });

  it('marca las filas problemáticas en vez de descartarlas en silencio', () => {
    const conProblemas = [
      { Fecha: 'ayer', Importe: '10', Concepto: '', Categoria: '', Tipo: '' },
      { Fecha: '01/08/2026', Importe: 'pendiente', Concepto: '', Categoria: '', Tipo: '' },
      { Fecha: '01/08/2026', Importe: '0', Concepto: '', Categoria: '', Tipo: '' },
    ];

    const [sinFecha, sinImporte, aCero] = prepararFilas(conProblemas, MAPEO_BASE);

    assert.deepEqual(sinFecha.errores, ['Fecha no reconocida']);
    assert.deepEqual(sinImporte.errores, ['Importe no reconocido']);
    assert.deepEqual(aCero.errores, ['El importe es 0']);
    // Conservan su posición original para poder señalarlas en la tabla.
    assert.deepEqual([sinFecha.indice, sinImporte.indice, aCero.indice], [0, 1, 2]);
  });

  it('avisa cuando la columna de tipo trae un valor que no entiende', () => {
    const raro = [{ Fecha: '01/08/2026', Importe: '10', Concepto: '', Categoria: '', Tipo: 'movimiento raro' }];
    const [fila] = prepararFilas(raro, { ...MAPEO_BASE, reglaTipo: 'columna' });

    assert.equal(fila.tipo, null);
    assert.match(fila.errores[0], /No se entiende el tipo/);
  });

  it('trata la categoría vacía como ausente y recorta descripciones largas', () => {
    const largo = 'x'.repeat(300);
    const [fila] = prepararFilas(
      [{ Fecha: '01/08/2026', Importe: '10', Concepto: largo, Categoria: '   ', Tipo: '' }],
      MAPEO_BASE
    );

    assert.equal(fila.categoria, null);
    assert.equal(fila.descripcion.length, 200);
  });

  it('funciona sin columnas opcionales mapeadas', () => {
    const mapeoMinimo: Mapeo = { ...MAPEO_BASE, descripcion: '', categoria: '', tipo: '' };
    const [fila] = prepararFilas([{ Fecha: '01/08/2026', Importe: '-10' }], mapeoMinimo);

    assert.equal(fila.errores.length, 0);
    assert.equal(fila.descripcion, '');
    assert.equal(fila.categoria, null);
    assert.equal(fila.tipo, 'gasto');
  });
});
