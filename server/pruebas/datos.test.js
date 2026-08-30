import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { limpiarBD, vaciarDatos } from './ayuda.js';
import { cerrarBD, obtenerBD } from '../src/db/conexion.js';
import * as XLSX from 'xlsx';
import * as datos from '../src/servicios/datos.js';
import * as movimientos from '../src/servicios/movimientos.js';

const bd = obtenerBD();
const ALIMENTACION = bd.prepare("SELECT id FROM categorias WHERE nombre = 'Alimentación'").get().id;

beforeEach(() => {
  vaciarDatos(bd);
  bd.prepare("DELETE FROM categorias WHERE nombre = 'Cafetería'").run();
});
after(() => { cerrarBD(); limpiarBD(); });

describe('exportación', () => {
  beforeEach(() => {
    movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 64.35, descripcion: 'Compra', tipo: 'gasto', categoriaId: ALIMENTACION });
    movimientos.crearMovimiento({ fecha: '2026-08-25', importe: 2400, descripcion: 'Nómina', tipo: 'ingreso' });
  });

  it('genera un CSV con BOM y punto y coma, que es lo que abre Excel en España', () => {
    const { contenido, extension, filas } = datos.exportar({}, 'csv');
    const texto = contenido.toString('utf8');

    assert.equal(extension, 'csv');
    assert.equal(filas, 2);
    assert.ok(texto.startsWith('\uFEFF'), 'lleva BOM');
    assert.ok(texto.includes('Fecha;Tipo;Categoría;Descripción;Importe'));
    assert.ok(texto.includes('2026-08-01;Gasto;Alimentación;Compra;64.35'));
  });

  it('genera un XLSX no vacío', () => {
    const { contenido, extension } = datos.exportar({}, 'xlsx');
    assert.equal(extension, 'xlsx');
    assert.ok(contenido.length > 1000);
    assert.equal(contenido.subarray(0, 2).toString('utf8'), 'PK', 'un xlsx es un zip');
  });

  it('respeta los filtros de fecha', () => {
    assert.equal(datos.exportar({ desde: '2026-08-10' }, 'csv').filas, 1);
  });
});

describe('copia de seguridad', () => {
  it('produce una base de datos válida y completa', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');

    movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 10, tipo: 'gasto', categoriaId: ALIMENTACION });

    const copia = datos.copiaSeguridad();
    assert.ok(copia.tamano > 0);
    assert.match(copia.nombre, /^copia-gastos-\d{4}-\d{2}-\d{2}\.db$/);

    // Se abre la copia para comprobar que no es un fichero corrupto.
    const ruta = path.join(os.tmpdir(), `verificar-${Date.now()}.db`);
    fs.writeFileSync(ruta, copia.contenido);

    const copiada = new DatabaseSync(ruta);
    assert.equal(copiada.prepare('SELECT COUNT(*) AS c FROM movimientos').get().c, 1);
    assert.ok(copiada.prepare('SELECT COUNT(*) AS c FROM categorias').get().c > 0);
    copiada.close();
    fs.rmSync(ruta, { force: true });
  });
});

