import { z } from 'zod';
import { esFechaISO } from '../utiles/fechas.js';

/**
 * Contrato de la API. La UI envía importes en EUROS (número); la capa de
 * servicios los convierte a céntimos. Todo lo que entra pasa por aquí.
 */

const fechaISO = z
  .string()
  .refine(esFechaISO, { message: 'La fecha debe tener formato AAAA-MM-DD' });

const importeEuros = z
  .number({ invalid_type_error: 'El importe debe ser un número' })
  .finite('El importe no es válido')
  .positive('El importe debe ser mayor que 0')
  .max(99_999_999, 'El importe es demasiado grande');

const tipo = z.enum(['ingreso', 'gasto'], {
  errorMap: () => ({ message: "El tipo debe ser 'ingreso' o 'gasto'" }),
});

const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'El color debe ser hexadecimal, por ejemplo #2563eb');

const idOpcional = z.coerce.number().int().positive().nullable().optional();

export const esquemaCategoria = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(60, 'Máximo 60 caracteres'),
  tipo,
  color: color.default('#64748b'),
  archivada: z.boolean().optional(),
});

export const esquemaCategoriaParcial = esquemaCategoria.partial();

export const esquemaMovimiento = z.object({
  fecha: fechaISO,
  importe: importeEuros,
  descripcion: z.string().trim().max(200, 'Máximo 200 caracteres').default(''),
  tipo,
  categoriaId: idOpcional,
  cuentaId: idOpcional,
});

export const esquemaMovimientoParcial = esquemaMovimiento.partial();

/**
 * Restaurar un movimiento recién borrado (el «Deshacer» del aviso).
 *
 * Se aceptan `origen` y `recurrenteId`, que en un alta normal no se pueden
 * enviar: un recibo de un gasto fijo que vuelve como movimiento manual perdería
 * su vínculo, y el índice único (recurrente_id, fecha) —el que impide que un
 * mismo recibo se genere dos veces— dejaría de protegerlo.
 */
export const esquemaRestaurarMovimiento = esquemaMovimiento.extend({
  origen: z.enum(['manual', 'recurrente', 'importacion']).default('manual'),
  recurrenteId: idOpcional,
});

export const esquemaFiltrosMovimientos = z.object({
  desde: fechaISO.optional(),
  hasta: fechaISO.optional(),
  tipo: tipo.optional(),
  categoriaId: z.coerce.number().int().positive().optional(),
  cuentaId: z.coerce.number().int().positive().optional(),
  texto: z.string().trim().max(100).optional(),
  origen: z.enum(['manual', 'recurrente', 'importacion']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(500).default(50),
});

export const esquemaRecurrente = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80, 'Máximo 80 caracteres'),
  importe: importeEuros,
  tipo,
  categoriaId: idOpcional,
  diaDelMes: z.coerce
    .number()
    .int()
    .min(1, 'El día debe estar entre 1 y 31')
    .max(31, 'El día debe estar entre 1 y 31'),
  fechaInicio: fechaISO,
  fechaFin: fechaISO.nullable().optional(),
  activo: z.boolean().default(true),
  // Meses entre repeticiones: 1 mensual, 3 trimestral, 6 semestral, 12 anual.
  periodicidad: z.coerce
    .number()
    .int()
    .refine((v) => [1, 2, 3, 6, 12].includes(v), { message: 'La periodicidad debe ser 1, 2, 3, 6 o 12 meses' })
    .default(1),
});

export const esquemaRecurrenteParcial = esquemaRecurrente.partial();

export const esquemaPresupuesto = z.object({
  categoriaId: z.coerce.number().int().positive('Selecciona una categoría'),
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
  importe: z
    .number({ invalid_type_error: 'El importe debe ser un número' })
    .finite()
    .nonnegative('El presupuesto no puede ser negativo')
    .max(99_999_999),
});

export const esquemaPeriodo = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
});

export const esquemaRangoResumen = z.object({
  desde: fechaISO.optional(),
  hasta: fechaISO.optional(),
});

