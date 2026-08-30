import { Router } from 'express';
import { asincrono } from '../utiles/errores.js';
import {
  esquemaFiltrosMovimientos,
  esquemaMovimiento,
  esquemaMovimientoParcial,
  esquemaRestaurarMovimiento,
  validar,
} from '../validacion/esquemas.js';
import * as servicio from '../servicios/movimientos.js';

export const rutasMovimientos = Router();

rutasMovimientos.get('/', asincrono((req, res) => {
  res.json(servicio.listarMovimientos(validar(esquemaFiltrosMovimientos, req.query)));
}));

rutasMovimientos.get('/:id', asincrono((req, res) => {
  res.json(servicio.obtenerMovimiento(Number(req.params.id)));
}));

rutasMovimientos.post('/', asincrono((req, res) => {
  res.status(201).json(servicio.crearMovimiento(validar(esquemaMovimiento, req.body)));
}));

/** Deshacer un borrado: recrea el movimiento con su origen intacto. */
rutasMovimientos.post('/restaurar', asincrono((req, res) => {
  res.status(201).json(servicio.restaurarMovimiento(validar(esquemaRestaurarMovimiento, req.body)));
}));

rutasMovimientos.put('/:id', asincrono((req, res) => {
  res.json(servicio.actualizarMovimiento(Number(req.params.id), validar(esquemaMovimientoParcial, req.body)));
}));

rutasMovimientos.delete('/:id', asincrono((req, res) => {
  res.json(servicio.borrarMovimiento(Number(req.params.id)));
}));
