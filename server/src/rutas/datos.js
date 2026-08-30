import { Router } from 'express';
import multer from 'multer';
import { asincrono, peticionInvalida } from '../utiles/errores.js';
import { esquemaFiltrosMovimientos, esquemaImportacion, validar } from '../validacion/esquemas.js';
import * as servicio from '../servicios/datos.js';

export const rutasDatos = Router();

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const extensionValida = /\.(csv|xlsx|xls)$/i.test(file.originalname);
    cb(extensionValida ? null : peticionInvalida('Solo se admiten ficheros .csv, .xlsx o .xls'), extensionValida);
  },
});

const nombreDescarga = (extension) =>
  `movimientos-${new Date().toISOString().slice(0, 10)}.${extension}`;

rutasDatos.get('/exportar', asincrono((req, res) => {
  const formato = req.query.formato === 'csv' ? 'csv' : 'xlsx';
  const filtros = validar(esquemaFiltrosMovimientos, req.query);
  const { contenido, tipoMime, extension } = servicio.exportar(filtros, formato);

  res.setHeader('Content-Type', tipoMime);
  res.setHeader('Content-Disposition', `attachment; filename="${nombreDescarga(extension)}"`);
  res.send(contenido);
}));

/** Descarga una copia de seguridad completa de la base de datos. */
rutasDatos.get('/copia-seguridad', asincrono((req, res) => {
  const { contenido, tipoMime, nombre } = servicio.copiaSeguridad();

  res.setHeader('Content-Type', tipoMime);
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
  res.send(contenido);
}));

rutasDatos.get('/plantilla', asincrono((req, res) => {
  const { contenido, tipoMime } = servicio.plantillaImportacion();
  res.setHeader('Content-Type', tipoMime);
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla-movimientos.xlsx"');
  res.send(contenido);
}));

/** Paso 1: leer el fichero y devolver columnas + filas para la vista previa. */
rutasDatos.post('/importar/analizar', subida.single('fichero'), asincrono((req, res) => {
  if (!req.file) throw peticionInvalida('No se ha recibido ningún fichero');
  res.json(servicio.analizarFichero(req.file.buffer, req.file.originalname));
}));

/** Paso 2: confirmar la importación de las filas ya mapeadas. */
rutasDatos.post('/importar/confirmar', asincrono((req, res) => {
  res.json(servicio.importarMovimientos(validar(esquemaImportacion, req.body)));
}));
