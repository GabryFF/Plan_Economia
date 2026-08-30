import { enTransaccion, obtenerBD } from '../db/conexion.js';
import { aCentimos, aEuros } from '../utiles/dinero.js';
import { conflicto, noEncontrado, peticionInvalida } from '../utiles/errores.js';

/**
 * Cuentas y traspasos.
 *
 * LA DECISIÓN DE FONDO: un traspaso no es ni ingreso ni gasto. Mover 500 € de la
 * corriente a la de ahorro no te hace más rico ni más pobre, así que no puede
 * aparecer en el balance, ni hundir tu tasa de ahorro, ni consumir presupuesto.
 *
 * Por eso los traspasos viven en su propia tabla en lugar de ser dos
 * movimientos enlazados: así no hay que acordarse de excluirlos en cada consulta
 * del resto de la aplicación, que es de donde salen los errores silenciosos.
 *
 * El saldo de una cuenta es: saldo inicial + ingresos − gastos + traspasos
 * recibidos − traspasos enviados.
 */

export const TIPOS_CUENTA = {
  corriente: 'Cuenta corriente',
  ahorro: 'Cuenta de ahorro',
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
};

const mapear = (f) => ({
  id: f.id,
  nombre: f.nombre,
  tipo: f.tipo,
  tipoEtiqueta: TIPOS_CUENTA[f.tipo] ?? f.tipo,
  saldoInicial: aEuros(f.saldo_inicial_centimos),
  color: f.color,
  orden: f.orden,
  activa: Boolean(f.activa),
  movimientos: f.movimientos ?? 0,
  saldo: aEuros(f.saldo ?? f.saldo_inicial_centimos),
});

/** Consulta con el saldo ya calculado: no se guarda, se deriva siempre. */
const SELECCION = `
  SELECT c.*,
         (SELECT COUNT(*) FROM movimientos m WHERE m.cuenta_id = c.id) AS movimientos,
         c.saldo_inicial_centimos
           + COALESCE((SELECT SUM(CASE WHEN m.tipo = 'ingreso' THEN m.importe_centimos
                                       ELSE -m.importe_centimos END)
                       FROM movimientos m WHERE m.cuenta_id = c.id), 0)
           + COALESCE((SELECT SUM(t.importe_centimos) FROM traspasos t WHERE t.destino_id = c.id), 0)
           - COALESCE((SELECT SUM(t.importe_centimos) FROM traspasos t WHERE t.origen_id = c.id), 0)
           AS saldo
  FROM cuentas c`;

export function listarCuentas({ incluirInactivas = false } = {}) {
  const cuentas = obtenerBD()
    .prepare(`${SELECCION} ${incluirInactivas ? '' : 'WHERE c.activa = 1'} ORDER BY c.orden, c.id`)
    .all()
    .map(mapear);

  return {
    cuentas,
    // El patrimonio es la suma de saldos: los traspasos entre cuentas se anulan.
    total: Math.round(cuentas.reduce((suma, c) => suma + c.saldo, 0) * 100) / 100,
  };
}

export function obtenerCuenta(id) {
  const fila = obtenerBD().prepare(`${SELECCION} WHERE c.id = ?`).get(id);
  if (!fila) throw noEncontrado('Cuenta');
  return mapear(fila);
}

export function crearCuenta({ nombre, tipo = 'corriente', saldoInicial = 0, color = '#2563eb' }) {
  const bd = obtenerBD();

  const duplicada = bd.prepare('SELECT id FROM cuentas WHERE nombre = ? COLLATE NOCASE').get(nombre);
  if (duplicada) throw conflicto(`Ya tienes una cuenta llamada "${nombre}"`);

  const { p } = bd.prepare('SELECT COALESCE(MAX(orden), -1) + 1 AS p FROM cuentas').get();

  const { lastInsertRowid } = bd
    .prepare('INSERT INTO cuentas (nombre, tipo, saldo_inicial_centimos, color, orden) VALUES (?, ?, ?, ?, ?)')
    .run(nombre, tipo, aCentimos(saldoInicial), color, p);

  return obtenerCuenta(Number(lastInsertRowid));
}

