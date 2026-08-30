import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { enTransaccion, obtenerBD } from '../db/conexion.js';
import { config } from '../config.js';
import { aCentimos } from '../utiles/dinero.js';
import { parsearFecha } from '../utiles/fechas.js';
import { peticionInvalida } from '../utiles/errores.js';
import { buscarOCrearPorNombre } from './categorias.js';
import { categorizar, listarReglas } from './reglas.js';
import { listarTodosParaExportar } from './movimientos.js';

/**
 * Importación / exportación en CSV y Excel.
 *
 * La importación es en dos pasos y sin estado en el servidor:
 *   1. `analizarFichero` devuelve columnas y filas crudas -> la UI mapea columnas
 *      y enseña la vista previa.
 *   2. `importarMovimientos` recibe las filas ya mapeadas y las inserta en una
 *      única transacción (o todo, o nada).
 */

const CABECERAS = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Importe'];

const aFilaExportable = (m) => ({
  Fecha: m.fecha,
  Tipo: m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto',
  'Categoría': m.categoriaNombre ?? '',
  'Descripción': m.descripcion,
  Importe: m.importe,
});

export function exportar(filtros = {}, formato = 'xlsx') {
  const movimientos = listarTodosParaExportar(filtros);
  const hoja = XLSX.utils.json_to_sheet(movimientos.map(aFilaExportable), { header: CABECERAS });

  if (formato === 'csv') {
    // Punto y coma + BOM: es lo que espera Excel en configuración regional española.
    const csv = XLSX.utils.sheet_to_csv(hoja, { FS: ';' });
    return {
      contenido: Buffer.from(`\uFEFF${csv}`, 'utf8'),
      tipoMime: 'text/csv; charset=utf-8',
      extension: 'csv',
      filas: movimientos.length,
    };
  }

  hoja['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 40 }, { wch: 12 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Movimientos');

  return {
    contenido: XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }),
    tipoMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
    filas: movimientos.length,
  };
}

/** Plantilla vacía para que el usuario sepa qué columnas rellenar. */
export function plantillaImportacion() {
  const ejemplo = [
    { Fecha: '2025-01-31', Tipo: 'Ingreso', 'Categoría': 'Nómina', 'Descripción': 'Nómina enero', Importe: 2100 },
    { Fecha: '2025-02-03', Tipo: 'Gasto', 'Categoría': 'Alimentación', 'Descripción': 'Compra semanal', Importe: 64.35 },
  ];
  const hoja = XLSX.utils.json_to_sheet(ejemplo, { header: CABECERAS });
  hoja['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 40 }, { wch: 12 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Movimientos');

  return {
    contenido: XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }),
    tipoMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
  };
}

const normalizar = (texto) =>
  String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// El orden importa: se resuelven de más específico a menos, y una columna ya
// asignada no vuelve a ofrecerse. Sin esto, "Fecha valor" (habitual en los
// extractos bancarios) se llevaba el campo importe por la pista "valor".
const PISTAS = {
  fecha: ['fecha', 'date', 'fecha operacion', 'fecha valor', 'f. valor'],
  importe: ['importe', 'cantidad', 'amount', 'euros', 'monto', 'valor'],
  descripcion: ['descripcion', 'concepto', 'detalle', 'description', 'observaciones'],
  categoria: ['categoria', 'category', 'tipo de gasto', 'subcategoria'],
  tipo: ['tipo', 'type', 'movimiento', 'ingreso/gasto'],
};

/**
 * Propone qué columna del fichero corresponde a cada campo, por nombre de cabecera.
 *
 * Dos pasadas: primero las coincidencias exactas de todos los campos y despues
 * las parciales. Asi una columna llamada exactamente "Importe" gana el campo
 * importe antes de que "Fecha valor" pueda reclamarlo por coincidencia parcial.
 * Cada columna se asigna a un unico campo.
 */
function sugerirMapeo(columnas) {
  const sugerencia = { fecha: null, importe: null, descripcion: null, categoria: null, tipo: null };
  const asignadas = new Set();

  const asignar = (comparar) => {
    for (const [campo, pistas] of Object.entries(PISTAS)) {
      if (sugerencia[campo]) continue;

      const encontrada = columnas.find(
        (col) => !asignadas.has(col) && pistas.some((pista) => comparar(normalizar(col), pista))
      );

      if (encontrada) {
        sugerencia[campo] = encontrada;
        asignadas.add(encontrada);
      }
    }
  };

  asignar((columna, pista) => columna === pista);
  asignar((columna, pista) => columna.includes(pista));

  return sugerencia;
}

/** Un .xlsx es un zip: empieza por la firma PK. Un .csv es texto plano. */
const esLibroBinario = (buffer) => buffer.subarray(0, 2).toString('latin1') === 'PK';

/**
 * Fecha a ISO corto usando las partes locales.
 *
 * `toISOString()` pasaría por UTC y en España restaría un día a las fechas
 * de medianoche.
 */
const fechaAISO = (fecha) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;

