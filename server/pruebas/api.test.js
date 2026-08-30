import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { limpiarBD, vaciarDatos } from './ayuda.js';
import { crearApp } from '../src/app.js';
import { cerrarBD, obtenerBD } from '../src/db/conexion.js';

/**
 * Pruebas de la API por HTTP real: cubren el camino completo
 * ruta -> validación Zod -> servicio -> middleware de errores.
 */

const bd = obtenerBD();
const ALIMENTACION = bd.prepare("SELECT id FROM categorias WHERE nombre = 'Alimentación'").get().id;
const NOMINA = bd.prepare("SELECT id FROM categorias WHERE nombre = 'Nómina'").get().id;

let servidor;
let base;

const pedir = async (ruta, opciones = {}) => {
  const respuesta = await fetch(`${base}${ruta}`, {
    ...opciones,
    headers: opciones.cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
  });
  const tipo = respuesta.headers.get('content-type') ?? '';
  return {
    estado: respuesta.status,
    cuerpo: tipo.includes('application/json') ? await respuesta.json() : await respuesta.text(),
    cabeceras: respuesta.headers,
  };
};

before(async () => {
  servidor = crearApp().listen(0, '127.0.0.1');
  await new Promise((resolver) => servidor.once('listening', resolver));
  base = `http://127.0.0.1:${servidor.address().port}/api`;
});

beforeEach(() => vaciarDatos(bd));

after(async () => {
  await new Promise((resolver) => servidor.close(resolver));
  cerrarBD();
  limpiarBD();
});

describe('salud y rutas desconocidas', () => {
  it('responde a /salud', async () => {
    const { estado, cuerpo } = await pedir('/salud');
    assert.equal(estado, 200);
    assert.equal(cuerpo.estado, 'ok');
  });

  it('devuelve 404 en JSON para una ruta inexistente', async () => {
    const { estado, cuerpo } = await pedir('/no-existe');
    assert.equal(estado, 404);
    assert.match(cuerpo.error, /no encontrada/);
  });
});

describe('validación de entrada', () => {
  it('rechaza un importe negativo con detalle por campo', async () => {
    const { estado, cuerpo } = await pedir('/movimientos', {
      method: 'POST',
      cuerpo: { fecha: '2026-08-10', importe: -5, tipo: 'gasto' },
    });

    assert.equal(estado, 400);
    assert.deepEqual(cuerpo.detalles, [{ campo: 'importe', mensaje: 'El importe debe ser mayor que 0' }]);
  });

  it('rechaza una fecha en formato español', async () => {
    const { estado, cuerpo } = await pedir('/movimientos', {
      method: 'POST',
      cuerpo: { fecha: '10/08/2026', importe: 5, tipo: 'gasto' },
    });

    assert.equal(estado, 400);
    assert.equal(cuerpo.detalles[0].campo, 'fecha');
  });

  it('acumula varios errores en una sola respuesta', async () => {
    const { estado, cuerpo } = await pedir('/movimientos', {
      method: 'POST',
      cuerpo: { fecha: 'ayer', importe: 'mucho', tipo: 'regalo' },
    });

    assert.equal(estado, 400);
    assert.equal(cuerpo.detalles.length, 3);
  });

  it('rechaza un tipo desconocido con mensaje en español', async () => {
    const { cuerpo } = await pedir('/categorias', { method: 'POST', cuerpo: { nombre: 'X', tipo: 'otro' } });
    assert.match(cuerpo.detalles[0].mensaje, /'ingreso' o 'gasto'/);
  });
});

describe('ciclo de vida de un movimiento por HTTP', () => {
  it('crea, edita, lista y borra', async () => {
    const creado = await pedir('/movimientos', {
      method: 'POST',
      cuerpo: { fecha: '2026-08-10', importe: 64.35, descripcion: 'Compra', tipo: 'gasto', categoriaId: ALIMENTACION },
    });
    assert.equal(creado.estado, 201);
    const { id } = creado.cuerpo;

    const editado = await pedir(`/movimientos/${id}`, { method: 'PUT', cuerpo: { importe: 70 } });
    assert.equal(editado.estado, 200);
    assert.equal(editado.cuerpo.importe, 70);
    assert.equal(editado.cuerpo.descripcion, 'Compra');

    const listado = await pedir('/movimientos?tipo=gasto');
    assert.equal(listado.cuerpo.total, 1);
    assert.equal(listado.cuerpo.totales.gastos, 70);

    assert.equal((await pedir(`/movimientos/${id}`, { method: 'DELETE' })).estado, 200);
    assert.equal((await pedir(`/movimientos/${id}`)).estado, 404);
  });

  it('devuelve 400 si la categoría no encaja con el tipo', async () => {
    const { estado, cuerpo } = await pedir('/movimientos', {
      method: 'POST',
      cuerpo: { fecha: '2026-08-10', importe: 10, tipo: 'ingreso', categoriaId: ALIMENTACION },
    });

    assert.equal(estado, 400);
    assert.match(cuerpo.error, /es de tipo gasto/);
  });
});

