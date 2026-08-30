import { Router } from 'express';
import { asincrono, peticionInvalida } from '../utiles/errores.js';
import { esquemaAportacion, esquemaMeta, esquemaMetaParcial, validar } from '../validacion/esquemas.js';
import * as servicio from '../servicios/metas.js';

export const rutasMetas = Router();

rutasMetas.get('/', asincrono((req, res) => {
  res.json(servicio.listarMetas());
}));

rutasMetas.post('/', asincrono((req, res) => {
  res.status(201).json(servicio.crearMeta(validar(esquemaMeta, req.body)));
}));

rutasMetas.put('/:id', asincrono((req, res) => {
  res.json(servicio.actualizarMeta(Number(req.params.id), validar(esquemaMetaParcial, req.body)));
}));

/** Suma una aportación a lo ya ahorrado (o la resta, con importe negativo). */
rutasMetas.post('/:id/aportar', asincrono((req, res) => {
  const { importe } = validar(esquemaAportacion, req.body);
  res.json(servicio.aportar(Number(req.params.id), importe));
}));

rutasMetas.post('/:id/mover', asincrono((req, res) => {
  const { direccion } = req.body ?? {};
  if (direccion !== 'subir' && direccion !== 'bajar') {
    throw peticionInvalida("La dirección debe ser 'subir' o 'bajar'");
  }
  res.json(servicio.moverMeta(Number(req.params.id), direccion));
}));

rutasMetas.delete('/:id', asincrono((req, res) => {
  res.json(servicio.borrarMeta(Number(req.params.id)));
}));
