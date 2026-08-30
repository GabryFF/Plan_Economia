/** Utilidades de fecha en formato ISO corto (YYYY-MM-DD), el que guarda SQLite. */

export const hoyISO = () => new Date().toISOString().slice(0, 10);

export const esFechaISO = (valor) =>
  typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(valor));

export const diasDelMes = (anio, mes) => new Date(anio, mes, 0).getDate();

/** Construye una fecha ISO ajustando el día al último del mes si se pasa (31 en febrero -> 28/29). */
export function fechaDelMes(anio, mes, dia) {
  const diaAjustado = Math.min(dia, diasDelMes(anio, mes));
  return `${anio}-${String(mes).padStart(2, '0')}-${String(diaAjustado).padStart(2, '0')}`;
}

export const primerDiaDelMes = (anio, mes) => fechaDelMes(anio, mes, 1);
export const ultimoDiaDelMes = (anio, mes) => fechaDelMes(anio, mes, 31);

/** Devuelve los últimos `n` periodos {anio, mes} terminando en el actual. */
export function ultimosMeses(n, referencia = new Date()) {
  const periodos = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(referencia.getFullYear(), referencia.getMonth() - i, 1);
    periodos.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  }
  return periodos;
}

/**
 * Interpreta una fecha escrita a mano o exportada por un banco:
 * "2025-03-04", "04/03/2025", "4-3-25". Devuelve ISO corto o null.
 */
export function parsearFecha(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return new Date(valor.getTime() - valor.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  if (typeof valor !== 'string') return null;

  const texto = valor.trim();
  if (!texto) return null;
  if (esFechaISO(texto.slice(0, 10))) return texto.slice(0, 10);

  const m = texto.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (!m) return null;

  const dia = Number(m[1]);
  const mes = Number(m[2]);
  let anio = Number(m[3]);
  if (anio < 100) anio += 2000;
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) return null;

  return fechaDelMes(anio, mes, dia);
}