describe('categorías por HTTP', () => {
  it('impide duplicar nombre dentro del mismo tipo, con 409', async () => {
    const { estado, cuerpo } = await pedir('/categorias', {
      method: 'POST',
      cuerpo: { nombre: 'Alimentación', tipo: 'gasto', color: '#123456' },
    });

    assert.equal(estado, 409);
    assert.match(cuerpo.error, /Ya existe una categoría/);
  });

  it('protege el borrado de una categoría con movimientos y lo permite al forzar', async () => {
    // Categoría propia del test: borrarla no puede afectar al resto de pruebas.
    const { cuerpo: categoria } = await pedir('/categorias', {
      method: 'POST',
      cuerpo: { nombre: 'Prueba borrado', tipo: 'gasto', color: '#123456' },
    });

    await pedir('/movimientos', {
      method: 'POST',
      cuerpo: { fecha: '2026-08-10', importe: 10, tipo: 'gasto', categoriaId: categoria.id },
    });

    const protegido = await pedir(`/categorias/${categoria.id}`, { method: 'DELETE' });
    assert.equal(protegido.estado, 409);
    assert.match(protegido.cuerpo.error, /Archívala/);

    const forzado = await pedir(`/categorias/${categoria.id}?forzar=true`, { method: 'DELETE' });
    assert.equal(forzado.estado, 200);
    assert.equal(forzado.cuerpo.movimientosAfectados, 1);

    const listado = await pedir('/movimientos');
    assert.equal(listado.cuerpo.movimientos[0].categoriaId, null, 'el movimiento sobrevive sin categoría');
  });
});

describe('fijos y presupuestos por HTTP', () => {
  it('al crear un fijo genera de golpe los movimientos vencidos', async () => {
    const { estado, cuerpo } = await pedir('/recurrentes', {
      method: 'POST',
      cuerpo: {
        nombre: 'Nómina', importe: 2400, tipo: 'ingreso', categoriaId: NOMINA,
        diaDelMes: 1, fechaInicio: '2026-06-01',
      },
    });

    assert.equal(estado, 201);
    assert.ok(cuerpo.movimientosGenerados >= 1);

    const generados = await pedir('/movimientos?origen=recurrente');
    assert.equal(generados.cuerpo.total, cuerpo.movimientosGenerados);
  });

  it('guarda un presupuesto y refleja el consumo', async () => {
    await pedir('/movimientos', {
      method: 'POST',
      cuerpo: { fecha: '2026-08-10', importe: 30, tipo: 'gasto', categoriaId: ALIMENTACION },
    });

    const { estado, cuerpo } = await pedir('/presupuestos', {
      method: 'PUT',
      cuerpo: { categoriaId: ALIMENTACION, anio: 2026, mes: 8, importe: 120 },
    });

    assert.equal(estado, 200);
    const fila = cuerpo.presupuestos.find((p) => p.categoriaId === ALIMENTACION);
    assert.equal(fila.presupuesto, 120);
    assert.equal(fila.gastado, 30);
    assert.equal(fila.porcentaje, 25);
  });

  it('rechaza un mes fuera de rango', async () => {
    const { estado } = await pedir('/presupuestos?anio=2026&mes=13');
    assert.equal(estado, 400);
  });
});

