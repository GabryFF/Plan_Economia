/**
 * Referencias fiscales para autónomos en España.
 *
 * Consultado el 30 de agosto de 2026 en la Agencia Tributaria, la Seguridad
 * Social y publicaciones especializadas. CADUCA: los límites y las cuotas se
 * revisan cada año.
 *
 * Nada de esto sustituye a una gestoría. Está aquí para que el usuario sepa qué
 * preguntar y qué guardar, no para que decida solo.
 */

/** Los tres requisitos que la AEAT exige a cualquier gasto para ser deducible. */
export const REQUISITOS_DEDUCIBILIDAD = [
  {
    requisito: 'Vinculado a la actividad',
    detalle: 'Tiene que estar relacionado con lo que facturas. Si no puedes explicar la relación, no lo deduzcas.',
  },
  {
    requisito: 'Justificado con factura completa',
    detalle: 'Factura con tus datos fiscales, no un ticket. Un ticket sin NIF no vale como justificante.',
  },
  {
    requisito: 'Anotado en el libro de registro',
    detalle: 'En el periodo en que se produjo. Los libros de ingresos, gastos e inversiones son obligatorios.',
  },
];

/**
 * Catálogo de gastos deducibles con sus reglas reales.
 *
 * `riesgo` marca los que la AEAT revisa con lupa: según su Plan Anual de Control
 * Tributario, las regularizaciones a autónomos se concentran en vehículo y
 * dietas.
 */
export const GASTOS_DEDUCIBLES = [
  {
    concepto: 'Cuota de autónomos (RETA)',
    deducible: 'Íntegra',
    riesgo: 'bajo',
    nota: 'El gasto más claro que existe: deducible al 100 % en IRPF.',
  },
  {
    concepto: 'Suministros de la vivienda (luz, agua, gas, internet)',
    deducible: '30 % de la parte proporcional afecta',
    riesgo: 'medio',
    nota:
      'NO es el 30 % de la factura. Es el 30 % aplicado sobre el porcentaje de metros cuadrados de la vivienda ' +
      'afectos a la actividad, y ese porcentaje hay que haberlo declarado antes en el modelo 036/037. ' +
      'Ejemplo: 20 % de la casa afecta y 100 € de luz -> 100 x 20 % x 30 % = 6 € deducibles.',
  },
  {
    concepto: 'Alquiler y gastos del local u oficina',
    deducible: 'Íntegro si es exclusivo de la actividad',
    riesgo: 'bajo',
    nota: 'Si el espacio es solo para trabajar, sin uso personal, no hay discusión.',
  },
  {
    concepto: 'Manutención (comidas de trabajo)',
    deducible: '26,67 €/día en España, 48,08 €/día en el extranjero',
    riesgo: 'alto',
    nota:
      'Se duplican si hay pernocta (53,34 y 96,16 €). Dos condiciones que no se pueden saltar: en restaurante u ' +
      'hostelería, y pagado por medio electrónico. Pagar en efectivo lo invalida aunque tengas la factura.',
  },
  {
    concepto: 'Vehículo turismo (compra, combustible, seguro, taller)',
    deducible: 'IRPF: no, salvo afectación exclusiva. IVA: 50 %',
    riesgo: 'alto',
    nota:
      'Es el gasto más regularizado por Hacienda. En IRPF hace falta demostrar uso exclusivamente profesional, ' +
      'algo casi imposible si el coche también te lleva a casa. En IVA la ley presume un 50 % de afectación, ' +
      'así que ese 50 % sí es deducible sin más prueba. Excepción: taxis, transportistas, autoescuelas y ' +
      'comerciales, que sí pueden deducir el 100 %.',
  },
  {
    concepto: 'Teléfono móvil',
    deducible: 'La parte profesional',
    riesgo: 'medio',
    nota: 'Con una sola línea mixta es difícil de sostener. Una línea exclusiva para la actividad lo resuelve.',
  },
  {
    concepto: 'Equipos informáticos y mobiliario',
    deducible: 'Vía amortización',
    riesgo: 'bajo',
    nota:
      'No se deduce entero el año de la compra: se reparte según las tablas de amortización. Por debajo de 300 € ' +
      'por elemento se puede deducir de golpe, con un límite anual.',
  },
  {
    concepto: 'Formación y libros del sector',
    deducible: 'Íntegro',
    riesgo: 'bajo',
    nota: 'Siempre que esté relacionado con tu actividad.',
  },
  {
    concepto: 'Gestoría, abogado, seguros de responsabilidad civil',
    deducible: 'Íntegro',
    riesgo: 'bajo',
    nota: 'Servicios profesionales necesarios para la actividad.',
  },
  {
    concepto: 'Publicidad, dominio, hosting y software',
    deducible: 'Íntegro',
    riesgo: 'bajo',
    nota: 'Incluye las suscripciones de herramientas que uses para trabajar.',
  },
  {
    concepto: 'Seguro médico privado',
    deducible: 'Hasta 500 €/año por persona',
    riesgo: 'bajo',
    nota: 'Del propio autónomo, su cónyuge e hijos menores de 25 años. 1.500 € en caso de discapacidad.',
  },
];

