import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aCentimos, aEuros, parsearImporte } from '../src/utiles/dinero.js';

describe('conversión de importes', () => {
  it('convierte euros a céntimos sin arrastrar error de coma flotante', () => {
    assert.equal(aCentimos(64.35), 6435);
    assert.equal(aCentimos(0.07), 7);
    assert.equal(aCentimos(1234.56), 123456);
    // 0.1 + 0.2 en flotante da 0.30000000000000004: el redondeo debe absorberlo.
    assert.equal(aCentimos(0.1 + 0.2), 30);
  });

  it('vuelve a euros', () => {
    assert.equal(aEuros(6435), 64.35);
    assert.equal(aEuros(0), 0);
  });
});

describe('parsearImporte (texto libre de bancos y personas)', () => {
  it('acepta formato español con separador de miles', () => {
    assert.equal(parsearImporte('1.234,56'), 123456);
    assert.equal(parsearImporte('1.234,56 €'), 123456);
    assert.equal(parsearImporte('45,90'), 4590);
  });

  it('acepta formato anglosajón', () => {
    assert.equal(parsearImporte('1,234.56'), 123456);
    assert.equal(parsearImporte('45.90'), 4590);
  });

  it('interpreta la coma con tres decimales como separador de miles', () => {
    assert.equal(parsearImporte('1,500'), 150000);
  });

  it('detecta importes negativos, incluso entre paréntesis', () => {
    assert.equal(parsearImporte('-45,20'), -4520);
    assert.equal(parsearImporte('(45,20)'), -4520);
  });

  it('acepta números y espacios no separables', () => {
    assert.equal(parsearImporte(45.9), 4590);
    assert.equal(parsearImporte('1 234,50'), 123450);
  });

  it('devuelve null ante basura', () => {
    assert.equal(parsearImporte(''), null);
    assert.equal(parsearImporte('   '), null);
    assert.equal(parsearImporte('pendiente'), null);
    assert.equal(parsearImporte(null), null);
    assert.equal(parsearImporte(undefined), null);
  });
});
