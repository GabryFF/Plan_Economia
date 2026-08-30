import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aNumero } from '../src/utiles/formato.ts';

/**
 * `aNumero` traduce lo que teclea una persona a un número. Se prueba aquí
 * porque vive en el navegador y no pasa por la API.
 */

describe('aNumero', () => {
  it('entiende el formato español y el inglés', () => {
    assert.equal(aNumero('1.234,56'), 1234.56);
    assert.equal(aNumero('1234.56'), 1234.56);
    assert.equal(aNumero('12,50 €'), 12.5);
    assert.equal(aNumero('  70 '), 70);
  });

  it('devuelve null cuando no hay número', () => {
    assert.equal(aNumero(''), null);
    assert.equal(aNumero('   '), null);
    assert.equal(aNumero('hola'), null);
  });

  it('tolera un campo que nadie ha tocado', () => {
    // Un formulario guarda sus campos en un Record y lee por clave: la casilla
    // que el usuario deja en blanco devuelve undefined, no "". Cuando esto
    // lanzaba, el asistente de primer arranque fallaba entero al guardar.
    const campos: Record<string, string> = { vivienda: '700' };

    assert.equal(aNumero(campos.suministros), null);
    assert.equal(aNumero(null), null);
    assert.equal(aNumero(campos.vivienda), 700);
  });

  it('no rompe al filtrar un formulario a medio rellenar', () => {
    const claves = ['vivienda', 'suministros', 'internet', 'gimnasio'];
    const campos: Record<string, string> = { vivienda: '700', internet: '10' };

    const rellenos = claves.filter((c) => (aNumero(campos[c]) ?? 0) > 0);
    assert.deepEqual(rellenos, ['vivienda', 'internet']);
  });
});
