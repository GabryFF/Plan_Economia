import type { Tipo } from '../tipos';

/** Cómo se decide si una fila es ingreso o gasto. */
export type ReglaTipo = 'columna' | 'signo' | 'todo-gasto' | 'todo-ingreso';

export interface Mapeo {
  fecha: string;
  importe: string;
  descripcion: string;
  categoria: string;
  tipo: string;
  reglaTipo: ReglaTipo;
}

export interface FilaPreparada {
  indice: number;
  fecha: string | null;
  importe: number | null;
  descripcion: string;
  categoria: string | null;
  tipo: Tipo | null;
  errores: string[];
}

const diasDelMes = (anio: number, mes: number) => new Date(anio, mes, 0).getDate();

/** Acepta "2025-03-04", "04/03/2025", "4-3-25" y valores de fecha de Excel. */
export function parsearFecha(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  if (!texto) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) {
    const iso = texto.slice(0, 10);
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  }

  const partes = texto.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (!partes) return null;

  const dia = Number(partes[1]);
  const mes = Number(partes[2]);
  let anio = Number(partes[3]);
  if (anio < 100) anio += 2000;
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) return null;

  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Acepta "1.234,56 €", "1,234.56", "-45,20", "(45,20)". Devuelve el número con signo. */
export function parsearImporte(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (valor === null || valor === undefined) return null;

  let texto = String(valor).trim().replace(/[€$\s ]/g, '');
  if (!texto) return null;

  const negativo = texto.startsWith('-') || /^\(.*\)$/.test(texto);
  texto = texto.replace(/[()]/g, '').replace(/^[+-]/, '');

  const tieneComa = texto.includes(',');
  const tienePunto = texto.includes('.');

  if (tieneComa && tienePunto) {
    const decimal = texto.lastIndexOf(',') > texto.lastIndexOf('.') ? ',' : '.';
    const miles = decimal === ',' ? '.' : ',';
    texto = texto.split(miles).join('').replace(decimal, '.');
  } else if (tieneComa) {
    const decimales = texto.split(',')[1] ?? '';
    texto = decimales.length === 3 ? texto.replace(',', '') : texto.replace(',', '.');
  }

  const numero = Number(texto);
  if (!Number.isFinite(numero)) return null;

  return negativo ? -Math.abs(numero) : numero;
}

const NORMALIZAR = (texto: string) =>
  texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const PALABRAS_INGRESO = ['ingreso', 'ingresos', 'abono', 'haber', 'entrada', 'nomina', 'income', 'credito'];
const PALABRAS_GASTO = ['gasto', 'gastos', 'cargo', 'debe', 'salida', 'pago', 'expense', 'debito'];

function tipoDesdeTexto(valor: string): Tipo | null {
  const normalizado = NORMALIZAR(valor);
  if (!normalizado) return null;
  if (PALABRAS_INGRESO.some((p) => normalizado.includes(p))) return 'ingreso';
  if (PALABRAS_GASTO.some((p) => normalizado.includes(p))) return 'gasto';
  return null;
}

/**
 * Aplica el mapeo de columnas a las filas crudas y valida cada una.
 * Las filas con errores se muestran en la vista previa y no se importan.
 */
export function prepararFilas(filas: Record<string, unknown>[], mapeo: Mapeo): FilaPreparada[] {
  return filas.map((fila, indice) => {
    const errores: string[] = [];

    const fecha = parsearFecha(mapeo.fecha ? fila[mapeo.fecha] : null);
    if (!fecha) errores.push('Fecha no reconocida');

    const importeCrudo = parsearImporte(mapeo.importe ? fila[mapeo.importe] : null);
    if (importeCrudo === null) errores.push('Importe no reconocido');
    else if (importeCrudo === 0) errores.push('El importe es 0');

    let tipo: Tipo | null = null;
    if (mapeo.reglaTipo === 'todo-gasto') tipo = 'gasto';
    else if (mapeo.reglaTipo === 'todo-ingreso') tipo = 'ingreso';
    else if (mapeo.reglaTipo === 'signo') tipo = importeCrudo === null ? null : importeCrudo < 0 ? 'gasto' : 'ingreso';
    else {
      const bruto = mapeo.tipo ? String(fila[mapeo.tipo] ?? '') : '';
      tipo = tipoDesdeTexto(bruto);
      if (!tipo) errores.push(`No se entiende el tipo "${bruto}"`);
    }

    const descripcion = mapeo.descripcion ? String(fila[mapeo.descripcion] ?? '').trim().slice(0, 200) : '';
    const categoriaBruta = mapeo.categoria ? String(fila[mapeo.categoria] ?? '').trim() : '';

    return {
      indice,
      fecha,
      importe: importeCrudo === null ? null : Math.abs(importeCrudo),
      descripcion,
      categoria: categoriaBruta || null,
      tipo,
      errores,
    };
  });
}
