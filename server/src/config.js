import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));

/** Raíz del repositorio (server/src -> server -> raíz). */
export const RAIZ = path.resolve(aqui, '..', '..');

export const config = {
  puerto: Number(process.env.PUERTO ?? process.env.PORT ?? 3001),
  entorno: process.env.NODE_ENV ?? 'development',
  rutaBaseDatos: process.env.RUTA_BD ?? path.join(RAIZ, 'data', 'gastos.db'),
  rutaWeb: path.join(RAIZ, 'web', 'dist'),
  // Se abre el navegador al arrancar salvo en desarrollo (--no-abrir) o si se desactiva.
  abrirNavegador: process.env.ABRIR_NAVEGADOR !== '0' && !process.argv.includes('--no-abrir'),
};
