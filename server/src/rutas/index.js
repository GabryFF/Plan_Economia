import { Router } from 'express';
import { rutasCategorias } from './categorias.js';
import { rutasMovimientos } from './movimientos.js';
import { rutasRecurrentes } from './recurrentes.js';
import { rutasPresupuestos } from './presupuestos.js';
import { rutasResumen } from './resumen.js';
import { rutasDatos } from './datos.js';
import { rutasAjustes } from './ajustes.js';
import { rutasReglas } from './reglas.js';
import { rutasMetas } from './metas.js';
import { rutasAutonomo } from './autonomo.js';
import { rutasCuentas } from './cuentas.js';
import { rutasAsistente } from './asistente.js';

export const api = Router();

api.get('/salud', (req, res) => res.json({ estado: 'ok', hora: new Date().toISOString() }));

api.use('/categorias', rutasCategorias);
api.use('/movimientos', rutasMovimientos);
api.use('/recurrentes', rutasRecurrentes);
api.use('/presupuestos', rutasPresupuestos);
api.use('/resumen', rutasResumen);
api.use('/datos', rutasDatos);
api.use('/ajustes', rutasAjustes);
api.use('/reglas', rutasReglas);
api.use('/metas', rutasMetas);
api.use('/autonomo', rutasAutonomo);
api.use('/cuentas', rutasCuentas);
api.use('/asistente', rutasAsistente);