export const esquemaRegla = z.object({
  patron: z
    .string()
    .trim()
    .min(1, 'Escribe el texto que debe aparecer en el concepto')
    .max(120, 'Máximo 120 caracteres'),
  coincidencia: z
    .enum(['contiene', 'empieza', 'termina', 'exacto'], {
      errorMap: () => ({ message: 'Tipo de coincidencia no válido' }),
    })
    .default('contiene'),
  categoriaId: z.coerce.number().int().positive('Selecciona una categoría'),
  prioridad: z.coerce.number().int().min(0).optional(),
  activa: z.boolean().default(true),
});

export const esquemaReglaParcial = esquemaRegla.partial();

export const esquemaPruebaRegla = z.object({
  texto: z.string().trim().min(1, 'Escribe un texto de ejemplo').max(200),
  tipo: z.enum(['ingreso', 'gasto']).default('gasto'),
});

export const esquemaSugerencias = z.object({
  filas: z
    .array(
      z.object({
        descripcion: z.string().max(200).default(''),
        tipo: z.enum(['ingreso', 'gasto']),
      })
    )
    .max(10_000, 'Demasiadas filas'),
});

const servicioVerificado = z.boolean().nullable().optional();

export const esquemaCandidato = z.object({
  municipio: z.string().trim().min(1, 'Escribe el nombre del municipio').max(80),
  provincia: z.string().trim().max(60).default(''),
  comunidad: z.string().trim().max(60).default(''),
  precioM2: z.coerce.number().int().min(0).max(20_000).nullable().optional(),
  metros: z.coerce.number().int().min(20).max(1000).default(90),
  poblacion: z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
  notas: z.string().trim().max(500).default(''),
  servicios: z
    .object({
      fibra: servicioVerificado,
      supermercado: servicioVerificado,
      centroSalud: servicioVerificado,
      farmacia: servicioVerificado,
      transporte: servicioVerificado,
    })
    .default({}),
});

export const esquemaAsistente = z.object({
  esAutonomo: z.boolean().default(false),
  ingreso: z
    .object({
      importe: z.coerce.number().positive('El ingreso debe ser mayor que 0').max(9_999_999),
      diaDelMes: z.coerce.number().int().min(1).max(31).default(25),
      pagasAlAnio: z.coerce.number().int().min(12).max(16).optional(),
    })
    .nullable()
    .optional(),
  gastosFijos: z
    .array(
      z.object({
        clave: z.string().trim().max(40),
        nombre: z.string().trim().max(80).optional(),
        importe: z.coerce.number().nonnegative().max(9_999_999),
        diaDelMes: z.coerce.number().int().min(1).max(31).optional(),
      })
    )
    .max(20)
    .default([]),
  colchonActual: z.coerce.number().nonnegative().max(9_999_999).default(0),
  cuotaAutonomos: z.coerce.number().nonnegative().max(5000).default(0),
  cargarReglas: z.boolean().default(true),
});

export const esquemaCuenta = z.object({
  nombre: z.string().trim().min(1, 'Ponle un nombre a la cuenta').max(60, 'Máximo 60 caracteres'),
  tipo: z
    .enum(['corriente', 'ahorro', 'efectivo', 'tarjeta'], {
      errorMap: () => ({ message: 'Tipo de cuenta no válido' }),
    })
    .default('corriente'),
  saldoInicial: z.coerce.number().min(-9_999_999).max(9_999_999).default(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'El color debe ser hexadecimal').default('#2563eb'),
  activa: z.boolean().optional(),
});

export const esquemaCuentaParcial = esquemaCuenta.partial();

export const esquemaTraspaso = z.object({
  fecha: fechaISO,
  importe: z.coerce.number().positive('El importe debe ser mayor que 0').max(9_999_999),
  origenId: z.coerce.number().int().positive('Elige la cuenta de origen'),
  destinoId: z.coerce.number().int().positive('Elige la cuenta de destino'),
  descripcion: z.string().trim().max(200).default(''),
});

