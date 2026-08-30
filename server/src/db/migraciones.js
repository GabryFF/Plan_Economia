/**
 * Migraciones incrementales e idempotentes.
 *
 * El esquema se versiona con `PRAGMA user_version`. Cada entrada del array es
 * un escalón: para añadir cambios, se añade una función nueva al final y NUNCA
 * se modifica una existente (los ficheros .db ya creados no volverían a pasar).
 *
 * Convención de importes: SIEMPRE enteros en céntimos. Nada de coma flotante
 * para dinero.
 */
const migraciones = [
  function inicial(bd) {
    bd.exec(`
      CREATE TABLE categorias (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre    TEXT    NOT NULL,
        tipo      TEXT    NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
        color     TEXT    NOT NULL DEFAULT '#64748b',
        archivada INTEGER NOT NULL DEFAULT 0 CHECK (archivada IN (0, 1)),
        creada_en TEXT    NOT NULL DEFAULT (datetime('now')),
        UNIQUE (nombre, tipo)
      );

      CREATE TABLE recurrentes (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre           TEXT    NOT NULL,
        importe_centimos INTEGER NOT NULL CHECK (importe_centimos > 0),
        tipo             TEXT    NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
        categoria_id     INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
        dia_del_mes      INTEGER NOT NULL CHECK (dia_del_mes BETWEEN 1 AND 31),
        fecha_inicio     TEXT    NOT NULL,
        fecha_fin        TEXT,
        activo           INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
        creado_en        TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE movimientos (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha            TEXT    NOT NULL,
        importe_centimos INTEGER NOT NULL CHECK (importe_centimos > 0),
        descripcion      TEXT    NOT NULL DEFAULT '',
        tipo             TEXT    NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
        categoria_id     INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
        recurrente_id    INTEGER REFERENCES recurrentes(id) ON DELETE SET NULL,
        origen           TEXT    NOT NULL DEFAULT 'manual'
                                 CHECK (origen IN ('manual', 'recurrente', 'importacion')),
        creado_en        TEXT    NOT NULL DEFAULT (datetime('now')),
        actualizado_en   TEXT
      );

      CREATE INDEX idx_movimientos_fecha     ON movimientos (fecha);
      CREATE INDEX idx_movimientos_categoria ON movimientos (categoria_id);
      CREATE INDEX idx_movimientos_tipo      ON movimientos (tipo);

      -- Evita duplicar la materialización de un recurrente en el mismo día.
      CREATE UNIQUE INDEX idx_movimientos_recurrente_fecha
        ON movimientos (recurrente_id, fecha) WHERE recurrente_id IS NOT NULL;

      CREATE TABLE presupuestos (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        categoria_id     INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
        anio             INTEGER NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
        mes              INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
        importe_centimos INTEGER NOT NULL CHECK (importe_centimos >= 0),
        UNIQUE (categoria_id, anio, mes)
      );

      CREATE INDEX idx_presupuestos_periodo ON presupuestos (anio, mes);
    `);
  },

  function ajustes(bd) {
    bd.exec(`
      CREATE TABLE ajustes (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
      );
    `);
  },

  function reglasAutocategorizacion(bd) {
    bd.exec(`
      CREATE TABLE reglas (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        patron       TEXT    NOT NULL,
        coincidencia TEXT    NOT NULL DEFAULT 'contiene'
                             CHECK (coincidencia IN ('contiene', 'empieza', 'termina', 'exacto')),
        categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
        prioridad    INTEGER NOT NULL DEFAULT 0,
        activa       INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
        creada_en    TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- El orden de evaluación es parte del comportamiento: gana la primera que casa.
      CREATE INDEX idx_reglas_orden ON reglas (prioridad, id);
    `);
  },

  function candidatosVivienda(bd) {
    bd.exec(`
      CREATE TABLE candidatos (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        municipio     TEXT    NOT NULL,
        provincia     TEXT    NOT NULL DEFAULT '',
        comunidad     TEXT    NOT NULL DEFAULT '',
        precio_m2     INTEGER,
        metros        INTEGER NOT NULL DEFAULT 90,
        -- Servicios verificados por el usuario: 0 = no, 1 = sí, NULL = sin comprobar.
        fibra         INTEGER CHECK (fibra IN (0, 1)),
        supermercado  INTEGER CHECK (supermercado IN (0, 1)),
        centro_salud  INTEGER CHECK (centro_salud IN (0, 1)),
        farmacia      INTEGER CHECK (farmacia IN (0, 1)),
        transporte    INTEGER CHECK (transporte IN (0, 1)),
        poblacion     INTEGER,
        notas         TEXT    NOT NULL DEFAULT '',
        creado_en     TEXT    NOT NULL DEFAULT (datetime('now')),
        UNIQUE (municipio, provincia)
      );
    `);
  },

  function periodicidadRecurrentes(bd) {
    // Meses entre repeticiones: 1 mensual, 3 trimestral, 6 semestral, 12 anual.
    // Cubre el seguro del coche, la ITV o el IBI, que no son mensuales pero sí
    // predecibles, y que hasta ahora no se podían representar.
    bd.exec(`
      ALTER TABLE recurrentes ADD COLUMN periodicidad INTEGER NOT NULL DEFAULT 1;
    `);
  },

  function objetivosDeAhorro(bd) {
    // Generaliza el objetivo de vivienda: apartar para un viaje, un coche o la
    // entrada de un piso son el mismo mecanismo. El fondo de emergencia se queda
    // aparte porque no es un importe fijo: se dimensiona sobre el gasto.
    bd.exec(`
      CREATE TABLE metas (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre            TEXT    NOT NULL,
        objetivo_centimos INTEGER NOT NULL CHECK (objetivo_centimos > 0),
        ahorrado_centimos INTEGER NOT NULL DEFAULT 0 CHECK (ahorrado_centimos >= 0),
        fecha_objetivo    TEXT,
        prioridad         INTEGER NOT NULL DEFAULT 0,
        clave             TEXT UNIQUE,
        notas             TEXT    NOT NULL DEFAULT '',
        creada_en         TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_metas_prioridad ON metas (prioridad, id);
    `);

    // El objetivo de vivienda que vivía en ajustes pasa a ser una meta más.
    const ajustes = Object.fromEntries(
      bd.prepare('SELECT clave, valor FROM ajustes').all().map((f) => [f.clave, f.valor])
    );
    const objetivo = Math.round(Number(ajustes.metaVivienda ?? 0) * 100);

    if (objetivo > 0) {
      bd.prepare(
        `INSERT INTO metas (nombre, objetivo_centimos, ahorrado_centimos, prioridad, clave, notas)
         VALUES (?, ?, ?, 0, 'vivienda', ?)`
      ).run(
        'Entrada de la vivienda',
        objetivo,
        Math.round(Number(ajustes.ahorradoVivienda ?? 0) * 100),
        'Entrada, gastos de compraventa y reforma.'
      );
    }

    bd.prepare("DELETE FROM ajustes WHERE clave IN ('metaVivienda', 'ahorradoVivienda')").run();
  },

  function desgloseFiscal(bd) {
    // Para el modo autónomo: una factura no es solo un importe. El IVA que
    // cobras NO es tuyo (lo tienes en depósito para Hacienda) y el IRPF que te
    // retienen ya es un adelanto del impuesto. `importe_centimos` sigue siendo
    // lo que entra o sale del banco; esto es el desglose.
    bd.exec(`
      ALTER TABLE movimientos ADD COLUMN base_centimos INTEGER;
      ALTER TABLE movimientos ADD COLUMN iva_centimos INTEGER;
      ALTER TABLE movimientos ADD COLUMN irpf_centimos INTEGER;
    `);

    bd.exec("CREATE INDEX idx_movimientos_fiscal ON movimientos (fecha) WHERE base_centimos IS NOT NULL");
  },

  function clienteEnFacturas(bd) {
    // Saber a quién facturas no es un adorno: si más del 75 % viene de un solo
    // cliente puedes ser TRADE (con derechos que no tendrías de otro modo), y
    // esa concentración es además el mayor riesgo de tu negocio.
    bd.exec('ALTER TABLE movimientos ADD COLUMN cliente TEXT');
  },

  function cuentasYTraspasos(bd) {
    bd.exec(`
      CREATE TABLE cuentas (
        id                     INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre                 TEXT    NOT NULL,
        tipo                   TEXT    NOT NULL DEFAULT 'corriente'
                                       CHECK (tipo IN ('corriente', 'ahorro', 'efectivo', 'tarjeta')),
        saldo_inicial_centimos INTEGER NOT NULL DEFAULT 0,
        color                  TEXT    NOT NULL DEFAULT '#2563eb',
        orden                  INTEGER NOT NULL DEFAULT 0,
        activa                 INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
        creada_en              TEXT    NOT NULL DEFAULT (datetime('now')),
        UNIQUE (nombre)
      );

      -- Un traspaso NO es un ingreso ni un gasto: mover dinero de una cuenta a
      -- otra no cambia tu patrimonio. Por eso vive en su propia tabla y no en
      -- movimientos: así no contamina balances, tasas de ahorro ni presupuestos.
      CREATE TABLE traspasos (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha            TEXT    NOT NULL,
        importe_centimos INTEGER NOT NULL CHECK (importe_centimos > 0),
        origen_id        INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
        destino_id       INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
        descripcion      TEXT    NOT NULL DEFAULT '',
        creado_en        TEXT    NOT NULL DEFAULT (datetime('now')),
        CHECK (origen_id <> destino_id)
      );

      CREATE INDEX idx_traspasos_fecha ON traspasos (fecha);

      ALTER TABLE movimientos ADD COLUMN cuenta_id INTEGER REFERENCES cuentas(id) ON DELETE SET NULL;
    `);

    // Quien ya venía usando la aplicación tenía una sola cuenta implícita: se
    // materializa para que nada quede huérfano.
    const { total } = bd.prepare('SELECT COUNT(*) AS total FROM movimientos').get();

    if (total > 0) {
      const { lastInsertRowid } = bd
        .prepare("INSERT INTO cuentas (nombre, tipo, color, orden) VALUES ('Cuenta principal', 'corriente', '#2563eb', 0)")
        .run();
      bd.prepare('UPDATE movimientos SET cuenta_id = ?').run(Number(lastInsertRowid));
    }
  },

  /**
   * Recibos de gastos fijos sin cuenta.
   *
   * `materializarPendientes` insertaba sin `cuenta_id`, así que todo lo que
   * generaba la aplicación sola —la nómina y los fijos, la mayor parte del
   * dinero— quedaba fuera del saldo de la cuenta. La pantalla de Cuentas
   * enseñaba un saldo que no se parecía a la realidad.
   *
   * Se adoptan esos huérfanos en la primera cuenta activa, que es la misma a la
   * que van los movimientos manuales.
   */
  function recibosSinCuenta(bd) {
    const cuenta = bd.prepare('SELECT id FROM cuentas WHERE activa = 1 ORDER BY orden, id LIMIT 1').get();
    if (!cuenta) return;

    bd.prepare('UPDATE movimientos SET cuenta_id = ? WHERE cuenta_id IS NULL').run(cuenta.id);
  },
];

export function aplicarMigraciones(bd) {
  const { user_version: versionActual } = bd.prepare('PRAGMA user_version').get();

  for (let i = versionActual; i < migraciones.length; i += 1) {
    bd.exec('BEGIN');
    try {
      migraciones[i](bd);
      bd.exec(`PRAGMA user_version = ${i + 1}`);
      bd.exec('COMMIT');
      console.log(`[bd] migración ${i + 1}/${migraciones.length} aplicada: ${migraciones[i].name}`);
    } catch (error) {
      bd.exec('ROLLBACK');
      throw new Error(`Fallo aplicando la migración ${i + 1} (${migraciones[i].name}): ${error.message}`);
    }
  }
}