/** Límites cuantitativos, para poder calcular en vez de recordar. */
export const LIMITES = {
  fechaConsulta: '2026-08-30',
  dietaEspana: 26.67,
  dietaEspanaPernocta: 53.34,
  dietaExtranjero: 48.08,
  dietaExtranjeroPernocta: 96.16,
  suministrosPorcentaje: 30,
  seguroMedicoPorPersona: 500,
  seguroMedicoDiscapacidad: 1500,
  // Estimación directa simplificada: 5 % del rendimiento neto con tope anual.
  dificilJustificacionPorcentaje: 5,
  dificilJustificacionTope: 2000,
  ivaVehiculoPresuncion: 50,
  amortizacionDirectaHasta: 300,
};

/**
 * Trabajador autónomo económicamente dependiente (TRADE).
 *
 * Importa por dos razones: da derechos que un autónomo normal no tiene, y su
 * frontera con el «falso autónomo» es donde se concentran las inspecciones.
 */
export const TRADE = {
  umbralIngresos: 75,
  requisitos: [
    'Más del 75 % de tus ingresos vienen de un mismo cliente.',
    'No tienes trabajadores a tu cargo.',
    'No subcontratas ni externalizas tu actividad, ni total ni parcialmente.',
    'Dispones de infraestructura y medios propios, independientes de los del cliente.',
    'Percibes una retribución variable, ligada al resultado de tu actividad.',
    'No eres titular de locales comerciales o industriales abiertos al público.',
    'Cotizas obligatoriamente por contingencias profesionales.',
  ],
  derechos: [
    'Al menos 18 días hábiles de vacaciones al año.',
    'Indemnización si el cliente extingue el contrato sin causa justificada.',
    'Posibilidad de acogerse a acuerdos de interés profesional.',
  ],
  formalizacion:
    'El contrato debe hacerse por escrito, indicando expresamente la condición de TRADE, y registrarse ante el SEPE.',
  avisoFalsoAutonomo:
    'Ojo con la frontera del «falso autónomo»: si además de facturar casi todo a un cliente cumples horario suyo, ' +
    'usas sus medios y recibes órdenes directas, la relación puede considerarse laboral encubierta. Eso no es un ' +
    'matiz fiscal: acarrea sanciones y regularización de cuotas para la empresa.',
};

/** Qué se presenta y cuándo. */
export const OBLIGACIONES = [
  { modelo: '303', que: 'IVA trimestral', cuando: 'Del 1 al 20 de abril, julio, octubre y enero.' },
  {
    modelo: '130',
    que: 'Pago fraccionado del IRPF (20 % del rendimiento neto acumulado)',
    cuando: 'Mismos plazos que el 303.',
    nota: 'No se presenta si más del 70 % de tus ingresos ya llevan retención en factura.',
  },
  { modelo: '390', que: 'Resumen anual de IVA', cuando: 'En enero, con el 303 del cuarto trimestre.' },
  { modelo: '347', que: 'Operaciones con terceros por encima de 3.005,06 €', cuando: 'En febrero.' },
  { modelo: '100', que: 'Declaración de la renta', cuando: 'De abril a junio del año siguiente.' },
];

/** Dónde comprobarlo sin intermediarios. */
export const FUENTES_OFICIALES = [
  {
    organismo: 'Agencia Tributaria — gastos deducibles en estimación directa',
    url: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2024/c07-rendimientos-actividades-economicas-estimacion-directa/fase-1-determinacion-rendimiento-neto/gastos-fiscalmente-deducibles.html',
  },
  {
    organismo: 'Seguridad Social — cotización de autónomos y tramos',
    url: 'https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/CotizacionRecaudacionTrabajadores/10721/10957',
  },
  {
    organismo: 'Agencia Tributaria — sede electrónica, presentación de modelos',
    url: 'https://sede.agenciatributaria.gob.es/',
  },
];

/**
 * Suministros deducibles de la vivienda habitual.
 *
 * La fórmula sorprende a mucha gente: no es el 30 % de la factura, sino el 30 %
 * de la parte proporcional afecta. Con un 20 % de la casa afecta, de 100 € de
 * luz solo se deducen 6.
 */
export function calcularSuministros({ importeMensual, porcentajeSuperficieAfecta }) {
  const proporcion = (porcentajeSuperficieAfecta ?? 0) / 100;
  const deducible = importeMensual * proporcion * (LIMITES.suministrosPorcentaje / 100);

  return {
    importeMensual,
    porcentajeSuperficieAfecta,
    porcentajeAplicado: LIMITES.suministrosPorcentaje,
    deducibleMensual: Math.round(deducible * 100) / 100,
    deducibleAnual: Math.round(deducible * 12 * 100) / 100,
    // El porcentaje efectivo sobre la factura, que es lo que la gente espera ver.
    porcentajeEfectivo: Math.round(proporcion * LIMITES.suministrosPorcentaje * 10) / 10,
  };
}
