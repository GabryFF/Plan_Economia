import { Router } from 'express';
import { asincrono } from '../utiles/errores.js';
import { esquemaAsistente, validar } from '../validacion/esquemas.js';
import * as servicio from '../servicios/asistente.js';

export const rutasAsistente = Router();

/** Si hay que ofrecer el asistente, y los gastos habituales que propone. */
rutasAsistente.get('/', asincrono((req, res) => {
  res.json(servicio.estado());
}));

/** Crea de una vez la nómina, los gastos fijos y los ajustes declarados. */
rutasAsistente.post('/', asincrono((req, res) => {
  res.status(201).json(servicio.completar(validar(esquemaAsistente, req.body)));
}));

/** "Lo configuro yo": marca el asistente como visto sin crear nada. */
rutasAsistente.post('/omitir', asincrono((req, res) => {
  res.json(servicio.omitir());
}));
