import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { limpiarBD, vaciarDatos } from './ayuda.js';
import { cerrarBD, obtenerBD } from '../src/db/conexion.js';
import * as metas from '../src/servicios/metas.js';
import * as movimientos from '../src/servicios/movimientos.js';
import { saludFinanciera } from '../src/servicios/salud.js';

const bd = obtenerBD();

const hoy = new Date();
const haceMeses = (n, dia = 10) => {
  const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - n, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

beforeEach(() => {
  vaciarDatos(bd);
  bd.exec('DELETE FROM metas; DELETE FROM ajustes;');
});
after(() => { cerrarBD(); limpiarBD(); });

describe('objetivos de ahorro', () => {
  it('crea con progreso calculado', () => {
    const viaje = metas.crearMeta({ nombre: 'Viaje a Japón', objetivo: 3000, ahorrado: 750 });

    assert.equal(viaje.objetivo, 3000);
    assert.equal(viaje.ahorrado, 750);
    assert.equal(viaje.restante, 2250);
    assert.equal(viaje.progreso, 25);
    assert.equal(viaje.completada, false);
  });

  it('no deja duplicar el nombre', () => {
    metas.crearMeta({ nombre: 'Viaje', objetivo: 1000 });
    assert.throws(() => metas.crearMeta({ nombre: 'viaje', objetivo: 500 }), /Ya tienes un objetivo/);
  });

  it('rechaza empezar con más ahorrado que el objetivo', () => {
    assert.throws(() => metas.crearMeta({ nombre: 'Viaje', objetivo: 1000, ahorrado: 2000 }), /no puede superar/);
  });

  it('el progreso se topa en el 100 %', () => {
    const viaje = metas.crearMeta({ nombre: 'Viaje', objetivo: 1000, ahorrado: 1000 });
    const pasado = metas.aportar(viaje.id, 500);

    assert.equal(pasado.progreso, 100);
    assert.equal(pasado.restante, 0);
    assert.equal(pasado.completada, true);
    assert.equal(pasado.ahorrado, 1500, 'lo aportado de más no se pierde');
  });

  it('aporta y retira sin bajar de cero', () => {
    const viaje = metas.crearMeta({ nombre: 'Viaje', objetivo: 1000, ahorrado: 200 });

    assert.equal(metas.aportar(viaje.id, 100).ahorrado, 300);
    assert.equal(metas.aportar(viaje.id, -500).ahorrado, 0, 'no existe el ahorro negativo');
  });

  it('reordena la prioridad', () => {
    const a = metas.crearMeta({ nombre: 'Viaje', objetivo: 1000 });
    const b = metas.crearMeta({ nombre: 'Coche', objetivo: 5000 });

    assert.deepEqual(metas.listarMetas().map((m) => m.nombre), ['Viaje', 'Coche']);

    metas.moverMeta(b.id, 'subir');
    assert.deepEqual(metas.listarMetas().map((m) => m.nombre), ['Coche', 'Viaje']);

    // En el extremo no hace nada en vez de fallar.
    metas.moverMeta(b.id, 'subir');
    assert.deepEqual(metas.listarMetas().map((m) => m.nombre), ['Coche', 'Viaje']);

    metas.borrarMeta(a.id);
    assert.equal(metas.listarMetas().length, 1);
    assert.throws(() => metas.borrarMeta(a.id), /no encontrado/);
  });
});

describe('planificación en cascada', () => {
  it('llena un objetivo antes de empezar el siguiente', () => {
    metas.crearMeta({ nombre: 'Viaje', objetivo: 1200 });
    metas.crearMeta({ nombre: 'Coche', objetivo: 6000 });

    const plan = metas.planificarMetas({ aporteAnual: 12000 });

    // El viaje son 1.200 de 12.000 al año: algo más de un mes.
    assert.equal(plan[0].mesesEstimados, 2);
    // El coche no empieza hasta terminar el viaje: (1.200 + 6.000) / 12.000.
    assert.equal(plan[1].mesesEstimados, 8);
  });

  it('el colchón pendiente va por delante de todo', () => {
    metas.crearMeta({ nombre: 'Viaje', objetivo: 1200 });

    const sinColchon = metas.planificarMetas({ aporteAnual: 12000, pendienteAntes: 0 });
    const conColchon = metas.planificarMetas({ aporteAnual: 12000, pendienteAntes: 6000 });

    assert.ok(
      conColchon[0].mesesEstimados > sinColchon[0].mesesEstimados,
      'si falta colchón, las metas se retrasan, y hay que decirlo'
    );
  });

  it('una meta completada no consume tiempo del resto', () => {
    metas.crearMeta({ nombre: 'Viaje', objetivo: 1000, ahorrado: 1000 });
    metas.crearMeta({ nombre: 'Coche', objetivo: 6000 });

    const plan = metas.planificarMetas({ aporteAnual: 12000 });
    assert.equal(plan[0].mesesEstimados, 0);
    assert.equal(plan[1].mesesEstimados, 6, 'solo cuentan los 6.000 que faltan');
  });

  it('sin ahorro no inventa plazos', () => {
    metas.crearMeta({ nombre: 'Viaje', objetivo: 1200 });
    assert.equal(metas.planificarMetas({ aporteAnual: 0 })[0].mesesEstimados, null);
  });

  it('con fecha límite dice cuánto hay que apartar al mes', () => {
    const dentroDeSeisMeses = new Date(hoy.getFullYear(), hoy.getMonth() + 6, 15);
    const fecha = `${dentroDeSeisMeses.getFullYear()}-${String(dentroDeSeisMeses.getMonth() + 1).padStart(2, '0')}-15`;

    metas.crearMeta({ nombre: 'Viaje', objetivo: 1200, fechaObjetivo: fecha });
    const plan = metas.planificarMetas({ aporteAnual: 12000 });

    assert.equal(plan[0].aporteMensualNecesario, 200, '1.200 entre 6 meses');
  });

  it('una fecha ya pasada no produce un aporte imposible', () => {
    metas.crearMeta({ nombre: 'Viaje', objetivo: 1200, fechaObjetivo: haceMeses(2) });
    assert.equal(metas.planificarMetas({ aporteAnual: 12000 })[0].aporteMensualNecesario, null);
  });
});

describe('integración con el plan de ahorro', () => {
  it('las metas aparecen en la salud financiera con su aporte', () => {
    for (let n = 1; n <= 3; n += 1) {
      movimientos.crearMovimiento({ fecha: haceMeses(n, 25), importe: 1600, tipo: 'ingreso' });
      movimientos.crearMovimiento({ fecha: haceMeses(n, 15), importe: 900, tipo: 'gasto' });
    }
    metas.crearMeta({ nombre: 'Viaje a Japón', objetivo: 3000 });

    const salud = saludFinanciera();

    assert.equal(salud.metas.length, 1);
    assert.equal(salud.metas[0].nombre, 'Viaje a Japón');
    assert.ok(salud.metas[0].aporteAnual > 0);
    assert.equal(salud.vivienda, null, 'sin meta con clave vivienda, el atajo es nulo');
  });

  it('el atajo de vivienda apunta a la meta con esa clave', () => {
    metas.crearMeta({ nombre: 'Viaje', objetivo: 3000 });
    metas.crearMeta({ nombre: 'Entrada del piso', objetivo: 40000, clave: 'vivienda' });

    const salud = saludFinanciera();
    assert.equal(salud.vivienda.nombre, 'Entrada del piso');
    assert.equal(salud.metas.length, 2);
  });

  it('apartar para un viaje no cuenta como gasto', () => {
    for (let n = 1; n <= 3; n += 1) {
      movimientos.crearMovimiento({ fecha: haceMeses(n, 25), importe: 1600, tipo: 'ingreso' });
      movimientos.crearMovimiento({ fecha: haceMeses(n, 15), importe: 900, tipo: 'gasto' });
    }

    const antes = saludFinanciera();
    metas.crearMeta({ nombre: 'Viaje', objetivo: 3000, ahorrado: 500 });
    const despues = saludFinanciera();

    // Si apartar contara como gasto, la tasa de ahorro caería y el fondo de
    // emergencia subiría. Ninguna de las dos cosas debe pasar.
    assert.equal(despues.tasaAhorro, antes.tasaAhorro);
    assert.equal(despues.fondoEmergencia.objetivo, antes.fondoEmergencia.objetivo);
  });
});
