/** Error de negocio con código HTTP asociado. Lo captura el middleware final. */
export class ErrorHttp extends Error {
  constructor(estado, mensaje, detalles) {
    super(mensaje);
    this.name = 'ErrorHttp';
    this.estado = estado;
    this.detalles = detalles;
  }
}

/**
 * Mensaje de "no existe" con concordancia de género.
 *
 * Decía "Cuenta no encontrado" y "Categoría no encontrado". Es un detalle, pero
 * es texto que lee el usuario y una aplicación que escribe mal da la sensación
 * de estar mal hecha por dentro.
 */
export const noEncontrado = (que) =>
  new ErrorHttp(404, `${que} no ${que.trim().toLowerCase().endsWith('a') ? 'encontrada' : 'encontrado'}`);
export const peticionInvalida = (mensaje, detalles) => new ErrorHttp(400, mensaje, detalles);
export const conflicto = (mensaje) => new ErrorHttp(409, mensaje);

/** Envuelve handlers async para que sus rechazos lleguen al middleware de errores. */
export const asincrono = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
