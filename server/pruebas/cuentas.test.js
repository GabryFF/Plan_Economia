import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { limpiarBD, vaciarDatos } from './ayuda.js';
import { cerrarBD, obtenerBD } from '../src/db/conexion.js';
import * as cuentas from '../src/servicios/cuentas.js';
import * as movimientos from '../src/servicios/movimientos.js';
import { resumenGeneral } from '../src/servicios/resumen.js';

const bd = obtenerBD();

beforeEach(() => {
  vaciarDatos(bd);
  bd.exec('DELETE FROM traspasos; DELETE FROM cuentas;');
});
after(() => { cerrarBD(); limpiarBD(); });

const crearDos = () => ({
  corriente: cuentas.crearCuenta({ nombre: 'Banco', tipo: 'corriente', saldoInicial: 1000 }),
  ahorro: cuentas.crearCuenta({ nombre: 'Ahorro', tipo: 'ahorro', saldoInicial: 0 }),
});

describe('cuentas', () => {
  it('el saldo parte del inicial', () => {
    const cuenta = cuentas.crearCuenta({ nombre: 'Banco', saldoInicial: 1500 });

    assert.equal(cuenta.saldoInicial, 1500);
    assert.equal(cuenta.saldo, 1500);
    assert.equal(cuenta.movimientos, 0);
  });

  it('los ingresos suman y los gastos restan', () => {
    const cuenta = cuentas.crearCuenta({ nombre: 'Banco', saldoInicial: 1000 });
    movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 500, tipo: 'ingreso', cuentaId: cuenta.id });
    movimientos.crearMovimiento({ fecha: '2026-08-02', importe: 200, tipo: 'gasto', cuentaId: cuenta.id });

    assert.equal(cuentas.obtenerCuenta(cuenta.id).saldo, 1300);
  });

  it('el saldo puede quedarse en negativo, que es información útil', () => {
    const cuenta = cuentas.crearCuenta({ nombre: 'Banco', saldoInicial: 100 });
    movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 300, tipo: 'gasto', cuentaId: cuenta.id });

    assert.equal(cuentas.obtenerCuenta(cuenta.id).saldo, -200);
  });

  it('no deja duplicar el nombre', () => {
    cuentas.crearCuenta({ nombre: 'Banco' });
    assert.throws(() => cuentas.crearCuenta({ nombre: 'banco' }), /Ya tienes una cuenta/);
  });

  it('un movimiento sin cuenta va a la primera activa', () => {
    const primera = cuentas.crearCuenta({ nombre: 'Banco' });
    cuentas.crearCuenta({ nombre: 'Ahorro' });

    const movimiento = movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 50, tipo: 'gasto' });
    assert.equal(movimiento.cuentaId, primera.id, 'con una sola cuenta el usuario ni se entera del concepto');
  });

  it('el total es la suma de saldos', () => {
    const { corriente } = crearDos();
    movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 500, tipo: 'ingreso', cuentaId: corriente.id });

    assert.equal(cuentas.listarCuentas().total, 1500);
  });
});

describe('traspasos', () => {
  it('mueven saldo sin cambiar el patrimonio', () => {
    const { corriente, ahorro } = crearDos();
    const antes = cuentas.listarCuentas().total;

    cuentas.crearTraspaso({ fecha: '2026-08-10', importe: 400, origenId: corriente.id, destinoId: ahorro.id });

    assert.equal(cuentas.obtenerCuenta(corriente.id).saldo, 600);
    assert.equal(cuentas.obtenerCuenta(ahorro.id).saldo, 400);
    assert.equal(cuentas.listarCuentas().total, antes, 'mover dinero no crea ni destruye patrimonio');
  });

  it('NO cuentan como ingreso ni como gasto', () => {
    const { corriente, ahorro } = crearDos();
    movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 1000, tipo: 'ingreso', cuentaId: corriente.id });

    const antes = resumenGeneral({});
    cuentas.crearTraspaso({ fecha: '2026-08-10', importe: 400, origenId: corriente.id, destinoId: ahorro.id });
    const despues = resumenGeneral({});

    // Esta es la razón de que los traspasos vivan en su propia tabla.
    assert.deepEqual(
      { i: despues.ingresos, g: despues.gastos, b: despues.balance },
      { i: antes.ingresos, g: antes.gastos, b: antes.balance }
    );
  });

  it('no se puede traspasar a la misma cuenta', () => {
    const { corriente } = crearDos();

    assert.throws(
      () => cuentas.crearTraspaso({ fecha: '2026-08-10', importe: 100, origenId: corriente.id, destinoId: corriente.id }),
      /no pueden ser la misma/
    );
  });

  it('falla con una cuenta inexistente', () => {
    const { corriente } = crearDos();

    assert.throws(
      () => cuentas.crearTraspaso({ fecha: '2026-08-10', importe: 100, origenId: corriente.id, destinoId: 99999 }),
      /no encontrada/
    );
  });

  it('borrar un traspaso devuelve los saldos a su sitio', () => {
    const { corriente, ahorro } = crearDos();
    const traspaso = cuentas.crearTraspaso({ fecha: '2026-08-10', importe: 400, origenId: corriente.id, destinoId: ahorro.id });

    cuentas.borrarTraspaso(traspaso.id);

    assert.equal(cuentas.obtenerCuenta(corriente.id).saldo, 1000);
    assert.equal(cuentas.obtenerCuenta(ahorro.id).saldo, 0);
    assert.throws(() => cuentas.borrarTraspaso(traspaso.id), /no encontrado/);
  });

  it('se listan con las dos cuentas resueltas', () => {
    const { corriente, ahorro } = crearDos();
    cuentas.crearTraspaso({
      fecha: '2026-08-10', importe: 400, origenId: corriente.id, destinoId: ahorro.id, descripcion: 'Al colchón',
    });

    const [t] = cuentas.listarTraspasos();
    assert.equal(t.origen.nombre, 'Banco');
    assert.equal(t.destino.nombre, 'Ahorro');
    assert.equal(t.descripcion, 'Al colchón');
  });
});