describe('análisis del fichero a importar', () => {
  it('detecta las columnas exportadas por la propia aplicación (ida y vuelta)', () => {
    movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 10, descripcion: 'X', tipo: 'gasto', categoriaId: ALIMENTACION });
    const { contenido } = datos.exportar({}, 'xlsx');

    const analisis = datos.analizarFichero(contenido, 'export.xlsx');
    assert.deepEqual(analisis.columnas, ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Importe']);
    assert.deepEqual(analisis.sugerencia, {
      fecha: 'Fecha', importe: 'Importe', descripcion: 'Descripción', categoria: 'Categoría', tipo: 'Tipo',
    });
    assert.equal(analisis.totalFilas, 1);
  });

  it('reconoce cabeceras típicas de un extracto bancario', () => {
    const csv = Buffer.from(
      'Fecha valor;Concepto;Importe;Categoria\n2026-08-01;Compra;-20,00;Ocio\n',
      'utf8'
    );
    const analisis = datos.analizarFichero(csv, 'banco.csv');

    assert.equal(analisis.sugerencia.fecha, 'Fecha valor');
    assert.equal(analisis.sugerencia.descripcion, 'Concepto');
    assert.equal(analisis.sugerencia.importe, 'Importe');
    assert.equal(analisis.sugerencia.categoria, 'Categoria', 'sin tilde también');
  });

  it('no reinterpreta las fechas españolas del CSV', () => {
    // SheetJS leía "01/08/2026" como fecha estadounidense (8 de enero) y la
    // reescribía: las filas con día <= 12 acababan importadas con otro mes.
    const csv = Buffer.from(
      [
        'Fecha;Concepto;Importe',
        '01/08/2026;Uno;-10,00',
        '05/08/2026;Cinco;-20,00',
        '12/08/2026;Doce;-30,00',
        '18/08/2026;Dieciocho;-40,00',
      ].join('\n'),
      'utf8'
    );

    const fechas = datos.analizarFichero(csv, 'banco.csv').filas.map((f) => f.Fecha);
    assert.deepEqual(fechas, ['01/08/2026', '05/08/2026', '12/08/2026', '18/08/2026']);
  });

  it('conserva los importes del CSV tal cual, sin convertirlos a número', () => {
    const csv = Buffer.from(['Fecha;Concepto;Importe', '01/08/2026;Uno;-1.234,56'].join('\n'), 'utf8');
    assert.equal(datos.analizarFichero(csv, 'banco.csv').filas[0].Importe, '-1.234,56');
  });

  it('convierte a ISO las fechas con tipo de un Excel real', () => {
    // En un .xlsx la fecha es una celda tipada; debe llegar como AAAA-MM-DD
    // sin que el paso por UTC le reste un día.
    const hoja = XLSX.utils.aoa_to_sheet([
      ['Fecha', 'Concepto', 'Importe'],
      [new Date(2026, 7, 1), 'Uno', -10],
    ]);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Movimientos');
    const binario = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx', cellDates: true });

    const fila = datos.analizarFichero(binario, 'banco.xlsx').filas[0];
    assert.equal(fila.Fecha, '2026-08-01');
  });

  it('rechaza un fichero sin filas', () => {
    assert.throws(() => datos.analizarFichero(Buffer.from('', 'utf8'), 'vacio.csv'), /no contiene/);
  });
});

describe('importación', () => {
  const filas = [
    { fecha: '2026-08-01', importe: 12.5, descripcion: 'Café', tipo: 'gasto', categoria: 'Cafetería' },
    { fecha: '2026-08-02', importe: 30, descripcion: 'Libro', tipo: 'gasto', categoria: 'Alimentación' },
  ];

  it('crea las categorías que faltan cuando se autoriza', () => {
    const resultado = datos.importarMovimientos({ movimientos: filas, crearCategorias: true });

    assert.equal(resultado.importados, 2);
    assert.deepEqual(resultado.categoriasCreadas, ['Cafetería (gasto)']);
    assert.equal(resultado.sinCategoria.length, 0);
    assert.equal(bd.prepare("SELECT COUNT(*) AS n FROM categorias WHERE nombre = 'Cafetería'").get().n, 1);
  });

  it('deja el movimiento sin categoría si no se autoriza a crearla', () => {
    const resultado = datos.importarMovimientos({ movimientos: filas, crearCategorias: false });

    assert.equal(resultado.importados, 2);
    assert.deepEqual(resultado.categoriasCreadas, []);
    assert.deepEqual(resultado.sinCategoria, [{ fila: 1, categoria: 'Cafetería' }]);
    assert.equal(bd.prepare("SELECT COUNT(*) AS n FROM categorias WHERE nombre = 'Cafetería'").get().n, 0);
  });

  it('reutiliza la categoría existente sin importar mayúsculas ni duplicarla', () => {
    datos.importarMovimientos({
      movimientos: [{ fecha: '2026-08-01', importe: 5, tipo: 'gasto', categoria: 'alimentación' }],
      crearCategorias: true,
    });

    assert.equal(bd.prepare("SELECT COUNT(*) AS n FROM categorias WHERE nombre LIKE 'aliment%'").get().n, 1);
    assert.equal(bd.prepare('SELECT categoria_id FROM movimientos').get().categoria_id, ALIMENTACION);
  });

  it('marca el origen como importación', () => {
    datos.importarMovimientos({ movimientos: filas, crearCategorias: true });
    const origenes = bd.prepare('SELECT DISTINCT origen FROM movimientos').all().map((f) => f.origen);
    assert.deepEqual(origenes, ['importacion']);
  });

  it('es atómica: si una fila falla no se importa ninguna', () => {
    const conFilaMala = [
      { fecha: '2026-08-01', importe: 10, tipo: 'gasto', categoria: null },
      { fecha: '2026-08-02', importe: -5, tipo: 'gasto', categoria: null }, // viola el CHECK de la tabla
    ];

    assert.throws(() => datos.importarMovimientos({ movimientos: conFilaMala, crearCategorias: false }));
    assert.equal(bd.prepare('SELECT COUNT(*) AS n FROM movimientos').get().n, 0, 'rollback completo');
  });
});
