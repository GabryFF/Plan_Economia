import { Router } from 'express';
import { asincrono } from '../utiles/errores.js';
import { esquemaPeriodo, esquemaPresupuesto, validar } from '../validacion/esquemas.js';
import * as servicio from '../servicios/presupuestos.js';

export const rutasPresupuestos = Router();

rutasPresupuestos.get('/', asincrono((req, res) => {
  res.json(servicio.listarPresupuestos(validar(esquemaPeriodo, req.query)));
}));

rutasPresupuestos.put('/', asincrono((req, res) => {
  res.json(servicio.guardarPresupuesto(validar(esquemaPresupuesto, req.body)));
}));

rutasPresupuestos.post('/copiar-mes-anterior', asincrono((req, res) => {
  res.json(servicio.copiarDelMesAnterior(validar(esquemaPeriodo, req.body)));
}));

rutasPresupuestos.delete('/:id', asincrono((req, res) => {
  res.json(servicio.borrarPresupuesto(Number(req.params.id)));
}));
