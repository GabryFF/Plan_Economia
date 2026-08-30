import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  diasDelMes, esFechaISO, fechaDelMes, parsearFecha, primerDiaDelMes, ultimoDiaDelMes, ultimosMeses,
} from '../src/utiles/fechas.js';

describe('fechas del mes', () => {
  it('conoce la longitud de cada mes, bisiestos incluidos', () => {
    assert.equal(diasDelMes(2026, 2), 28);
    assert.equal(diasDelMes(2024, 2), 29);
    assert.equal(diasDelMes(2026, 4), 30);
    assert.equal(diasDelMes(2026, 12), 31);
  });

  it('recorta el día al último del mes en lugar de desbordar', () => {
    // Es el caso de "cobro el día 31": en febrero debe ser el 28 (o 29).
    assert.equal(fechaDelMes(2026, 2, 31), '2026-02-28');
    assert.equal(fechaDelMes(2024, 2, 31), '2024-02-29');
    assert.equal(fechaDelMes(2026, 4, 31), '2026-04-30');
    assert.equal(fechaDelMes(2026, 1, 15), '2026-01-15');
  });

  it('calcula el primer y el último día', () => {
    assert.equal(primerDiaDelMes(2026, 8), '2026-08-01');
    assert.equal(ultimoDiaDelMes(2026, 2), '2026-02-28');
  });
});

describe('ultimosMeses', () => {
  it('devuelve los periodos en orden y terminando en el de referencia', () => {
    const periodos = ultimosMeses(3, new Date(2026, 0, 15)); // enero 2026
    assert.deepEqual(periodos, [
      { anio: 2025, mes: 11 },
      { anio: 2025, mes: 12 },
      { anio: 2026, mes: 1 },
    ]);
  });
});

describe('parsearFecha', () => {
  it('acepta ISO y formatos escritos a mano', () => {
    assert.equal(parsearFecha('2026-03-04'), '2026-03-04');
    assert.equal(parsearFecha('04/03/2026'), '2026-03-04');
    assert.equal(parsearFecha('4-3-26'), '2026-03-04');
    assert.equal(parsearFecha('04.03.2026'), '2026-03-04');
  });

  it('interpreta el formato español: día primero', () => {
    // 03/04 debe ser 3 de abril, no 4 de marzo.
    assert.equal(parsearFecha('03/04/2026'), '2026-04-03');
  });

  it('rechaza fechas imposibles', () => {
    assert.equal(parsearFecha('31/02/2026'), null);
    assert.equal(parsearFecha('15/13/2026'), null);
    assert.equal(parsearFecha('hoy'), null);
    assert.equal(parsearFecha(''), null);
  });

  it('valida el formato ISO', () => {
    assert.ok(esFechaISO('2026-08-28'));
    assert.ok(!esFechaISO('28-08-2026'));
    assert.ok(!esFechaISO('2026-13-01'));
  });
});
