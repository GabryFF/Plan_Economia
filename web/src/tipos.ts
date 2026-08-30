export type Tipo = 'ingreso' | 'gasto';
export type Origen = 'manual' | 'recurrente' | 'importacion';

export interface Categoria {
  id: number;
  nombre: string;
  tipo: Tipo;
  color: string;
  archivada: boolean;
  movimientos: number;
}

export interface Movimiento {
  id: number;
  fecha: string;
  importe: number;
  descripcion: string;
  tipo: Tipo;
  categoriaId: number | null;
  categoriaNombre: string | null;
  categoriaColor: string | null;
  cuentaId: number | null;
  cuentaNombre: string | null;
  cuentaColor: string | null;
  recurrenteId: number | null;
  origen: Origen;
}

export interface PaginaMovimientos {
  movimientos: Movimiento[];
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
  totales: { ingresos: number; gastos: number; balance: number };
}

export interface Recurrente {
  id: number;
  nombre: string;
  importe: number;
  tipo: Tipo;
  categoriaId: number | null;
  categoriaNombre: string | null;
  categoriaColor: string | null;
  diaDelMes: number;
  periodicidad: number;
  costeMensual: number;
  fechaInicio: string;
  fechaFin: string | null;
  activo: boolean;
}

export interface DesgloseCategoria {
  categoriaId: number | null;
  nombre: string;
  color: string;
  total: number;
  movimientos: number;
  porcentaje: number;
}

export interface Resumen {
  ingresos: number;
  gastos: number;
  balance: number;
  movimientos: number;
  tasaAhorro: number | null;
  gastosPorCategoria: DesgloseCategoria[];
  ingresosPorCategoria: DesgloseCategoria[];
}

export interface PuntoEvolucion {
  periodo: string;
  anio: number;
  mes: number;
  etiqueta: string;
  ingresos: number;
  gastos: number;
  balance: number;
}

export interface PanelAhorro {
  anio: number;
  mes: number;
  mesActual: {
    ingresos: number;
    gastos: number;
    ahorro: number;
    tasaAhorro: number | null;
    gastoFijo: number;
    gastoVariable: number;
  };
  mediaMensual: {
    meses: number;
    ingresos: number;
    gastos: number;
    ahorro: number;
    tasaAhorro: number | null;
  };
  compromisosFijos: {
    ingresosFijos: number;
    gastosFijos: number;
    margenFijo: number;
    pesoSobreIngresos: number | null;
    mayores: { nombre: string; importe: number; categoria: string | null; color: string; porcentajeIngresosFijos: number | null }[];
  };
  proyeccionAnual: number;
}

export interface RecomendacionPresupuesto {
  minPorcentaje: number;
  maxPorcentaje: number;
  mediaEspana: number | null;
  nota: string;
  min: number | null;
  max: number | null;
  sugerido: number | null;
}

export interface PresupuestoCategoria {
  recomendado: RecomendacionPresupuesto | null;
  categoriaId: number;
  categoriaNombre: string;
  categoriaColor: string;
  archivada: boolean;
  presupuestoId: number | null;
  presupuesto: number | null;
  gastado: number;
  restante: number | null;
  porcentaje: number | null;
  estado: 'sin-presupuesto' | 'ok' | 'riesgo' | 'excedido';
}

export interface Presupuestos {
  anio: number;
  mes: number;
  presupuestos: PresupuestoCategoria[];
  ingresoBase: {
    importe: number;
    origen: 'mediana' | 'fijos' | 'sin-datos';
    meses?: number;
    pagasAlAnio: number;
    anual: number;
    extrasAlAnio: number;
  };
  perfil: { clave: 'estandar' | 'renta-ajustada'; etiqueta: string };
  fuenteReferencias: string;
  totales: { presupuestado: number; gastado: number; restante: number; categoriasExcedidas: number };
}

