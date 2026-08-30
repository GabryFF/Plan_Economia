/**
 * Referencias para España: catálogo de reglas típicas y reparto orientativo
 * del presupuesto.
 *
 * Todo lo que hay aquí son valores por defecto y referencias divulgativas.
 * El usuario puede cambiarlos, borrarlos o ignorarlos.
 */

/**
 * Catálogo de reglas de categorización típicas.
 *
 * EL ORDEN ES SIGNIFICATIVO: se insertan en este orden y gana la primera que
 * coincide, así que las específicas van antes que las genéricas
 * (AMAZON PRIME antes que AMAZON, UBER EATS antes que UBER).
 *
 * Las categorías se referencian por nombre porque son las que crea la semilla
 * inicial; si el usuario ha borrado alguna, esas reglas se omiten.
 */
export const CATALOGO_REGLAS_ES = [
  // --- Específicas primero: comparten prefijo con otra más genérica ---
  { patron: 'AMAZON PRIME', categoria: 'Suscripciones' },
  { patron: 'UBER EATS', categoria: 'Ocio' },
  { patron: 'REPSOL LUZ', categoria: 'Suministros' },
  { patron: 'MOVISTAR PLUS', categoria: 'Suscripciones' },

  // --- Alimentación ---
  { patron: 'MERCADONA', categoria: 'Alimentación' },
  { patron: 'CARREFOUR', categoria: 'Alimentación' },
  { patron: 'LIDL', categoria: 'Alimentación' },
  { patron: 'ALCAMPO', categoria: 'Alimentación' },
  { patron: 'AHORRAMAS', categoria: 'Alimentación' },
  { patron: 'EROSKI', categoria: 'Alimentación' },
  { patron: 'CONSUM', categoria: 'Alimentación' },
  { patron: 'ALDI', categoria: 'Alimentación' },
  // "DIA" a secas capturaría GUARDIA, DIARIO o MEDIA: se usa el nombre completo.
  { patron: 'SUPERMERCADOS DIA', categoria: 'Alimentación' },

  // --- Transporte ---
  { patron: 'REPSOL', categoria: 'Transporte' },
  { patron: 'CEPSA', categoria: 'Transporte' },
  { patron: 'GALP', categoria: 'Transporte' },
  { patron: 'RENFE', categoria: 'Transporte' },
  { patron: 'ALSA', categoria: 'Transporte' },
  { patron: 'CABIFY', categoria: 'Transporte' },
  { patron: 'UBER', categoria: 'Transporte' },
  { patron: 'BLABLACAR', categoria: 'Transporte' },
  { patron: 'PARKING', categoria: 'Transporte' },
  { patron: 'AUTOPISTA', categoria: 'Transporte' },
  { patron: 'ITV', categoria: 'Transporte' },

  // --- Suministros ---
  { patron: 'IBERDROLA', categoria: 'Suministros' },
  { patron: 'ENDESA', categoria: 'Suministros' },
  { patron: 'NATURGY', categoria: 'Suministros' },
  { patron: 'TOTALENERGIES', categoria: 'Suministros' },
  { patron: 'CANAL DE ISABEL', categoria: 'Suministros' },
  { patron: 'AGUAS DE', categoria: 'Suministros' },
  { patron: 'MOVISTAR', categoria: 'Suministros' },
  { patron: 'VODAFONE', categoria: 'Suministros' },
  { patron: 'ORANGE', categoria: 'Suministros' },
  { patron: 'YOIGO', categoria: 'Suministros' },
  { patron: 'PEPEPHONE', categoria: 'Suministros' },
  { patron: 'DIGI', categoria: 'Suministros' },

  // --- Suscripciones ---
  { patron: 'NETFLIX', categoria: 'Suscripciones' },
  { patron: 'SPOTIFY', categoria: 'Suscripciones' },
  { patron: 'HBO', categoria: 'Suscripciones' },
  { patron: 'DISNEY', categoria: 'Suscripciones' },
  { patron: 'FILMIN', categoria: 'Suscripciones' },
  { patron: 'DAZN', categoria: 'Suscripciones' },
  { patron: 'APPLE.COM/BILL', categoria: 'Suscripciones' },
  { patron: 'GOOGLE STORAGE', categoria: 'Suscripciones' },
  { patron: 'ICLOUD', categoria: 'Suscripciones' },

  // --- Vivienda ---
  { patron: 'ALQUILER', categoria: 'Vivienda' },
  { patron: 'HIPOTECA', categoria: 'Vivienda' },
  { patron: 'COMUNIDAD DE PROP', categoria: 'Vivienda' },
  { patron: 'SEGURO HOGAR', categoria: 'Vivienda' },
  { patron: 'IBI', coincidencia: 'exacto', categoria: 'Vivienda' },

  // --- Salud ---
  { patron: 'FARMACIA', categoria: 'Salud' },
  { patron: 'SANITAS', categoria: 'Salud' },
  { patron: 'ADESLAS', categoria: 'Salud' },
  { patron: 'DKV', categoria: 'Salud' },
  { patron: 'ASISA', categoria: 'Salud' },
  { patron: 'CLINICA', categoria: 'Salud' },
  { patron: 'DENTAL', categoria: 'Salud' },
  { patron: 'OPTICA', categoria: 'Salud' },

  // --- Ocio ---
  { patron: 'GLOVO', categoria: 'Ocio' },
  { patron: 'JUST EAT', categoria: 'Ocio' },
  { patron: 'RESTAURANTE', categoria: 'Ocio' },
  { patron: 'CERVECERIA', categoria: 'Ocio' },
  { patron: 'CINESA', categoria: 'Ocio' },
  { patron: 'YELMO', categoria: 'Ocio' },
  { patron: 'BOOKING', categoria: 'Ocio' },
  { patron: 'AIRBNB', categoria: 'Ocio' },
  { patron: 'RYANAIR', categoria: 'Ocio' },
  { patron: 'VUELING', categoria: 'Ocio' },
  { patron: 'IBERIA', categoria: 'Ocio' },
  { patron: 'STEAM', categoria: 'Ocio' },
  { patron: 'PLAYSTATION', categoria: 'Ocio' },
  { patron: 'NINTENDO', categoria: 'Ocio' },
  { patron: 'BASIC FIT', categoria: 'Ocio' },
  { patron: 'MCFIT', categoria: 'Ocio' },
  { patron: 'ALTAFIT', categoria: 'Ocio' },
  { patron: 'VIVAGYM', categoria: 'Ocio' },

  // --- Compras ---
  { patron: 'AMAZON', categoria: 'Compras' },
  { patron: 'EL CORTE INGLES', categoria: 'Compras' },
  { patron: 'ZARA', categoria: 'Compras' },
  { patron: 'DECATHLON', categoria: 'Compras' },
  { patron: 'IKEA', categoria: 'Compras' },
  { patron: 'LEROY MERLIN', categoria: 'Compras' },
  { patron: 'MEDIAMARKT', categoria: 'Compras' },
  { patron: 'PRIMARK', categoria: 'Compras' },
  { patron: 'ALIEXPRESS', categoria: 'Compras' },
  { patron: 'PCCOMPONENTES', categoria: 'Compras' },

  // --- Otros gastos ---
  { patron: 'MAPFRE', categoria: 'Otros gastos' },
  { patron: 'LINEA DIRECTA', categoria: 'Otros gastos' },
  { patron: 'MUTUA MADRILENA', categoria: 'Otros gastos' },
  { patron: 'COMISION', categoria: 'Otros gastos' },
  { patron: 'AEAT', categoria: 'Otros gastos' },

  // --- Ingresos ---
  { patron: 'NOMINA', categoria: 'Nómina' },
  { patron: 'PAGA EXTRA', categoria: 'Nómina' },
  { patron: 'SEPE', categoria: 'Otros ingresos' },
  { patron: 'DEVOLUCION', categoria: 'Otros ingresos' },
  { patron: 'INTERESES', categoria: 'Otros ingresos' },
];

