import { api, parametros } from './cliente';
import type {
  Ajustes, AnalisisFichero, Categoria, CoincidenciaRegla, FiltrosMovimientos, Movimiento,
  PaginaMovimientos, PanelAhorro, Presupuestos, PuntoEvolucion, Recurrente, Regla,
  ResultadoAplicarReglas, ResultadoCatalogo, Resumen, SaludFinanciera, Tipo,
  Meta, PanelAutonomo, TrimestreAutonomo,
  Suministros, Cuenta, ListaCuentas, Traspaso, EstadoAsistente,
} from '../tipos';

/** Un punto por recurso de la API; las pantallas no construyen URLs a mano. */

export const categorias = {
  listar: (incluirArchivadas = false) =>
    api.get<Categoria[]>(`/categorias${parametros({ incluirArchivadas })}`),
  crear: (datos: { nombre: string; tipo: Tipo; color: string }) => api.post<Categoria>('/categorias', datos),
  actualizar: (id: number, datos: Partial<Categoria>) => api.put<Categoria>(`/categorias/${id}`, datos),
  borrar: (id: number, forzar = false) =>
    api.borrar<{ borrada: boolean; movimientosAfectados: number }>(`/categorias/${id}${parametros({ forzar })}`),
};

export const movimientos = {
  listar: (filtros: FiltrosMovimientos) => api.get<PaginaMovimientos>(`/movimientos${parametros(filtros)}`),
  crear: (datos: Partial<Movimiento> & { importe: number }) => api.post<Movimiento>('/movimientos', datos),
  actualizar: (id: number, datos: Partial<Movimiento>) => api.put<Movimiento>(`/movimientos/${id}`, datos),
  borrar: (id: number) => api.borrar<{ borrado: boolean }>(`/movimientos/${id}`),
  /** Deshacer un borrado: lo recrea conservando su origen. */
  restaurar: (m: Movimiento) =>
    api.post<Movimiento>('/movimientos/restaurar', {
      fecha: m.fecha,
      importe: m.importe,
      descripcion: m.descripcion,
      tipo: m.tipo,
      categoriaId: m.categoriaId,
      cuentaId: m.cuentaId,
      origen: m.origen,
      recurrenteId: m.recurrenteId,
    }),
};

export const recurrentes = {
  listar: () => api.get<Recurrente[]>('/recurrentes'),
  crear: (datos: Record<string, unknown>) => api.post<Recurrente>('/recurrentes', datos),
  actualizar: (id: number, datos: Record<string, unknown>) => api.put<Recurrente>(`/recurrentes/${id}`, datos),
  borrar: (id: number, borrarGenerados = false) =>
    api.borrar<{ borrado: boolean; generadosBorrados: number }>(`/recurrentes/${id}${parametros({ borrarGenerados })}`),
  generar: () => api.post<{ creados: number }>('/recurrentes/generar'),
};

export const presupuestos = {
  listar: (anio: number, mes: number) => api.get<Presupuestos>(`/presupuestos${parametros({ anio, mes })}`),
  guardar: (datos: { categoriaId: number; anio: number; mes: number; importe: number }) =>
    api.put<Presupuestos>('/presupuestos', datos),
  copiarMesAnterior: (anio: number, mes: number) =>
    api.post<Presupuestos & { copiados: number }>('/presupuestos/copiar-mes-anterior', { anio, mes }),
};

export const resumen = {
  general: (rango: { desde?: string; hasta?: string }) => api.get<Resumen>(`/resumen${parametros(rango)}`),
  evolucion: (meses = 12) => api.get<PuntoEvolucion[]>(`/resumen/evolucion${parametros({ meses })}`),
  ahorro: (meses = 6) => api.get<PanelAhorro>(`/resumen/ahorro${parametros({ meses })}`),
  salud: (meses = 6) => api.get<SaludFinanciera>(`/resumen/salud${parametros({ meses })}`),
};