export const esquemaMeta = z.object({
  nombre: z.string().trim().min(1, 'Ponle un nombre al objetivo').max(80, 'Máximo 80 caracteres'),
  objetivo: z.coerce.number().positive('El objetivo debe ser mayor que 0').max(9_999_999),
  ahorrado: z.coerce.number().nonnegative('Lo ahorrado no puede ser negativo').max(9_999_999).default(0),
  fechaObjetivo: fechaISO.nullable().optional(),
  notas: z.string().trim().max(300).default(''),
});

export const esquemaMetaParcial = esquemaMeta.partial();

export const esquemaAportacion = z.object({
  importe: z.coerce.number().refine((v) => v !== 0, { message: 'La aportación no puede ser 0' }),
});

export const esquemaFactura = z.object({
  fecha: fechaISO,
  base: z.coerce.number().positive('La base imponible debe ser mayor que 0').max(9_999_999),
  tipoIva: z.coerce.number().min(0).max(21).default(21),
  tipoIrpf: z.coerce.number().min(0).max(47).default(0),
  descripcion: z.string().trim().max(200).default(''),
  tipo: z.enum(['ingreso', 'gasto']),
  categoriaId: z.coerce.number().int().positive().nullable().optional(),
  cliente: z.string().trim().max(80).nullable().optional(),
});

export const esquemaAnio = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
});

export const esquemaSuministros = z.object({
  importeMensual: z.coerce.number().positive('El importe debe ser mayor que 0').max(99_999),
  porcentajeSuperficieAfecta: z.coerce
    .number()
    .min(0, 'El porcentaje no puede ser negativo')
    .max(100, 'No puedes afectar más del 100 % de la vivienda'),
});

export const esquemaTrimestre = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  trimestre: z.coerce.number().int().min(1).max(4),
});

export const esquemaAjustes = z
  .object({
    objetivoAhorro: z.coerce
      .number()
      .min(0, 'El objetivo no puede ser negativo')
      .max(90, 'Un objetivo por encima del 90 % no es realista'),
    mesesFondoEmergencia: z.coerce
      .number()
      .int()
      .min(1, 'El colchón debe cubrir al menos 1 mes')
      .max(24, 'Como máximo 24 meses'),
    colchonActual: z.coerce
      .number()
      .nonnegative('El colchón no puede ser negativo')
      .max(99_999_999, 'El importe es demasiado grande'),
    pagasAlAnio: z.coerce
      .number()
      .int()
      .min(12, 'Lo habitual en España es 12 o 14 pagas')
      .max(16, 'Lo habitual en España es 12 o 14 pagas'),
    modoAutonomo: z.union([z.boolean(), z.coerce.number().int().min(0).max(1)]).transform((v) => (v ? 1 : 0)),
    asistenteCompletado: z
      .union([z.boolean(), z.coerce.number().int().min(0).max(1)])
      .transform((v) => (v ? 1 : 0)),
    autonomoCuota: z.coerce.number().nonnegative('La cuota no puede ser negativa').max(5000),
    autonomoTipoIva: z.coerce.number().min(0).max(21),
    autonomoTipoIrpf: z.coerce.number().min(0).max(47),
  })
  .partial();

export const esquemaImportacion = z.object({
  crearCategorias: z.boolean().default(false),
  aplicarReglas: z.boolean().default(true),
  movimientos: z
    .array(
      z.object({
        fecha: fechaISO,
        importe: importeEuros,
        descripcion: z.string().trim().max(200).default(''),
        tipo,
        categoria: z.string().trim().max(60).nullable().optional(),
      })
    )
    .min(1, 'No hay movimientos que importar')
    .max(10_000, 'Demasiadas filas en una sola importación'),
});

/** Valida y devuelve los datos, o lanza un ErrorHttp 400 con el detalle por campo. */
export function validar(esquema, datos) {
  const resultado = esquema.safeParse(datos);
  if (resultado.success) return resultado.data;

  const detalles = resultado.error.issues.map((issue) => ({
    campo: issue.path.join('.') || '(raíz)',
    mensaje: issue.message,
  }));

  const error = new Error('Los datos enviados no son válidos');
  error.estado = 400;
  error.detalles = detalles;
  throw error;
}
