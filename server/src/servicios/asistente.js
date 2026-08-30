import { enTransaccion, obtenerBD } from '../db/conexion.js';
import { peticionInvalida } from '../utiles/errores.js';
import { guardarAjustes, obtenerAjustes } from './ajustes.js';
import { crearRecurrente, materializarPendientes } from './recurrentes.js';
import { cargarCatalogoTipico } from './reglas.js';

/**
 * Asistente de primer arranque.
 *
 * Antes, quien abría la aplicación por primera vez se encontraba un panel vacío
 * y tenía que descubrir por su cuenta que lo primero son los gastos fijos. Esto
 * pregunta lo imprescindible y deja la aplicación funcionando.
 *
 * Todo lo que crea es normal y editable después: no hay nada especial ni oculto.
 */

/** Gastos fijos que casi todo el mundo tiene, con la categoría a la que van. */
export const GASTOS_HABITUALES = [
  { clave: 'vivienda', nombre: 'Alquiler o hipoteca', categoria: 'Vivienda', dia: 1 },
  { clave: 'suministros', nombre: 'Luz, agua y gas', categoria: 'Suministros', dia: 8 },
  { clave: 'internet', nombre: 'Internet y móvil', categoria: 'Suministros', dia: 5 },
  { clave: 'suscripciones', nombre: 'Suscripciones', categoria: 'Suscripciones', dia: 3 },
  { clave: 'gimnasio', nombre: 'Gimnasio o deporte', categoria: 'Ocio', dia: 1 },
  { clave: 'seguro', nombre: 'Seguro del coche', categoria: 'Transporte', dia: 10 },
];

/**
 * Si la aplicación está recién estrenada.
 *
 * Se mira si hay datos reales, no una marca en los ajustes: alguien que borra su
 * base de datos para empezar de cero debería volver a ver el asistente.
 */
export function estado() {
  const bd = obtenerBD();
  const { movimientos } = bd.prepare('SELECT COUNT(*) AS movimientos FROM movimientos').get();
  const { recurrentes } = bd.prepare('SELECT COUNT(*) AS recurrentes FROM recurrentes').get();
  const { asistenteCompletado } = obtenerAjustes();

  return {
    vacia: movimientos === 0 && recurrentes === 0,
    completado: Boolean(asistenteCompletado),
    // Se ofrece mientras no haya datos y no se haya descartado antes.
    mostrar: movimientos === 0 && recurrentes === 0 && !asistenteCompletado,
    gastosHabituales: GASTOS_HABITUALES,
  };
}

/** Marca el asistente como visto sin crear nada. */
export function omitir() {
  guardarAjustes({ asistenteCompletado: 1 });
  return estado();
}

const idCategoria = (nombre) =>
  obtenerBD().prepare('SELECT id FROM categorias WHERE nombre = ? COLLATE NOCASE').get(nombre)?.id ?? null;

/**
 * Crea de una vez lo que el usuario ha declarado.
 *
 * Va en una transacción: o queda todo montado o no queda nada a medias, que es
 * peor que no haber empezado.
 */
export function completar({
  esAutonomo = false,
  ingreso = null,
  gastosFijos = [],
  colchonActual = 0,
  cuotaAutonomos = 0,
  cargarReglas = true,
}) {
  if (ingreso && ingreso.importe <= 0) throw peticionInvalida('El ingreso debe ser mayor que 0');

  const creado = enTransaccion(() => {
    const resumen = { ingreso: null, gastosFijos: [], reglas: 0 };

    // Fecha de inicio: el día 1 del mes en curso. Así no se generan meses
    // pasados que el usuario no ha vivido con la aplicación.
    const hoy = new Date();
    const inicio = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;

    if (ingreso && ingreso.importe > 0) {
      resumen.ingreso = crearRecurrente({
        nombre: esAutonomo ? 'Ingresos de la actividad' : 'Nómina',
        importe: ingreso.importe,
        tipo: 'ingreso',
        categoriaId: idCategoria(esAutonomo ? 'Otros ingresos' : 'Nómina'),
        diaDelMes: ingreso.diaDelMes ?? 25,
        fechaInicio: inicio,
      });
    }

    for (const gasto of gastosFijos) {
      if (!gasto.importe || gasto.importe <= 0) continue;

      const plantilla = GASTOS_HABITUALES.find((g) => g.clave === gasto.clave);
      resumen.gastosFijos.push(
        crearRecurrente({
          nombre: gasto.nombre ?? plantilla?.nombre ?? 'Gasto fijo',
          importe: gasto.importe,
          tipo: 'gasto',
          categoriaId: idCategoria(plantilla?.categoria ?? 'Otros gastos'),
          diaDelMes: gasto.diaDelMes ?? plantilla?.dia ?? 1,
          fechaInicio: inicio,
        })
      );
    }

    if (esAutonomo && cuotaAutonomos > 0) {
      resumen.gastosFijos.push(
        crearRecurrente({
          nombre: 'Cuota de autónomos',
          importe: cuotaAutonomos,
          tipo: 'gasto',
          categoriaId: idCategoria('Otros gastos'),
          diaDelMes: 1,
          fechaInicio: inicio,
        })
      );
    }

    return resumen;
  });

  guardarAjustes({
    asistenteCompletado: 1,
    modoAutonomo: esAutonomo ? 1 : 0,
    colchonActual: Math.max(colchonActual, 0),
    ...(esAutonomo && cuotaAutonomos > 0 ? { autonomoCuota: cuotaAutonomos } : {}),
    // Con 14 pagas se pregunta aparte; por defecto, 12.
    ...(ingreso?.pagasAlAnio ? { pagasAlAnio: ingreso.pagasAlAnio } : {}),
  });

  // El catálogo de reglas ahorra categorizar a mano desde el primer extracto.
  if (cargarReglas) {
    creado.reglas = cargarCatalogoTipico().creadas;
  }

  const { creados } = materializarPendientes();

  return { ...creado, movimientosGenerados: creados, estado: estado() };
}
