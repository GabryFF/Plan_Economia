import { Router } from 'express';
import { asincrono } from '../utiles/errores.js';
import { esquemaCategoria, esquemaCategoriaParcial, validar } from '../validacion/esquemas.js';
import * as servicio from '../servicios/categorias.js';

export const rutasCategorias = Router();

rutasCategorias.get('/', asincrono((req, res) => {
  res.json(servicio.listarCategorias({ incluirArchivadas: req.query.incluirArchivadas === 'true' }));
}));

rutasCategorias.post('/', asincrono((req, res) => {
  res.status(201).json(servicio.crearCategoria(validar(esquemaCategoria, req.body)));
}));

rutasCategorias.put('/:id', asincrono((req, res) => {
  res.json(servicio.actualizarCategoria(Number(req.params.id), validar(esquemaCategoriaParcial, req.body)));
}));

rutasCategorias.delete('/:id', asincrono((req, res) => {
  res.json(servicio.borrarCategoria(Number(req.params.id), { forzar: req.query.forzar === 'true' }));
}));
