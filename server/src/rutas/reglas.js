import { Router } from 'express';
import { asincrono, peticionInvalida } from '../utiles/errores.js';
import {
  esquemaPruebaRegla, esquemaRegla, esquemaReglaParcial, esquemaSugerencias, validar,
} from '../validacion/esquemas.js';
import * as servicio from '../servicios/reglas.js';

export const rutasReglas = Router();

rutasReglas.get('/', asincrono((req, res) => {
  res.json(servicio.listarReglas());
}));

rutasReglas.post('/', asincrono((req, res) => {
  res.status(201).json(servicio.crearRegla(validar(esquemaRegla, req.body)));
}));

/** Probador: qué regla casaría con un concepto concreto. Antes de /:id. */
rutasReglas.post('/probar', asincrono((req, res) => {
  const { texto, tipo } = validar(esquemaPruebaRegla, req.body);
  res.json({ coincidencia: servicio.probar(texto, tipo) });
}));

/** Sugerencias para la vista previa de la importación, en un solo viaje. */
rutasReglas.post('/sugerir', asincrono((req, res) => {
  const { filas } = validar(esquemaSugerencias, req.body);
  res.json({ sugerencias: servicio.sugerirParaFilas(filas) });
}));

/** Carga el catálogo de reglas típicas de España. Idempotente. */
rutasReglas.post('/catalogo', asincrono((req, res) => {
  res.json(servicio.cargarCatalogoTipico());
}));

/** Reaplica las reglas a los movimientos ya guardados que no tienen categoría. */
rutasReglas.post('/aplicar', asincrono((req, res) => {
  res.json(servicio.aplicarAExistentes());
}));

rutasReglas.put('/:id', asincrono((req, res) => {
  res.json(servicio.actualizarRegla(Number(req.params.id), validar(esquemaReglaParcial, req.body)));
}));

rutasReglas.delete('/:id', asincrono((req, res) => {
  res.json(servicio.borrarRegla(Number(req.params.id)));
}));

/** Cambia el orden de evaluación: gana la primera regla que casa. */
rutasReglas.post('/:id/mover', asincrono((req, res) => {
  const { direccion } = req.body ?? {};
  if (direccion !== 'subir' && direccion !== 'bajar') {
    throw peticionInvalida("La dirección debe ser 'subir' o 'bajar'");
  }
  res.json(servicio.moverRegla(Number(req.params.id), direccion));
}));
