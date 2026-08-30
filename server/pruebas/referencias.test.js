import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { limpiarBD, vaciarDatos } from './ayuda.js';
import { cerrarBD, obtenerBD } from '../src/db/conexion.js';
import * as reglas from '../src/servicios/reglas.js';
import * as presupuestos from '../src/servicios/presupuestos.js';
import * as metas from '../src/servicios/metas.js';
import * as recurrentes from '../src/servicios/recurrentes.js';
import * as movimientos from '../src/servicios/movimientos.js';
import * as ajustes from '../src/servicios/ajustes.js';
import {
  CATALOGO_REGLAS_ES, PERFIL_ESTANDAR, PERFIL_RENTA_AJUSTADA, perfilPara,
  REFERENCIAS_PRESUPUESTO, UMBRAL_RENTA_AJUSTADA,
} from '../src/servicios/referencias.js';
import { normalizar } from '../src/utiles/texto.js';

const bd = obtenerBD();
const idCategoria = (nombre) => bd.prepare('SELECT id FROM categorias WHERE nombre = ?').get(nombre)?.id;

const hoy = new Date();
const haceMeses = (n, dia = 10) => {
  const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - n, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

const filaDe = (resultado, nombre) => resultado.presupuestos.find((p) => p.categoriaNombre === nombre);

beforeEach(() => {
  vaciarDatos(bd);
  bd.exec('DELETE FROM reglas; DELETE FROM ajustes; DELETE FROM metas;');
});
after(() => { cerrarBD(); limpiarBD(); });

describe('catálogo de reglas típicas', () => {
  it('está bien formado: sin duplicados y con categorías que existen', () => {
    const categorias = new Set(
      bd.prepare('SELECT nombre FROM categorias').all().map((c) => normalizar(c.nombre))
    );

    const vistos = new Set();
    for (const entrada of CATALOGO_REGLAS_ES) {
      const clave = `${normalizar(entrada.patron)}|${entrada.categoria}`;
      assert.ok(!vistos.has(clave), `patrón duplicado en el catálogo: ${entrada.patron}`);
      vistos.add(clave);

      assert.ok(
        categorias.has(normalizar(entrada.categoria)),
        `la categoría "${entrada.categoria}" no está entre las iniciales`
      );
    }
  });

  it('coloca las reglas específicas por delante de las genéricas', () => {
    // Si AMAZON fuese antes que AMAZON PRIME, las suscripciones acabarían en compras.
    const posicion = (patron) => CATALOGO_REGLAS_ES.findIndex((e) => e.patron === patron);

    assert.ok(posicion('AMAZON PRIME') < posicion('AMAZON'));
    assert.ok(posicion('UBER EATS') < posicion('UBER'));
    assert.ok(posicion('REPSOL LUZ') < posicion('REPSOL'));
    assert.ok(posicion('MOVISTAR PLUS') < posicion('MOVISTAR'));
  });

  it('carga el catálogo y respeta su orden', () => {
    const resultado = reglas.cargarCatalogoTipico();

    assert.equal(resultado.creadas, CATALOGO_REGLAS_ES.length);
    assert.equal(resultado.yaExistian, 0);
    assert.deepEqual(resultado.categoriasQueFaltan, []);

    const cargadas = reglas.listarReglas();
    assert.deepEqual(cargadas.map((r) => r.patron), CATALOGO_REGLAS_ES.map((e) => e.patron));
  });

  it('es idempotente: cargarlo dos veces no duplica nada', () => {
    reglas.cargarCatalogoTipico();
    const segunda = reglas.cargarCatalogoTipico();

    assert.equal(segunda.creadas, 0);
    assert.equal(segunda.yaExistian, CATALOGO_REGLAS_ES.length);
    assert.equal(reglas.listarReglas().length, CATALOGO_REGLAS_ES.length);
  });

  it('conserva las reglas propias del usuario y las deja por delante', () => {
    const propia = reglas.crearRegla({ patron: 'MI TIENDA', categoriaId: idCategoria('Compras') });
    reglas.cargarCatalogoTipico();

    const cargadas = reglas.listarReglas();
    assert.equal(cargadas[0].id, propia.id, 'la del usuario sigue siendo la primera');
    assert.equal(cargadas.length, CATALOGO_REGLAS_ES.length + 1);
  });

  it('omite las reglas cuya categoría se ha borrado', () => {
    bd.prepare("DELETE FROM categorias WHERE nombre = 'Suscripciones'").run();

    try {
      const resultado = reglas.cargarCatalogoTipico();

      assert.deepEqual(resultado.categoriasQueFaltan, ['Suscripciones']);
      assert.ok(resultado.creadas < CATALOGO_REGLAS_ES.length);
      assert.ok(reglas.listarReglas().every((r) => r.categoriaNombre !== 'Suscripciones'));
    } finally {
      // Las categorías iniciales no las restaura `vaciarDatos`: se repone aquí
      // para no contaminar el resto de pruebas del fichero.
      bd.prepare("INSERT INTO categorias (nombre, tipo, color) VALUES ('Suscripciones', 'gasto', '#7c3aed')").run();
    }
  });

  it('clasifica conceptos reales de un extracto', () => {
    reglas.cargarCatalogoTipico();

    const casos = [
      ['COMPRA TARJ. MERCADONA MADRID', 'gasto', 'Alimentación'],
      ['RECIBO NETFLIX ESPANA', 'gasto', 'Suscripciones'],
      ['REPSOL E.S. 4471', 'gasto', 'Transporte'],
      ['PAGO AMAZON PRIME', 'gasto', 'Suscripciones'],
      ['COMPRA AMAZON MARKETPLACE', 'gasto', 'Compras'],
      ['UBER EATS PEDIDO', 'gasto', 'Ocio'],
      ['UBER TRIP', 'gasto', 'Transporte'],
      ['TRANSFERENCIA NOMINA AGOSTO', 'ingreso', 'Nómina'],
    ];

    for (const [texto, tipo, esperada] of casos) {
      assert.equal(reglas.categorizar(texto, tipo)?.categoriaNombre, esperada, texto);
    }
  });

  it('no captura falsos positivos conocidos', () => {
    reglas.cargarCatalogoTipico();

    // "DIA" a secas habría capturado estos; por eso el catálogo usa el nombre largo.
    assert.equal(reglas.categorizar('PAGO GUARDIA CIVIL', 'gasto'), null);
    assert.equal(reglas.categorizar('QUIOSCO DIARIO AS', 'gasto'), null);
  });
});

describe('porcentajes de referencia en presupuestos', () => {
  /** Ingresos de 2.000 € en dos meses cerrados. */
  const sembrarIngresos = () => {
    for (const n of [1, 2]) {
      movimientos.crearMovimiento({ fecha: haceMeses(n, 25), importe: 2000, tipo: 'ingreso' });
    }
  };

  it('convierte el porcentaje en euros sobre los ingresos medios', () => {
    sembrarIngresos();
    const resultado = presupuestos.listarPresupuestos({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });

    assert.equal(resultado.ingresoBase.importe, 2000);
    assert.equal(resultado.ingresoBase.origen, 'mediana');
    assert.equal(resultado.perfil.clave, 'estandar', '2.000 € supera el umbral de renta ajustada');

    const ocio = filaDe(resultado, 'Ocio');
    assert.equal(ocio.recomendado.minPorcentaje, 5);
    assert.equal(ocio.recomendado.maxPorcentaje, 10);
    assert.equal(ocio.recomendado.min, 100);
    assert.equal(ocio.recomendado.max, 200);
    assert.equal(ocio.recomendado.sugerido, 150, 'el punto medio del rango');
    assert.equal(ocio.recomendado.mediaEspana, 9.3);
  });

  it('la nómina declarada manda sobre el histórico, para que una subida se note ya', () => {
    recurrentes.crearRecurrente({
      nombre: 'Nómina', importe: 1000, tipo: 'ingreso', diaDelMes: 25, fechaInicio: haceMeses(6),
    });

    const resultado = presupuestos.listarPresupuestos({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
    assert.equal(resultado.ingresoBase.origen, 'nomina-declarada');
    assert.equal(resultado.ingresoBase.importe, 1000);
    // 1.000 € está por debajo del umbral: se aplica el perfil de renta ajustada,
    // cuyo tope de vivienda es el 35 %.
    assert.equal(resultado.perfil.clave, 'renta-ajustada');
    assert.equal(filaDe(resultado, 'Vivienda').recomendado.max, 350);
  });

  it('sin ingresos no inventa importes, pero mantiene los porcentajes', () => {
    const resultado = presupuestos.listarPresupuestos({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });

    assert.equal(resultado.ingresoBase.origen, 'sin-datos');
    const ocio = filaDe(resultado, 'Ocio');
    assert.equal(ocio.recomendado.sugerido, null);
    assert.equal(ocio.recomendado.minPorcentaje, 5);
  });

  it('con 14 pagas presupuesta sobre el mes normal, no sobre la media', () => {
    // Diez meses de 1.600 € y dos de 3.200 €: la media sería 1.866,67 € y
    // inflaría el presupuesto de los diez meses normales.
    for (let n = 1; n <= 12; n += 1) {
      const esExtra = n === 6 || n === 12;
      movimientos.crearMovimiento({
        fecha: haceMeses(n, 25),
        importe: esExtra ? 3200 : 1600,
        tipo: 'ingreso',
      });
    }

    const resultado = presupuestos.listarPresupuestos({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });

    assert.equal(resultado.ingresoBase.origen, 'mediana', 'sin nómina declarada se recurre al histórico');
    assert.equal(resultado.ingresoBase.importe, 1600, 'la mediana ignora las dos extras');
    assert.equal(resultado.perfil.clave, 'renta-ajustada');
    assert.equal(filaDe(resultado, 'Ocio').recomendado.max, 128, '8 % de 1.600 €');
  });

  it('calcula el neto anual y las extras según las pagas declaradas', () => {
    ajustes.guardarAjustes({ pagasAlAnio: 14 });
    recurrentes.crearRecurrente({
      nombre: 'Nómina', importe: 1600, tipo: 'ingreso', diaDelMes: 25, fechaInicio: haceMeses(6),
    });

    const resultado = presupuestos.listarPresupuestos({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });

    assert.equal(resultado.ingresoBase.pagasAlAnio, 14);
    assert.equal(resultado.ingresoBase.anual, 22400);
    assert.equal(resultado.ingresoBase.extrasAlAnio, 3200);
  });

  it('las categorías propias del usuario no llevan referencia', () => {
    bd.prepare("INSERT INTO categorias (nombre, tipo) VALUES ('Mascota', 'gasto')").run();
    const resultado = presupuestos.listarPresupuestos({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });

    assert.equal(filaDe(resultado, 'Mascota').recomendado, null);
  });

  it('el perfil de renta ajustada es coherente y reparte distinto, no solo menos', () => {
    for (const [nombre, referencia] of Object.entries(PERFIL_RENTA_AJUSTADA)) {
      assert.ok(referencia.min <= referencia.max, `${nombre}: el mínimo supera al máximo`);
      assert.ok(referencia.nota.length > 0, `${nombre}: falta la explicación`);
      assert.ok(PERFIL_ESTANDAR[nombre], `${nombre}: no existe en el perfil estándar`);
    }

    // Ley de Engel: a menor renta pesan más los gastos incomprimibles...
    assert.ok(PERFIL_RENTA_AJUSTADA.Alimentación.min > PERFIL_ESTANDAR.Alimentación.min);
    assert.ok(PERFIL_RENTA_AJUSTADA.Transporte.min > PERFIL_ESTANDAR.Transporte.min);
    // ...y queda menos margen para lo prescindible y para el ahorro mensual.
    assert.ok(PERFIL_RENTA_AJUSTADA.Ocio.max < PERFIL_ESTANDAR.Ocio.max);
    assert.ok(PERFIL_RENTA_AJUSTADA['Ahorro/Inversión'].max < PERFIL_ESTANDAR['Ahorro/Inversión'].max);
  });

  it('el umbral de perfil se aplica de forma estable', () => {
    assert.equal(perfilPara(1799).clave, 'renta-ajustada');
    assert.equal(perfilPara(UMBRAL_RENTA_AJUSTADA).clave, 'estandar');
    assert.equal(perfilPara(0).clave, 'estandar', 'sin datos se usa el más citado');
  });

  it('la tabla de referencias es coherente', () => {
    for (const [nombre, referencia] of Object.entries(REFERENCIAS_PRESUPUESTO)) {
      assert.ok(referencia.min <= referencia.max, `${nombre}: el mínimo supera al máximo`);
      assert.ok(referencia.max <= 40, `${nombre}: un tope tan alto no es una referencia útil`);
      assert.ok(referencia.nota.length > 0, `${nombre}: falta la explicación`);
    }

    // La vivienda es la referencia más conocida: no pasar del 30 %.
    assert.equal(REFERENCIAS_PRESUPUESTO.Vivienda.max, 30);
  });
});
