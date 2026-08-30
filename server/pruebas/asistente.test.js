import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { limpiarBD, vaciarDatos } from './ayuda.js';
import { cerrarBD, obtenerBD } from '../src/db/conexion.js';
import * as asistente from '../src/servicios/asistente.js';
import * as ajustes from '../src/servicios/ajustes.js';
import * as recurrentes from '../src/servicios/recurrentes.js';

const bd = obtenerBD();

beforeEach(() => {
  vaciarDatos(bd);
  bd.exec('DELETE FROM ajustes; DELETE FROM reglas; DELETE FROM metas;');
});
after(() => { cerrarBD(); limpiarBD(); });

describe('cuándo se ofrece el asistente', () => {
  it('se ofrece con la aplicación vacía', () => {
    const e = asistente.estado();

    assert.equal(e.vacia, true);
    assert.equal(e.mostrar, true);
    assert.ok(e.gastosHabituales.length > 0);
  });

  it('deja de ofrecerse en cuanto hay datos', () => {
    recurrentes.crearRecurrente({ nombre: 'Nómina', importe: 1600, tipo: 'ingreso', diaDelMes: 25, fechaInicio: '2026-01-25' });

    const e = asistente.estado();
    assert.equal(e.vacia, false);
    assert.equal(e.mostrar, false);
  });

  it('omitirlo lo silencia sin crear nada', () => {
    asistente.omitir();

    const e = asistente.estado();
    assert.equal(e.completado, true);
    assert.equal(e.mostrar, false);
    assert.equal(e.vacia, true, 'no ha creado nada');
    assert.equal(recurrentes.listarRecurrentes().length, 0);
  });

  it('vuelve a ofrecerse si se borran los datos y la marca', () => {
    asistente.omitir();
    bd.exec('DELETE FROM ajustes');

    assert.equal(asistente.estado().mostrar, true, 'empezar de cero debería volver a guiarte');
  });
});

describe('asalariado', () => {
  const datos = {
    esAutonomo: false,
    ingreso: { importe: 1600, diaDelMes: 25, pagasAlAnio: 14 },
    gastosFijos: [
      { clave: 'vivienda', importe: 250 },
      { clave: 'internet', importe: 10 },
      { clave: 'suscripciones', importe: 38 },
    ],
    colchonActual: 500,
    cargarReglas: false,
  };

  it('crea la nómina y los gastos fijos declarados', () => {
    const r = asistente.completar(datos);

    assert.equal(r.ingreso.nombre, 'Nómina');
    assert.equal(r.ingreso.importe, 1600);
    assert.equal(r.ingreso.diaDelMes, 25);
    assert.equal(r.gastosFijos.length, 3);

    const nombres = recurrentes.listarRecurrentes().map((x) => x.nombre);
    assert.ok(nombres.includes('Alquiler o hipoteca'));
    assert.ok(nombres.includes('Internet y móvil'));
  });

  it('asigna cada gasto a su categoría', () => {
    asistente.completar(datos);

    const vivienda = recurrentes.listarRecurrentes().find((x) => x.nombre === 'Alquiler o hipoteca');
    assert.equal(vivienda.categoriaNombre, 'Vivienda');
  });

  it('guarda las pagas y el colchón', () => {
    asistente.completar(datos);
    const guardados = ajustes.obtenerAjustes();

    assert.equal(guardados.pagasAlAnio, 14);
    assert.equal(guardados.colchonActual, 500);
    assert.equal(guardados.modoAutonomo, 0);
    assert.equal(guardados.asistenteCompletado, 1);
  });

  it('no genera movimientos de meses que el usuario no ha vivido con la app', () => {
    const r = asistente.completar(datos);

    // Empieza el día 1 del mes en curso: como mucho un movimiento por concepto.
    assert.ok(r.movimientosGenerados <= 4, `ha generado ${r.movimientosGenerados} movimientos de golpe`);
  });

  it('ignora los gastos marcados sin importe', () => {
    const r = asistente.completar({ ...datos, gastosFijos: [{ clave: 'vivienda', importe: 0 }] });
    assert.equal(r.gastosFijos.length, 0);
  });
});

describe('autónomo', () => {
  it('activa el modo y crea la cuota como gasto fijo', () => {
    const r = asistente.completar({
      esAutonomo: true,
      ingreso: { importe: 2500, diaDelMes: 5 },
      cuotaAutonomos: 300,
      cargarReglas: false,
    });

    const guardados = ajustes.obtenerAjustes();
    assert.equal(guardados.modoAutonomo, 1, 'la sección de autónomo queda activada');
    assert.equal(guardados.autonomoCuota, 300);

    assert.equal(r.ingreso.nombre, 'Ingresos de la actividad', 'un autónomo no cobra una nómina');
    assert.ok(r.gastosFijos.some((g) => g.nombre === 'Cuota de autónomos'));
  });

  it('sin cuota declarada no inventa un gasto', () => {
    const r = asistente.completar({ esAutonomo: true, cuotaAutonomos: 0, cargarReglas: false });

    assert.equal(r.gastosFijos.length, 0);
    assert.equal(ajustes.obtenerAjustes().modoAutonomo, 1);
  });
});

describe('robustez', () => {
  it('carga el catálogo de reglas si se pide', () => {
    const r = asistente.completar({ esAutonomo: false, cargarReglas: true });
    assert.ok(r.reglas > 0, 'ahorra categorizar a mano desde el primer extracto');
  });

  it('funciona sin declarar nada', () => {
    const r = asistente.completar({ esAutonomo: false, cargarReglas: false });

    assert.equal(r.ingreso, null);
    assert.deepEqual(r.gastosFijos, []);
    assert.equal(ajustes.obtenerAjustes().asistenteCompletado, 1);
  });

  it('rechaza un ingreso no positivo sin dejar nada a medias', () => {
    assert.throws(
      () => asistente.completar({ ingreso: { importe: 0 }, gastosFijos: [{ clave: 'vivienda', importe: 100 }] }),
      /mayor que 0/
    );

    assert.equal(recurrentes.listarRecurrentes().length, 0, 'no queda ningún gasto suelto');
    assert.equal(ajustes.obtenerAjustes().asistenteCompletado, 0);
  });
});