/** Todo llega a la vista previa como texto: es lo que el usuario ve y mapea. */
const normalizarCelda = (valor) => {
  if (valor instanceof Date) return fechaAISO(valor);
  if (typeof valor === 'number') return String(valor);
  return String(valor ?? '');
};

/** Lee un CSV/XLSX en memoria y devuelve columnas + filas crudas para la vista previa. */
export function analizarFichero(buffer, nombreFichero = '') {
  let libro;
  try {
    // En CSV se desactiva la inferencia de tipos: SheetJS interpreta "01/08/2026"
    // como fecha estadounidense (8 de enero) y la reescribe, corrompiendo en
    // silencio las filas cuyo día es menor o igual que 12. El texto crudo se lo
    // queda `parsearFecha`, que sí asume el formato español (día primero).
    // En un .xlsx real las fechas sí son celdas con tipo y conviene conservarlas.
    libro = esLibroBinario(buffer)
      ? XLSX.read(buffer, { type: 'buffer', cellDates: true })
      : XLSX.read(buffer, { type: 'buffer', raw: true });
  } catch {
    throw peticionInvalida('No se ha podido leer el fichero. ¿Es un CSV o un Excel válido?');
  }

  const nombreHoja = libro.SheetNames[0];
  if (!nombreHoja) throw peticionInvalida('El fichero no contiene ninguna hoja de datos');

  const filasCrudas = XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { defval: '', raw: true });
  if (filasCrudas.length === 0) throw peticionInvalida('El fichero no contiene filas de datos');

  const filas = filasCrudas.map((fila) =>
    Object.fromEntries(Object.entries(fila).map(([clave, valor]) => [clave, normalizarCelda(valor)]))
  );

  const columnas = Object.keys(filas[0]);

  return {
    nombreFichero,
    hoja: nombreHoja,
    columnas,
    sugerencia: sugerirMapeo(columnas),
    totalFilas: filas.length,
    filas,
  };
}

/**
 * Inserta las filas ya mapeadas y validadas por la UI. Todo en una transacción:
 * si una fila falla, no se importa ninguna.
 */
export function importarMovimientos({ movimientos, crearCategorias = false, aplicarReglas = true }) {
  const bd = obtenerBD();

  return enTransaccion(() => {
    const insertar = bd.prepare(
      `INSERT INTO movimientos (fecha, importe_centimos, descripcion, tipo, categoria_id, origen)
       VALUES (?, ?, ?, ?, ?, 'importacion')`
    );

    const categoriasCreadas = new Set();
    const sinCategoria = [];
    // Se cargan una vez: evaluarlas releyendo la tabla por fila serian N consultas.
    const reglas = aplicarReglas ? listarReglas() : [];
    let importados = 0;
    let categorizadosPorRegla = 0;

    movimientos.forEach((mov, indice) => {
      let categoriaId = null;

      if (mov.categoria) {
        const existiaAntes = buscarOCrearPorNombre(mov.categoria, mov.tipo) !== null;
        categoriaId = buscarOCrearPorNombre(mov.categoria, mov.tipo, { crear: crearCategorias });

        if (categoriaId === null) {
          sinCategoria.push({ fila: indice + 1, categoria: mov.categoria });
        } else if (!existiaAntes) {
          categoriasCreadas.add(`${mov.categoria} (${mov.tipo})`);
        }
      }

      // La categoria explicita del fichero manda; las reglas solo rellenan huecos.
      if (categoriaId === null && aplicarReglas) {
        const encontrada = categorizar(mov.descripcion, mov.tipo, reglas);
        if (encontrada) {
          categoriaId = encontrada.categoriaId;
          categorizadosPorRegla += 1;
        }
      }

      insertar.run(mov.fecha, aCentimos(mov.importe), mov.descripcion ?? '', mov.tipo, categoriaId);
      importados += 1;
    });

    return {
      importados,
      categorizadosPorRegla,
      categoriasCreadas: [...categoriasCreadas],
      sinCategoria,
    };
  });
}

/** Reexportado para que las rutas normalicen fechas de ficheros externos. */
export { parsearFecha };

/**
 * Copia de seguridad de la base de datos completa.
 *
 * Se usa `VACUUM INTO` y no una copia del fichero: con el modo WAL activo, parte
 * de los datos recientes vive en el fichero -wal, así que copiar solo el .db
 * puede dar una copia incompleta. VACUUM INTO produce una copia consistente y
 * además compactada.
 */
export function copiaSeguridad() {
  const bd = obtenerBD();
  const destino = path.join(os.tmpdir(), `copia-gastos-${Date.now()}.db`);

  bd.prepare('VACUUM INTO ?').run(destino);

  const contenido = fs.readFileSync(destino);
  fs.rmSync(destino, { force: true });

  return {
    contenido,
    tipoMime: 'application/octet-stream',
    nombre: `copia-gastos-${new Date().toISOString().slice(0, 10)}.db`,
    tamano: contenido.length,
    origen: config.rutaBaseDatos,
  };
}