export interface AnalisisFichero {
  nombreFichero: string;
  hoja: string;
  columnas: string[];
  sugerencia: { fecha: string | null; importe: string | null; descripcion: string | null; categoria: string | null; tipo: string | null };
  totalFilas: number;
  filas: Record<string, string>[];
}

export interface FiltrosMovimientos {
  desde?: string;
  hasta?: string;
  tipo?: Tipo | '';
  categoriaId?: number | '';
  texto?: string;
  pagina?: number;
  porPagina?: number;
}

export interface Ajustes {
  objetivoAhorro: number;
  mesesFondoEmergencia: number;
  colchonActual: number;
  pagasAlAnio: number;
  modoAutonomo: number;
  autonomoCuota: number;
  autonomoTipoIva: number;
  autonomoTipoIrpf: number;
}

export interface TrimestreAutonomo {
  anio: number;
  trimestre: number;
  desde: string;
  hasta: string;
  facturas: number;
  ingresos: { base: number; iva: number; irpfRetenido: number };
  gastos: { base: number; iva: number };
  rendimientoNeto: number;
  iva: { repercutido: number; soportado: number; aIngresar: number; aCompensar: number };
  irpf: { retenidoEnFactura: number; pagoFraccionadoEstimado: number; nota: string };
  cuotaAutonomos: { mensual: number; trimestre: number };
  provision: number;
  disponibleReal: number;
  calendario: { trimestre: number; periodo: string; presentacion: string };
}

export interface GuiaFiscal {
  requisitos: { requisito: string; detalle: string }[];
  gastos: { concepto: string; deducible: string; riesgo: string; nota: string }[];
  limites: Record<string, number | string> & { fechaConsulta: string; suministrosPorcentaje: number };
  obligaciones: { modelo: string; que: string; cuando: string; nota?: string }[];
  trade: {
    umbralIngresos: number;
    requisitos: string[];
    derechos: string[];
    formalizacion: string;
    avisoFalsoAutonomo: string;
  };
  fuentes: { organismo: string; url: string }[];
}

export interface ConcentracionClientes {
  anio: number;
  totalFacturado: number;
  clientes: { cliente: string; facturado: number; porcentaje: number }[];
  principal: { cliente: string; facturado: number; porcentaje: number } | null;
  umbral: number;
  posibleTrade: boolean;
}

export interface ResumenAnual {
  anio: number;
  facturado: number;
  gastos: number;
  rendimientoNeto: number;
  ivaIngresado: number;
  irpfRetenido: number;
  cuotaAnual: number;
  dificilJustificacion: { porcentaje: number; tope: number; importe: number; nota: string };
  rendimientoTrasReduccion: number;
}

export interface Suministros {
  importeMensual: number;
  porcentajeSuperficieAfecta: number;
  porcentajeAplicado: number;
  deducibleMensual: number;
  deducibleAnual: number;
  porcentajeEfectivo: number;
}

export interface PanelAutonomo {
  anual: ResumenAnual;
  clientes: ConcentracionClientes;
  guia: GuiaFiscal;
  configuracion: {
    activo: boolean;
    cuota: number;
    tipoIva: number;
    tipoIrpf: number;
    referencia: {
      fechaConsulta: string;
      tarifaPlana: number;
      tarifaPlanaMeses: number;
      tarifaPlanaNota: string;
      tramos: number;
      tablaReducidaHasta: number;
      cuotaMinimaAproximada: number;
      cuotaMaximaAproximada: number;
      aviso: string;
      deduccionGastosGenericos: number;
    };
    tipos: Record<string, number>;
  };
  actual: TrimestreAutonomo;
  anterior: TrimestreAutonomo;
  modelos: { modelo: string; que: string; quien: string }[];
  calendario: { trimestre: number; periodo: string; presentacion: string }[];
}

