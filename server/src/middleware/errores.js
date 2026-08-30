/** Middleware final: traduce cualquier excepción a una respuesta JSON uniforme. */
export function manejadorDeErrores(error, req, res, next) {
  if (res.headersSent) return next(error);

  const estado = error.estado ?? error.status ?? 500;

  if (estado >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  }

  res.status(estado).json({
    error: estado >= 500 ? 'Se ha producido un error interno' : error.message,
    detalles: error.detalles,
  });
}

export function noEncontradoApi(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}
