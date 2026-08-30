import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { api } from './rutas/index.js';
import { manejadorDeErrores, noEncontradoApi } from './middleware/errores.js';

/**
 * Construye la aplicación Express sin arrancarla. Separado de `index.js` para
 * que las pruebas puedan levantarla en un puerto efímero.
 */
export function crearApp() {
  const app = express();
  app.use(express.json({ limit: '20mb' })); // la importación envía las filas ya parseadas

  app.use('/api', api);
  app.use('/api', noEncontradoApi);

  // Frontend compilado. En desarrollo lo sirve Vite y esta parte no se usa.
  if (fs.existsSync(config.rutaWeb)) {
    app.use(express.static(config.rutaWeb));
    app.get('*', (req, res) => res.sendFile(path.join(config.rutaWeb, 'index.html')));
  } else {
    app.get('*', (req, res) =>
      res
        .status(503)
        .send(
          '<h1>La interfaz no está compilada</h1>' +
            '<p>Ejecuta <code>npm run build</code> (o usa <code>iniciar.bat</code>) y vuelve a intentarlo.</p>'
        )
    );
  }

  app.use(manejadorDeErrores);

  return app;
}
