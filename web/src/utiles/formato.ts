const formateadorEuros = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const formateadorCompacto = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export const euros = (valor: number | null | undefined) =>
  valor === null || valor === undefined ? '—' : formateadorEuros.format(valor);

export const eurosCompacto = (valor: number) => formateadorCompacto.format(valor);

export const porcentaje = (valor: number | null | undefined, decimales = 1) =>
  valor === null || valor === undefined ? '—' : `${valor.toFixed(decimales).replace('.', ',')} %`;

/** Número decimal en formato español: 3,05 en lugar de 3.05. */
export const numero = (valor: number, decimales = 2) =>
  valor.toLocaleString('es-ES', { maximumFractionDigits: decimales });

export const fechaLegible = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const nombreMes = (mes: number) => MESES[mes - 1] ?? '';

export const hoyISO = () => {
  const ahora = new Date();
  return new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const primerDiaDelMes = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, '0')}-01`;

export const ultimoDiaDelMes = (anio: number, mes: number) =>
  `${anio}-${String(mes).padStart(2, '0')}-${String(new Date(anio, mes, 0).getDate()).padStart(2, '0')}`;

/** Convierte "1.234,56" o "1234.56" (lo que teclee el usuario) a número. */
export const aNumero = (texto: string | null | undefined): number | null => {
  // Acepta null/undefined a propósito: quien lee un campo de un Record por clave
  // recibe undefined si nadie lo ha tocado, y TypeScript no lo avisa. Un
  // formulario a medio rellenar es lo normal, no un error.
  if (texto == null) return null;
  const limpio = texto.trim().replace(/[€\s]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  if (!limpio) return null;
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
};
