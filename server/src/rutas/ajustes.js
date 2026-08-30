import { Router } from 'express';
import { asincrono } from '../utiles/errores.js';
import { esquemaAjustes, validar } from '../validacion/esquemas.js';
import * as servicio from '../servicios/ajustes.js';

export const rutasAjustes = Router();

rutasAjustes.get('/', asincrono((req, res) => {
  res.json(servicio.obtenerAjustes());
}));

rutasAjustes.put('/', asincrono((req, res) => {
  res.json(servicio.guardarAjustes(validar(esquemaAjustes, req.body)));
}));
