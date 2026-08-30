import { Router } from 'express';
import { asincrono } from '../utiles/errores.js';
import { esquemaRangoResumen, validar } from '../validacion/esquemas.js';
import * as servicio from '../servicios/resumen.js';
import { saludFinanciera } from '../servicios/salud.js';

export const rutasResumen = Router();

rutasResumen.get('/', asincrono((req, res) => {
  res.json(servicio.resumenGeneral(validar(esquemaRangoResumen, req.query)));
}));

rutasResumen.get('/evolucion', asincrono((req, res) => {
  const meses = Math.min(Math.max(Number(req.query.meses) || 12, 1), 60);
  res.json(servicio.evolucionMensual({ meses }));
}));

rutasResumen.get('/ahorro', asincrono((req, res) => {
  const meses = Math.min(Math.max(Number(req.query.meses) || 6, 1), 24);
  res.json(servicio.panelAhorro({ meses }));
}));

/** Plan de ahorro: objetivos, fondo de emergencia, regla 50/30/20 y consejos. */
rutasResumen.get('/salud', asincrono((req, res) => {
  const meses = Math.min(Math.max(Number(req.query.meses) || 6, 1), 24);
  res.json(saludFinanciera({ meses }));
}));
