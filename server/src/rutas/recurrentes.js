import { Router } from 'express';
import { asincrono } from '../utiles/errores.js';
import { esquemaRecurrente, esquemaRecurrenteParcial, validar } from '../validacion/esquemas.js';
import * as servicio from '../servicios/recurrentes.js';

export const rutasRecurrentes = Router();

rutasRecurrentes.get('/', asincrono((req, res) => {
  res.json(servicio.listarRecurrentes({ soloActivos: req.query.soloActivos === 'true' }));
}));

rutasRecurrentes.post('/', asincrono((req, res) => {
  const recurrente = servicio.crearRecurrente(validar(esquemaRecurrente, req.body));
  // Al dar de alta un fijo se generan de golpe los movimientos ya vencidos.
  const { creados } = servicio.materializarPendientes();
  res.status(201).json({ ...recurrente, movimientosGenerados: creados });
}));

rutasRecurrentes.put('/:id', asincrono((req, res) => {
  res.json(servicio.actualizarRecurrente(Number(req.params.id), validar(esquemaRecurrenteParcial, req.body)));
}));

rutasRecurrentes.delete('/:id', asincrono((req, res) => {
  res.json(
    servicio.borrarRecurrente(Number(req.params.id), { borrarGenerados: req.query.borrarGenerados === 'true' })
  );
}));

/** Fuerza la generación de los movimientos fijos pendientes hasta hoy. */
rutasRecurrentes.post('/generar', asincrono((req, res) => {
  res.json(servicio.materializarPendientes());
}));
