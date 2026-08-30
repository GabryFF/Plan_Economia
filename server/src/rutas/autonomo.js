import { Router } from 'express';
import { asincrono } from '../utiles/errores.js';
import { esquemaAnio, esquemaFactura, esquemaSuministros, esquemaTrimestre, validar } from '../validacion/esquemas.js';
import * as servicio from '../servicios/autonomo.js';

export const rutasAutonomo = Router();

/** Panel: trimestre en curso, anterior, modelos y calendario. */
rutasAutonomo.get('/', asincrono((req, res) => {
  res.json(servicio.panel());
}));

rutasAutonomo.get('/trimestre', asincrono((req, res) => {
  res.json(servicio.resumenTrimestre(validar(esquemaTrimestre, req.query)));
}));

/** Registra una factura con su desglose de IVA e IRPF. */
rutasAutonomo.post('/facturas', asincrono((req, res) => {
  res.status(201).json(servicio.registrarFactura(validar(esquemaFactura, req.body)));
}));

rutasAutonomo.get('/anual', asincrono((req, res) => {
  res.json(servicio.resumenAnual(validar(esquemaAnio, req.query)));
}));

/** Concentración de clientes y si eso encaja con la figura del TRADE. */
rutasAutonomo.get('/clientes', asincrono((req, res) => {
  res.json(servicio.concentracionClientes(validar(esquemaAnio, req.query)));
}));

/** Guía de gastos deducibles, límites y obligaciones. */
rutasAutonomo.get('/guia', asincrono((req, res) => {
  res.json(servicio.guiaFiscal());
}));

/** Calculadora de suministros de la vivienda afecta. */
rutasAutonomo.get('/suministros', asincrono((req, res) => {
  res.json(servicio.suministrosDeducibles(validar(esquemaSuministros, req.query)));
}));