export const reglas = {
  listar: () => api.get<Regla[]>('/reglas'),
  crear: (datos: Partial<Regla>) => api.post<Regla>('/reglas', datos),
  actualizar: (id: number, datos: Partial<Regla>) => api.put<Regla>(`/reglas/${id}`, datos),
  borrar: (id: number) => api.borrar<{ borrada: boolean }>(`/reglas/${id}`),
  mover: (id: number, direccion: 'subir' | 'bajar') => api.post<Regla[]>(`/reglas/${id}/mover`, { direccion }),
  probar: (texto: string, tipo: Tipo) =>
    api.post<{ coincidencia: CoincidenciaRegla | null }>('/reglas/probar', { texto, tipo }),
  sugerir: (filas: { descripcion: string; tipo: Tipo }[]) =>
    api.post<{ sugerencias: (CoincidenciaRegla | null)[] }>('/reglas/sugerir', { filas }),
  aplicar: () => api.post<ResultadoAplicarReglas>('/reglas/aplicar'),
  cargarCatalogo: () => api.post<ResultadoCatalogo>('/reglas/catalogo'),
};

export const metas = {
  listar: () => api.get<Meta[]>('/metas'),
  crear: (datos: Record<string, unknown>) => api.post<Meta>('/metas', datos),
  actualizar: (id: number, datos: Record<string, unknown>) => api.put<Meta>(`/metas/${id}`, datos),
  aportar: (id: number, importe: number) => api.post<Meta>(`/metas/${id}/aportar`, { importe }),
  mover: (id: number, direccion: 'subir' | 'bajar') => api.post<Meta[]>(`/metas/${id}/mover`, { direccion }),
  borrar: (id: number) => api.borrar<{ borrado: boolean }>(`/metas/${id}`),
};

export const autonomo = {
  panel: () => api.get<PanelAutonomo>('/autonomo'),
  trimestre: (anio: number, trimestre: number) =>
    api.get<TrimestreAutonomo>(`/autonomo/trimestre${parametros({ anio, trimestre })}`),
  registrarFactura: (datos: Record<string, unknown>) =>
    api.post<{ id: number; base: number; iva: number; irpf: number; importe: number }>('/autonomo/facturas', datos),
  suministros: (importeMensual: number, porcentajeSuperficieAfecta: number) =>
    api.get<Suministros>(`/autonomo/suministros${parametros({ importeMensual, porcentajeSuperficieAfecta })}`),
};

export const cuentas = {
  listar: () => api.get<ListaCuentas>('/cuentas'),
  crear: (datos: Record<string, unknown>) => api.post<Cuenta>('/cuentas', datos),
  actualizar: (id: number, datos: Record<string, unknown>) => api.put<Cuenta>(`/cuentas/${id}`, datos),
  borrar: (id: number, forzar = false) =>
    api.borrar<{ borrada: boolean; movimientosAfectados: number }>(`/cuentas/${id}${parametros({ forzar })}`),
  traspasos: () => api.get<Traspaso[]>('/cuentas/traspasos'),
  crearTraspaso: (datos: Record<string, unknown>) => api.post<Traspaso>('/cuentas/traspasos', datos),
  borrarTraspaso: (id: number) => api.borrar<{ borrado: boolean }>(`/cuentas/traspasos/${id}`),
};

export const asistente = {
  estado: () => api.get<EstadoAsistente>('/asistente'),
  completar: (datos: Record<string, unknown>) =>
    api.post<{
      ingreso: { nombre: string } | null;
      gastosFijos: unknown[];
      reglas: number;
      movimientosGenerados: number;
    }>('/asistente', datos),
  omitir: () => api.post<EstadoAsistente>('/asistente/omitir'),
};

export const ajustes = {
  obtener: () => api.get<Ajustes>('/ajustes'),
  guardar: (cambios: Partial<Ajustes>) => api.put<Ajustes>('/ajustes', cambios),
};

export const datos = {
  exportar: (filtros: FiltrosMovimientos, formato: 'csv' | 'xlsx') =>
    api.descargar(`/datos/exportar${parametros({ ...filtros, formato })}`),
  plantilla: () => api.descargar('/datos/plantilla'),
  copiaSeguridad: () => api.descargar('/datos/copia-seguridad'),
  analizar: (fichero: File) => api.subir<AnalisisFichero>('/datos/importar/analizar', fichero),
  confirmar: (cuerpo: { movimientos: unknown[]; crearCategorias: boolean; aplicarReglas: boolean }) =>
    api.post<{
      importados: number;
      categorizadosPorRegla: number;
      categoriasCreadas: string[];
      sinCategoria: { fila: number; categoria: string }[];
    }>(
      '/datos/importar/confirmar',
      cuerpo
    ),
};
