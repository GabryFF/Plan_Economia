/**
 * Categorías por defecto. Solo se insertan si la tabla está vacía, para que
 * borrar una categoría no la resucite en el siguiente arranque.
 */
const CATEGORIAS_INICIALES = [
  { nombre: 'Nómina',          tipo: 'ingreso', color: '#16a34a' },
  { nombre: 'Otros ingresos',  tipo: 'ingreso', color: '#0d9488' },
  { nombre: 'Vivienda',        tipo: 'gasto',   color: '#dc2626' },
  { nombre: 'Suministros',     tipo: 'gasto',   color: '#ea580c' },
  { nombre: 'Alimentación',    tipo: 'gasto',   color: '#d97706' },
  { nombre: 'Transporte',      tipo: 'gasto',   color: '#2563eb' },
  { nombre: 'Suscripciones',   tipo: 'gasto',   color: '#7c3aed' },
  { nombre: 'Salud',           tipo: 'gasto',   color: '#db2777' },
  { nombre: 'Ocio',            tipo: 'gasto',   color: '#c026d3' },
  { nombre: 'Compras',         tipo: 'gasto',   color: '#0891b2' },
  { nombre: 'Ahorro/Inversión', tipo: 'gasto',  color: '#059669' },
  { nombre: 'Otros gastos',    tipo: 'gasto',   color: '#64748b' },
];

export function sembrarCategoriasIniciales(bd) {
  const { total } = bd.prepare('SELECT COUNT(*) AS total FROM categorias').get();
  if (total > 0) return;

  const insertar = bd.prepare(
    'INSERT INTO categorias (nombre, tipo, color) VALUES (?, ?, ?)'
  );
  for (const c of CATEGORIAS_INICIALES) insertar.run(c.nombre, c.tipo, c.color);

  console.log(`[bd] ${CATEGORIAS_INICIALES.length} categorías iniciales creadas`);
}

/**
 * Cuenta inicial. Con una sola cuenta el selector no aparece en ningún sitio, así
 * que el usuario ni se entera de que existen hasta que necesita una segunda.
 * Pero tiene que haber una: si no, la pantalla de Cuentas arranca vacía y el
 * saldo no se puede calcular.
 */
export function sembrarCuentaInicial(bd) {
  const { total } = bd.prepare('SELECT COUNT(*) AS total FROM cuentas').get();
  if (total > 0) return;

  bd.prepare(
    "INSERT INTO cuentas (nombre, tipo, color, orden) VALUES ('Cuenta principal', 'corriente', '#2563eb', 0)"
  ).run();

  console.log('[bd] cuenta inicial creada');
}