export function actualizarCuenta(id, cambios) {
  const bd = obtenerBD();
  const actual = obtenerCuenta(id);

  const nombre = cambios.nombre ?? actual.nombre;
  const duplicada = bd.prepare('SELECT id FROM cuentas WHERE nombre = ? COLLATE NOCASE AND id <> ?').get(nombre, id);
  if (duplicada) throw conflicto(`Ya tienes una cuenta llamada "${nombre}"`);

  bd.prepare(
    'UPDATE cuentas SET nombre = ?, tipo = ?, saldo_inicial_centimos = ?, color = ?, activa = ? WHERE id = ?'
  ).run(
    nombre,
    cambios.tipo ?? actual.tipo,
    aCentimos(cambios.saldoInicial ?? actual.saldoInicial),
    cambios.color ?? actual.color,
    (cambios.activa ?? actual.activa) ? 1 : 0,
    id
  );

  return obtenerCuenta(id);
}

/**
 * Borra la cuenta. Los movimientos NO se borran: quedan sin cuenta asignada.
 * Nunca se destruyen datos económicos por arrastre.
 */
export function borrarCuenta(id, { forzar = false } = {}) {
  const bd = obtenerBD();
  const cuenta = obtenerCuenta(id);

  const { traspasos } = bd
    .prepare('SELECT COUNT(*) AS traspasos FROM traspasos WHERE origen_id = ? OR destino_id = ?')
    .get(id, id);

  if ((cuenta.movimientos > 0 || traspasos > 0) && !forzar) {
    throw conflicto(
      `La cuenta "${cuenta.nombre}" tiene ${cuenta.movimientos} movimiento(s) y ${traspasos} traspaso(s). ` +
        'Desactívala para dejar de usarla, o confirma el borrado.'
    );
  }

  return enTransaccion(() => {
    bd.prepare('DELETE FROM cuentas WHERE id = ?').run(id);
    return { borrada: true, movimientosAfectados: cuenta.movimientos, traspasosBorrados: traspasos };
  });
}

/** Traspaso entre dos cuentas propias. No altera el patrimonio total. */
export function crearTraspaso({ fecha, importe, origenId, destinoId, descripcion = '' }) {
  const bd = obtenerBD();

  if (origenId === destinoId) throw peticionInvalida('El origen y el destino no pueden ser la misma cuenta');
  obtenerCuenta(origenId);
  obtenerCuenta(destinoId);

  const { lastInsertRowid } = bd
    .prepare('INSERT INTO traspasos (fecha, importe_centimos, origen_id, destino_id, descripcion) VALUES (?, ?, ?, ?, ?)')
    .run(fecha, aCentimos(importe), origenId, destinoId, descripcion);

  return obtenerTraspaso(Number(lastInsertRowid));
}

const SELECCION_TRASPASO = `
  SELECT t.*, o.nombre AS origen_nombre, o.color AS origen_color,
         d.nombre AS destino_nombre, d.color AS destino_color
  FROM traspasos t
  JOIN cuentas o ON o.id = t.origen_id
  JOIN cuentas d ON d.id = t.destino_id`;

const mapearTraspaso = (f) => ({
  id: f.id,
  fecha: f.fecha,
  importe: aEuros(f.importe_centimos),
  descripcion: f.descripcion,
  origen: { id: f.origen_id, nombre: f.origen_nombre, color: f.origen_color },
  destino: { id: f.destino_id, nombre: f.destino_nombre, color: f.destino_color },
});

export function obtenerTraspaso(id) {
  const fila = obtenerBD().prepare(`${SELECCION_TRASPASO} WHERE t.id = ?`).get(id);
  if (!fila) throw noEncontrado('Traspaso');
  return mapearTraspaso(fila);
}

export function listarTraspasos({ limite = 50 } = {}) {
  return obtenerBD()
    .prepare(`${SELECCION_TRASPASO} ORDER BY t.fecha DESC, t.id DESC LIMIT ?`)
    .all(limite)
    .map(mapearTraspaso);
}

export function borrarTraspaso(id) {
  const { changes } = obtenerBD().prepare('DELETE FROM traspasos WHERE id = ?').run(id);
  if (changes === 0) throw noEncontrado('Traspaso');
  return { borrado: true };
}