export interface Meta {
  id: number;
  nombre: string;
  objetivo: number;
  ahorrado: number;
  restante: number;
  progreso: number;
  fechaObjetivo: string | null;
  prioridad: number;
  clave: string | null;
  notas: string;
  completada: boolean;
  mesesEstimados: number | null;
  aporteMensualNecesario: number | null;
  aporteMensual?: number;
  aporteAnual?: number;
}

export interface Consejo {
  clave: string;
  prioridad: 'alta' | 'media' | 'info';
  titulo: string;
  detalle: string;
}

export interface TramoReparto {
  euros: number;
  porcentaje: number | null;
  referencia: number;
}

export interface SaludFinanciera {
  ajustes: Ajustes;
  medias: {
    meses: number;
    ingresos: number;
    gastos: number;
    gastosFijos: number;
    gastosVariables: number;
  } | null;
  ahorroMensual: number;
  tasaAhorro: number | null;
  objetivo: {
    porcentaje: number;
    euros: number | null;
    cumplido: boolean;
    diferenciaEuros: number | null;
  };
  fondoEmergencia: {
    mesesObjetivo: number;
    gastoMensualReferencia: number;
    objetivo: number;
    actual: number;
    restante: number;
    mesesCubiertos: number | null;
    progreso: number | null;
    mesesParaCompletarlo: number | null;
  };
  metas: Meta[];
  vivienda: Meta | null;
  mesEnCurso: {
    anio: number;
    mes: number;
    diasTranscurridos: number;
    diasDelMes: number;
    ingresos: number;
    gastos: number;
    gastosFijos: number;
    gastosVariables: number;
    movimientosVariables: number;
    proyectable: boolean;
    gastoProyectado: number;
  };
  referenciaGasto: {
    importe: number;
    origen: 'meses-cerrados' | 'mes-en-curso' | 'solo-fijos';
    provisional: boolean;
  };
  reparto: { necesidades: TramoReparto; deseos: TramoReparto; ahorro: TramoReparto } | null;
  extras: {
    pagas: number;
    importeAnual: number;
    mensualRecurrente: number;
    netoAnual: number;
    tasaAnualSiSeAhorran: number;
  } | null;
  referencias: {
    tasaAhorroMediaEspana: number;
    regla: { necesidades: number; deseos: number; ahorro: number };
  };
  consejos: Consejo[];
}

export type Coincidencia = 'contiene' | 'empieza' | 'termina' | 'exacto';

export interface Regla {
  id: number;
  patron: string;
  coincidencia: Coincidencia;
  categoriaId: number;
  categoriaNombre: string;
  categoriaColor: string;
  categoriaTipo: Tipo;
  prioridad: number;
  activa: boolean;
}

export interface CoincidenciaRegla {
  categoriaId: number;
  categoriaNombre: string;
  categoriaColor: string;
  reglaId: number;
  patron: string;
}

export interface ResultadoAplicarReglas {
  revisados: number;
  actualizados: number;
  porCategoria: { nombre: string; total: number }[];
}

export interface ResultadoCatalogo {
  creadas: number;
  yaExistian: number;
  categoriasQueFaltan: string[];
  total: number;
  reglas: Regla[];
}

export interface Cuenta {
  id: number;
  nombre: string;
  tipo: 'corriente' | 'ahorro' | 'efectivo' | 'tarjeta';
  tipoEtiqueta: string;
  saldoInicial: number;
  color: string;
  orden: number;
  activa: boolean;
  movimientos: number;
  saldo: number;
}

export interface ListaCuentas {
  cuentas: Cuenta[];
  total: number;
}

export interface Traspaso {
  id: number;
  fecha: string;
  importe: number;
  descripcion: string;
  origen: { id: number; nombre: string; color: string };
  destino: { id: number; nombre: string; color: string };
}

export interface EstadoAsistente {
  vacia: boolean;
  completado: boolean;
  mostrar: boolean;
  gastosHabituales: { clave: string; nombre: string; categoria: string; dia: number }[];
}
