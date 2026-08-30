import { Router } from 'express';
import { asincrono } from '../utiles/errores.js';
import { esquemaCuenta, esquemaCuentaParcial, esquemaTraspaso, validar } from '../validacion/esquemas.js';
import * as servicio from '../servicios/cuentas.js';

export const rutasCuentas = Router();

rutasCuentas.get('/', asincrono((req, res) => {
  res.json(servicio.listarCuentas({ incluirInactivas: req.query.incluirInactivas === 'true' }));
}));

rutasCuentas.post('/', asincrono((req, res) => {
  res.status(201).json(servicio.crearCuenta(validar(esquemaCuenta, req.body)));
}));

// Los traspasos van declarados ANTES que /:id, o esa ruta los capturaría.

rutasCuentas.get('/traspasos', asincrono((req, res) => {
  res.json(servicio.listarTraspasos({ limite: Math.min(Number(req.query.limite) || 50, 500) }));
}));

rutasCuentas.post('/traspasos', asincrono((req, res) => {
  res.status(201).json(servicio.crearTraspaso(validar(esquemaTraspaso, req.body)));
}));

rutasCuentas.delete('/traspasos/:id', asincrono((req, res) => {
  res.json(servicio.borrarTraspaso(Number(req.params.id)));
}));

rutasCuentas.put('/:id', asincrono((req, res) => {
  res.json(servicio.actualizarCuenta(Number(req.params.id), validar(esquemaCuentaParcial, req.body)));
}));

rutasCuentas.delete('/:id', asincrono((req, res) => {
  res.json(servicio.borrarCuenta(Number(req.params.id), { forzar: req.query.forzar === 'true' }));
}));