/**
 * Reparto orientativo del presupuesto, en % de los ingresos NETOS mensuales
 * recurrentes (lo que se cobra un mes normal, sin pagas extra).
 *
 * `mediaEspana` es el peso real de esa partida en el GASTO de un hogar español
 * (INE, Encuesta de Presupuestos Familiares 2024). Ojo: ese porcentaje es sobre
 * el gasto total, no sobre los ingresos, así que sirve para comparar hábitos,
 * no para sumarlo con min/max.
 *
 * Los máximos no suman 100 a propósito: son topes por partida, no un reparto.
 */
export const PERFIL_ESTANDAR = {
  Vivienda: { min: 25, max: 30, mediaEspana: null, nota: 'Alquiler o hipoteca. La referencia más extendida es no pasar del 30 %.' },
  Alimentación: { min: 10, max: 15, mediaEspana: 16, nota: 'Compra del supermercado, sin restaurantes.' },
  Transporte: { min: 8, max: 15, mediaEspana: 11.5, nota: 'Combustible, transporte público, seguro y mantenimiento del coche.' },
  Suministros: { min: 5, max: 8, mediaEspana: null, nota: 'Luz, agua, gas, internet y móvil.' },
  Ocio: { min: 5, max: 10, mediaEspana: 9.3, nota: 'Cenar fuera, cine, videojuegos, viajes y gimnasio.' },
  Compras: { min: 3, max: 5, mediaEspana: null, nota: 'Ropa, electrónica, hogar: lo que no es de primera necesidad.' },
  Salud: { min: 3, max: 5, mediaEspana: null, nota: 'Farmacia, seguro médico, dentista y óptica.' },
  Suscripciones: { min: 1, max: 3, mediaEspana: null, nota: 'Se acumulan sin darte cuenta: revísalas cada semestre.' },
  'Otros gastos': { min: 3, max: 5, mediaEspana: null, nota: 'Seguros, impuestos, comisiones e imprevistos pequeños.' },
  'Ahorro/Inversión': { min: 15, max: 20, mediaEspana: null, nota: 'El tramo de ahorro de la regla 50/30/20.' },
};