describe('borrado de cuentas', () => {
  it('protege una cuenta con movimientos', () => {
    const cuenta = cuentas.crearCuenta({ nombre: 'Banco' });
    movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 50, tipo: 'gasto', cuentaId: cuenta.id });

    assert.throws(() => cuentas.borrarCuenta(cuenta.id), /Desactívala/);
  });

  it('al forzar, los movimientos sobreviven sin cuenta', () => {
    const cuenta = cuentas.crearCuenta({ nombre: 'Banco' });
    const movimiento = movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 50, tipo: 'gasto', cuentaId: cuenta.id });

    const resultado = cuentas.borrarCuenta(cuenta.id, { forzar: true });

    assert.equal(resultado.movimientosAfectados, 1);
    assert.equal(movimientos.obtenerMovimiento(movimiento.id).cuentaId, null, 'nunca se borran datos económicos');
  });

  it('borrar una cuenta se lleva sus traspasos', () => {
    const { corriente, ahorro } = crearDos();
    cuentas.crearTraspaso({ fecha: '2026-08-10', importe: 400, origenId: corriente.id, destinoId: ahorro.id });

    const resultado = cuentas.borrarCuenta(corriente.id, { forzar: true });

    assert.equal(resultado.traspasosBorrados, 1);
    assert.equal(cuentas.listarTraspasos().length, 0);
    assert.equal(cuentas.obtenerCuenta(ahorro.id).saldo, 0, 'el saldo del destino se recalcula');
  });

  it('las inactivas se ocultan salvo que se pidan', () => {
    const cuenta = cuentas.crearCuenta({ nombre: 'Antigua' });
    cuentas.actualizarCuenta(cuenta.id, { activa: false });

    assert.equal(cuentas.listarCuentas().cuentas.length, 0);
    assert.equal(cuentas.listarCuentas({ incluirInactivas: true }).cuentas.length, 1);
  });
});

describe('filtrado por cuenta', () => {
  it('los movimientos se pueden filtrar por dónde ocurrieron', () => {
    const { corriente, ahorro } = crearDos();
    movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 50, tipo: 'gasto', cuentaId: corriente.id });
    movimientos.crearMovimiento({ fecha: '2026-08-02', importe: 30, tipo: 'gasto', cuentaId: ahorro.id });

    assert.equal(movimientos.listarMovimientos({ cuentaId: corriente.id }).total, 1);
    assert.equal(movimientos.listarMovimientos({}).total, 2);
  });

  it('el listado trae el nombre de la cuenta resuelto', () => {
    const { corriente } = crearDos();
    movimientos.crearMovimiento({ fecha: '2026-08-01', importe: 50, tipo: 'gasto', cuentaId: corriente.id });

    assert.equal(movimientos.listarMovimientos({}).movimientos[0].cuentaNombre, 'Banco');
  });
});

describe('los gastos fijos cuentan en el saldo', () => {
  it('un recibo generado por la aplicación va a la cuenta por defecto', async () => {
    const recurrentes = await import('../src/servicios/recurrentes.js');
    const cuenta = cuentas.crearCuenta({ nombre: 'Banco', tipo: 'corriente', saldoInicial: 1000 });

    recurrentes.crearRecurrente({
      nombre: 'Nómina', importe: 1600, tipo: 'ingreso', diaDelMes: 25, fechaInicio: '2026-08-01',
    });
    recurrentes.crearRecurrente({
      nombre: 'Alquiler', importe: 600, tipo: 'gasto', diaDelMes: 1, fechaInicio: '2026-08-01',
    });
    const { creados } = recurrentes.materializarPendientes({ hasta: '2026-08-31' });
    assert.equal(creados, 2);

    const sinCuenta = bd.prepare('SELECT COUNT(*) AS n FROM movimientos WHERE cuenta_id IS NULL').get().n;
    assert.equal(sinCuenta, 0, 'un recibo sin cuenta desaparece del saldo');

    // 1000 de partida + 1600 de nómina − 600 de alquiler.
    const saldo = cuentas.listarCuentas().cuentas.find((c) => c.id === cuenta.id).saldo;
    assert.equal(saldo, 2000);
  });
});