describe('reglas de categorización por HTTP', () => {
  beforeEach(() => bd.exec('DELETE FROM reglas'));

  it('crea una regla y la usa al importar', async () => {
    const creada = await pedir('/reglas', {
      method: 'POST',
      cuerpo: { patron: 'MERCADONA', categoriaId: ALIMENTACION },
    });
    assert.equal(creada.estado, 201);
    assert.equal(creada.cuerpo.coincidencia, 'contiene');

    const importada = await pedir('/datos/importar/confirmar', {
      method: 'POST',
      cuerpo: {
        crearCategorias: false,
        movimientos: [
          { fecha: '2026-08-01', importe: 30, descripcion: 'COMPRA MERCADONA MADRID', tipo: 'gasto' },
        ],
      },
    });

    assert.equal(importada.cuerpo.importados, 1);
    assert.equal(importada.cuerpo.categorizadosPorRegla, 1);

    const listado = await pedir('/movimientos');
    assert.equal(listado.cuerpo.movimientos[0].categoriaNombre, 'Alimentación');
  });

  it('el probador dice qué regla casaría', async () => {
    await pedir('/reglas', { method: 'POST', cuerpo: { patron: 'REPSOL', categoriaId: ALIMENTACION } });

    const acierto = await pedir('/reglas/probar', {
      method: 'POST',
      cuerpo: { texto: 'REPSOL E.S. 4471', tipo: 'gasto' },
    });
    assert.equal(acierto.cuerpo.coincidencia.categoriaNombre, 'Alimentación');

    const fallo = await pedir('/reglas/probar', { method: 'POST', cuerpo: { texto: 'BAR PEPE', tipo: 'gasto' } });
    assert.equal(fallo.cuerpo.coincidencia, null);
  });

  it('devuelve sugerencias para un lote de filas', async () => {
    await pedir('/reglas', { method: 'POST', cuerpo: { patron: 'MERCADONA', categoriaId: ALIMENTACION } });

    const { cuerpo } = await pedir('/reglas/sugerir', {
      method: 'POST',
      cuerpo: {
        filas: [
          { descripcion: 'COMPRA MERCADONA', tipo: 'gasto' },
          { descripcion: 'OTRA COSA', tipo: 'gasto' },
        ],
      },
    });

    assert.equal(cuerpo.sugerencias[0].categoriaId, ALIMENTACION);
    assert.equal(cuerpo.sugerencias[1], null);
  });

  it('reaplica las reglas al histórico sin categoría', async () => {
    await pedir('/movimientos', {
      method: 'POST',
      cuerpo: { fecha: '2026-08-01', importe: 20, descripcion: 'COMPRA MERCADONA', tipo: 'gasto' },
    });
    await pedir('/reglas', { method: 'POST', cuerpo: { patron: 'MERCADONA', categoriaId: ALIMENTACION } });

    const { estado, cuerpo } = await pedir('/reglas/aplicar', { method: 'POST' });
    assert.equal(estado, 200);
    assert.equal(cuerpo.actualizados, 1);
    assert.deepEqual(cuerpo.porCategoria, [{ nombre: 'Alimentación', total: 1 }]);
  });

  it('valida el patrón y la dirección al reordenar', async () => {
    const vacia = await pedir('/reglas', { method: 'POST', cuerpo: { patron: '   ', categoriaId: ALIMENTACION } });
    assert.equal(vacia.estado, 400);

    const creada = await pedir('/reglas', { method: 'POST', cuerpo: { patron: 'X', categoriaId: ALIMENTACION } });
    const mala = await pedir(`/reglas/${creada.cuerpo.id}/mover`, { method: 'POST', cuerpo: { direccion: 'lado' } });
    assert.equal(mala.estado, 400);
  });
});

describe('exportación por HTTP', () => {
  it('sirve el CSV como descarga con nombre de fichero', async () => {
    await pedir('/movimientos', {
      method: 'POST',
      cuerpo: { fecha: '2026-08-10', importe: 10, tipo: 'gasto' },
    });

    const { estado, cabeceras, cuerpo } = await pedir('/datos/exportar?formato=csv');
    assert.equal(estado, 200);
    assert.match(cabeceras.get('content-type'), /text\/csv/);
    assert.match(cabeceras.get('content-disposition'), /attachment; filename="movimientos-\d{4}-\d{2}-\d{2}\.csv"/);
    assert.ok(cuerpo.includes('Fecha;Tipo'));
  });

  it('ofrece una plantilla de ejemplo en xlsx', async () => {
    const { estado, cabeceras } = await pedir('/datos/plantilla');
    assert.equal(estado, 200);
    assert.match(cabeceras.get('content-disposition'), /plantilla-movimientos\.xlsx/);
  });
});
