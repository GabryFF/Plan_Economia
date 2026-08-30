/**
 * Cliente HTTP de la API. Centraliza el manejo de errores para que las
 * pantallas reciban siempre un `ErrorApi` con mensaje legible en español.
 */

export class ErrorApi extends Error {
  detalles?: { campo: string; mensaje: string }[];
  estado: number;

  constructor(mensaje: string, estado: number, detalles?: { campo: string; mensaje: string }[]) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.detalles = detalles;
  }

  /** Mensaje completo, incluyendo el detalle campo a campo si lo hay. */
  get textoCompleto() {
    if (!this.detalles?.length) return this.message;
    return `${this.message}: ${this.detalles.map((d) => d.mensaje).join('. ')}`;
  }
}

async function peticion<T>(url: string, opciones: RequestInit = {}): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(url, opciones);
  } catch {
    throw new ErrorApi('No se ha podido conectar con la aplicación. ¿Sigue abierta la ventana del servidor?', 0);
  }

  if (!respuesta.ok) {
    let mensaje = `Error ${respuesta.status}`;
    let detalles;
    try {
      const cuerpo = await respuesta.json();
      mensaje = cuerpo.error ?? mensaje;
      detalles = cuerpo.detalles;
    } catch {
      /* respuesta sin JSON */
    }
    throw new ErrorApi(mensaje, respuesta.status, detalles);
  }

  if (respuesta.status === 204) return undefined as T;
  return respuesta.json() as Promise<T>;
}

const conJson = (metodo: string, cuerpo: unknown): RequestInit => ({
  method: metodo,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cuerpo),
});

export const parametros = (filtros: Record<string, unknown> | object) => {
  const query = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') query.set(clave, String(valor));
  }
  const texto = query.toString();
  return texto ? `?${texto}` : '';
};

export const api = {
  get: <T,>(url: string) => peticion<T>(`/api${url}`),
  post: <T,>(url: string, cuerpo?: unknown) => peticion<T>(`/api${url}`, conJson('POST', cuerpo ?? {})),
  put: <T,>(url: string, cuerpo: unknown) => peticion<T>(`/api${url}`, conJson('PUT', cuerpo)),
  borrar: <T,>(url: string) => peticion<T>(`/api${url}`, { method: 'DELETE' }),
  subir: <T,>(url: string, fichero: File) => {
    const datos = new FormData();
    datos.append('fichero', fichero);
    return peticion<T>(`/api${url}`, { method: 'POST', body: datos });
  },
  /** Descarga directa (exportaciones y plantilla). */
  descargar: (url: string) => {
    window.location.href = `/api${url}`;
  },
};