/**
 * Perfil para rentas ajustadas (por debajo de UMBRAL_RENTA_AJUSTADA al mes).
 *
 * No es el mismo reparto reducido: los porcentajes cambian de forma. Cuanto
 * menor es la renta, más pesan los gastos que no se pueden comprimir —es la ley
 * de Engel, y el propio INE lo mide: en los hogares de menor gasto la vivienda
 * llega al 41,9 % del presupuesto frente al 28,9 % en los de mayor gasto—.
 *
 * Aplicar aquí el 50/30/20 sin más produciría un plan que no se puede cumplir, y
 * un presupuesto incumplible se abandona a la primera semana.
 */
export const PERFIL_RENTA_AJUSTADA = {
  Vivienda: { min: 25, max: 35, mediaEspana: null, nota: 'El ideal sigue siendo el 30 %, pero con esta renta suele exigir compartir piso o alejarse del centro. Por encima del 35 % el resto del presupuesto no cuadra.' },
  Alimentación: { min: 13, max: 18, mediaEspana: 16, nota: 'Pesa más cuanto menor es la renta: es el gasto menos comprimible.' },
  Transporte: { min: 10, max: 16, mediaEspana: 11.5, nota: 'Con el carburante en máximos, si dependes del coche vete a la parte alta del rango.' },
  Suministros: { min: 6, max: 9, mediaEspana: null, nota: 'Luz, agua, gas, internet y móvil. Poco comprimible salvo cambiando de tarifa.' },
  Ocio: { min: 4, max: 8, mediaEspana: 9.3, nota: 'Cenar fuera, cine, videojuegos y viajes. Es la partida con más margen real de recorte.' },
  Compras: { min: 2, max: 4, mediaEspana: null, nota: 'Ropa, electrónica, hogar.' },
  Salud: { min: 2, max: 4, mediaEspana: null, nota: 'Farmacia y dentista. El seguro privado es prescindible si usas la pública.' },
  Suscripciones: { min: 1, max: 2, mediaEspana: null, nota: 'A esta renta, 30 € al mes en suscripciones son casi un 2 % de tus ingresos.' },
  'Otros gastos': { min: 3, max: 5, mediaEspana: null, nota: 'Seguros, impuestos, comisiones e imprevistos pequeños.' },
  'Ahorro/Inversión': { min: 10, max: 15, mediaEspana: null, nota: 'Objetivo mensual realista. Las pagas extra son la vía para acercarse al 20 % anual.' },
};

/** Por debajo de esta renta mensual recurrente se usa el perfil ajustado. */
export const UMBRAL_RENTA_AJUSTADA = 1800;

/**
 * Elige el perfil de referencia según el ingreso mensual recurrente.
 * Sin ingresos conocidos se usa el estándar, que es el más citado.
 */
export function perfilPara(ingresoMensual) {
  const usarAjustado = ingresoMensual > 0 && ingresoMensual < UMBRAL_RENTA_AJUSTADA;

  return {
    clave: usarAjustado ? 'renta-ajustada' : 'estandar',
    etiqueta: usarAjustado ? 'Ajustado a tu renta' : 'Estándar (50/30/20)',
    referencias: usarAjustado ? PERFIL_RENTA_AJUSTADA : PERFIL_ESTANDAR,
  };
}

/** Compatibilidad: el perfil estándar es la tabla de referencia por defecto. */
export const REFERENCIAS_PRESUPUESTO = PERFIL_ESTANDAR;

/** Referencia de una categoría por nombre dentro de un perfil, o null si es propia. */
export const referenciaDe = (nombreCategoria, referencias = PERFIL_ESTANDAR) =>
  referencias[nombreCategoria] ?? null;

/** Fuente de los datos, para poder citarla en la interfaz. */
export const FUENTE_REFERENCIAS = 'INE, Encuesta de Presupuestos Familiares 2024';
