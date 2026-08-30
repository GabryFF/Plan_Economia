/**
 * Todo el dinero viaja y se almacena como enteros de céntimos.
 * La conversión desde texto libre (formularios, CSV, Excel) vive aquí.
 */

export const aCentimos = (euros) => Math.round(Number(euros) * 100);
export const aEuros = (centimos) => centimos / 100;

/**
 * Interpreta un importe escrito por una persona o exportado por un banco:
 * "1.234,56 €", "1,234.56", "-45,20", "45". Devuelve céntimos o null.
 */
export function parsearImporte(valor) {
  if (typeof valor === 'number' && Number.isFinite(valor)) return Math.round(valor * 100);
  if (typeof valor !== 'string') return null;

  let texto = valor.trim().replace(/[€$\s\u00a0]/g, '');
  if (!texto) return null;

  const negativo = texto.startsWith('-') || /^\(.*\)$/.test(texto);
  texto = texto.replace(/[()]/g, '').replace(/^[+-]/, '');

  const tieneComa = texto.includes(',');
  const tienePunto = texto.includes('.');

  if (tieneComa && tienePunto) {
    // El separador decimal es el que aparece más a la derecha.
    const decimal = texto.lastIndexOf(',') > texto.lastIndexOf('.') ? ',' : '.';
    const miles = decimal === ',' ? '.' : ',';
    texto = texto.split(miles).join('').replace(decimal, '.');
  } else if (tieneComa) {
    // "1,50" es decimal; "1,500" con 3 dígitos finales se trata como miles.
    const [, decimales = ''] = texto.split(',');
    texto = decimales.length === 3 ? texto.replace(',', '') : texto.replace(',', '.');
  }

  const numero = Number(texto);
  if (!Number.isFinite(numero)) return null;

  return Math.round(numero * 100) * (negativo ? -1 : 1);
}
