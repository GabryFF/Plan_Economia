import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { limpiarBD, vaciarDatos } from './ayuda.js';
import { cerrarBD, obtenerBD } from '../src/db/conexion.js';
import * as ajustes from '../src/servicios/ajustes.js';
import * as autonomo from '../src/servicios/autonomo.js';
import { saludFinanciera } from '../src/servicios/salud.js';

const bd = obtenerBD();

beforeEach(() => {
  vaciarDatos(bd);
  bd.exec('DELETE FROM ajustes; DELETE FROM metas;');
});
after(() => { cerrarBD(); limpiarBD(); });

describe('registro de facturas', () => {
  it('desglosa base, IVA y retención, y calcula lo que se cobra', () => {
    const factura = autonomo.registrarFactura({
      fecha: '2026-08-05', base: 1000, tipoIva: 21, tipoIrpf: 15, tipo: 'ingreso', descripcion: 'Factura 1',
    });

    assert.equal(factura.base, 1000);
    assert.equal(factura.iva, 210);
    assert.equal(factura.irpf, 150);
    assert.equal(factura.importe, 1060, 'base + IVA − retención es lo que entra en el banco');
  });

  it('en un gasto no hay retención y el importe es base más IVA', () => {
    const gasto = autonomo.registrarFactura({
      fecha: '2026-08-05', base: 100, tipoIva: 21, tipoIrpf: 15, tipo: 'gasto',
    });

    assert.equal(gasto.irpf, 0, 'la retención solo aplica a lo que emites');
    assert.equal(gasto.importe, 121);
  });

  it('la factura también es un movimiento normal del resto de la aplicación', () => {
    autonomo.registrarFactura({ fecha: '2026-08-05', base: 1000, tipoIva: 21, tipoIrpf: 15, tipo: 'ingreso' });

    const fila = bd.prepare('SELECT * FROM movimientos').get();
    assert.equal(fila.importe_centimos, 106000, 'el movimiento refleja lo cobrado, no la base');
    assert.equal(fila.base_centimos, 100000);
    assert.equal(fila.iva_centimos, 21000);
  });

  it('rechaza una base que no sea positiva', () => {
    assert.throws(
      () => autonomo.registrarFactura({ fecha: '2026-08-05', base: 0, tipoIva: 21, tipo: 'ingreso' }),
      /mayor que 0/
    );
  });
});

describe('resumen trimestral', () => {
  const sembrarTrimestre = () => {
    autonomo.registrarFactura({ fecha: '2026-07-10', base: 2000, tipoIva: 21, tipoIrpf: 15, tipo: 'ingreso' });
    autonomo.registrarFactura({ fecha: '2026-08-10', base: 1000, tipoIva: 21, tipoIrpf: 15, tipo: 'ingreso' });
    autonomo.registrarFactura({ fecha: '2026-09-10', base: 500, tipoIva: 21, tipo: 'gasto' });
  };

  it('calcula el IVA a ingresar como repercutido menos soportado', () => {
    sembrarTrimestre();
    const t = autonomo.resumenTrimestre({ anio: 2026, trimestre: 3 });

    assert.equal(t.iva.repercutido, 630, '21 % de 3.000');
    assert.equal(t.iva.soportado, 105, '21 % de 500');
    assert.equal(t.iva.aIngresar, 525);
    assert.equal(t.iva.aCompensar, 0);
  });

  it('un IVA negativo se compensa, no se paga', () => {
    autonomo.registrarFactura({ fecha: '2026-07-10', base: 100, tipoIva: 21, tipo: 'ingreso' });
    autonomo.registrarFactura({ fecha: '2026-07-11', base: 1000, tipoIva: 21, tipo: 'gasto' });

    const t = autonomo.resumenTrimestre({ anio: 2026, trimestre: 3 });
    assert.ok(t.iva.aIngresar < 0);
    assert.equal(t.iva.aCompensar, 189, 'se arrastra a los trimestres siguientes');
    assert.equal(t.provision, 0, 'no se provisiona un IVA que no hay que pagar');
  });

  it('descuenta del pago fraccionado lo ya retenido en factura', () => {
    sembrarTrimestre();
    const t = autonomo.resumenTrimestre({ anio: 2026, trimestre: 3 });

    assert.equal(t.rendimientoNeto, 2500, '3.000 de ingresos menos 500 de gastos');
    assert.equal(t.ingresos.irpfRetenido, 450, '15 % de 3.000');
    // 20 % de 2.500 = 500, menos 450 ya retenidos = 50.
    assert.equal(t.irpf.pagoFraccionadoEstimado, 50);
  });

  it('el pago fraccionado nunca es negativo', () => {
    // Mucha retención y poco beneficio: no se devuelve nada por esta vía.
    autonomo.registrarFactura({ fecha: '2026-07-10', base: 1000, tipoIva: 21, tipoIrpf: 15, tipo: 'ingreso' });
    autonomo.registrarFactura({ fecha: '2026-07-11', base: 900, tipoIva: 21, tipo: 'gasto' });

    assert.equal(autonomo.resumenTrimestre({ anio: 2026, trimestre: 3 }).irpf.pagoFraccionadoEstimado, 0);
  });

  it('la provisión suma el IVA a pagar y el pago fraccionado', () => {
    sembrarTrimestre();
    const t = autonomo.resumenTrimestre({ anio: 2026, trimestre: 3 });

    assert.equal(t.provision, 575, '525 de IVA + 50 de IRPF');
  });

  it('el disponible real descuenta impuestos y cuota', () => {
    ajustes.guardarAjustes({ autonomoCuota: 300 });
    sembrarTrimestre();

    const t = autonomo.resumenTrimestre({ anio: 2026, trimestre: 3 });
    assert.equal(t.cuotaAutonomos.trimestre, 900, '300 x 3 meses');
    // 2.500 de rendimiento − 50 de pago fraccionado − 900 de cuota.
    assert.equal(t.disponibleReal, 1550);
  });

  it('no mezcla trimestres', () => {
    autonomo.registrarFactura({ fecha: '2026-06-30', base: 1000, tipoIva: 21, tipo: 'ingreso' });
    autonomo.registrarFactura({ fecha: '2026-07-01', base: 2000, tipoIva: 21, tipo: 'ingreso' });

    assert.equal(autonomo.resumenTrimestre({ anio: 2026, trimestre: 2 }).ingresos.base, 1000);
    assert.equal(autonomo.resumenTrimestre({ anio: 2026, trimestre: 3 }).ingresos.base, 2000);
  });

  it('un trimestre sin facturas no rompe nada', () => {
    const t = autonomo.resumenTrimestre({ anio: 2026, trimestre: 1 });

    assert.equal(t.facturas, 0);
    assert.equal(t.provision, 0);
    assert.equal(t.iva.aIngresar, 0);
  });

  it('acota bien las fechas del trimestre, incluido febrero', () => {
    const t = autonomo.resumenTrimestre({ anio: 2026, trimestre: 1 });
    assert.equal(t.desde, '2026-01-01');
    assert.equal(t.hasta, '2026-03-31');

    const cuarto = autonomo.resumenTrimestre({ anio: 2026, trimestre: 4 });
    assert.equal(cuarto.hasta, '2026-12-31');
  });
});

describe('panel y referencias', () => {
  it('el trimestre anterior cruza bien el cambio de año', () => {
    assert.deepEqual(autonomo.trimestreDe(new Date(2026, 0, 15)), { anio: 2026, trimestre: 1 });
    assert.deepEqual(autonomo.trimestreDe(new Date(2026, 11, 15)), { anio: 2026, trimestre: 4 });
    assert.deepEqual(autonomo.trimestreDe(new Date(2026, 6, 1)), { anio: 2026, trimestre: 3 });
  });

  it('la referencia de cuota advierte de que las fuentes discrepan', () => {
    const { referencia } = autonomo.configuracion();

    assert.equal(referencia.tarifaPlana, 80);
    assert.equal(referencia.tramos, 15);
    assert.match(referencia.aviso, /discrepan|Seguridad Social/, 'no se presenta como dato cerrado');
  });

  it('el panel trae el trimestre en curso y el anterior', () => {
    const panel = autonomo.panel();

    assert.ok(panel.actual);
    assert.ok(panel.anterior);
    assert.equal(panel.modelos.length, 4);
    assert.equal(panel.calendario.length, 4);
  });
});

describe('concentración de clientes y TRADE', () => {
  it('detecta que un cliente supera el 75 % de la facturación', () => {
    autonomo.registrarFactura({ fecha: '2026-02-10', base: 8000, tipoIva: 21, tipo: 'ingreso', cliente: 'Cliente A' });
    autonomo.registrarFactura({ fecha: '2026-05-10', base: 1500, tipoIva: 21, tipo: 'ingreso', cliente: 'Cliente B' });

    const c = autonomo.concentracionClientes({ anio: 2026 });

    assert.equal(c.totalFacturado, 9500);
    assert.equal(c.principal.cliente, 'Cliente A');
    assert.equal(c.principal.porcentaje, 84.2);
    assert.equal(c.posibleTrade, true);
  });

  it('con la facturación repartida no marca TRADE', () => {
    autonomo.registrarFactura({ fecha: '2026-02-10', base: 5000, tipoIva: 21, tipo: 'ingreso', cliente: 'Cliente A' });
    autonomo.registrarFactura({ fecha: '2026-05-10', base: 5000, tipoIva: 21, tipo: 'ingreso', cliente: 'Cliente B' });

    assert.equal(autonomo.concentracionClientes({ anio: 2026 }).posibleTrade, false);
  });

  it('no marca TRADE si los clientes no están identificados', () => {
    autonomo.registrarFactura({ fecha: '2026-02-10', base: 9000, tipoIva: 21, tipo: 'ingreso' });

    const c = autonomo.concentracionClientes({ anio: 2026 });
    assert.equal(c.principal.cliente, 'Sin identificar');
    assert.equal(c.posibleTrade, false, 'sin saber a quién facturas no se puede concluir nada');
  });

  it('no mezcla años', () => {
    autonomo.registrarFactura({ fecha: '2025-06-10', base: 9000, tipoIva: 21, tipo: 'ingreso', cliente: 'Antiguo' });
    autonomo.registrarFactura({ fecha: '2026-06-10', base: 1000, tipoIva: 21, tipo: 'ingreso', cliente: 'Nuevo' });

    assert.equal(autonomo.concentracionClientes({ anio: 2026 }).totalFacturado, 1000);
  });

  it('los gastos no cuentan como facturación a clientes', () => {
    autonomo.registrarFactura({ fecha: '2026-02-10', base: 1000, tipoIva: 21, tipo: 'ingreso', cliente: 'Cliente A' });
    autonomo.registrarFactura({ fecha: '2026-02-11', base: 500, tipoIva: 21, tipo: 'gasto', cliente: 'Proveedor' });

    const c = autonomo.concentracionClientes({ anio: 2026 });
    assert.equal(c.totalFacturado, 1000);
    assert.equal(c.clientes.length, 1);
  });
});

describe('resumen anual y reducciones', () => {
  it('suma los cuatro trimestres', () => {
    autonomo.registrarFactura({ fecha: '2026-02-10', base: 3000, tipoIva: 21, tipo: 'ingreso' });
    autonomo.registrarFactura({ fecha: '2026-08-10', base: 2000, tipoIva: 21, tipo: 'ingreso' });
    autonomo.registrarFactura({ fecha: '2026-11-10', base: 1000, tipoIva: 21, tipo: 'gasto' });

    const a = autonomo.resumenAnual({ anio: 2026 });
    assert.equal(a.trimestres.length, 4);
    assert.equal(a.facturado, 5000);
    assert.equal(a.gastos, 1000);
    assert.equal(a.rendimientoNeto, 4000);
  });

  it('aplica el 5 % de gastos de difícil justificación', () => {
    autonomo.registrarFactura({ fecha: '2026-02-10', base: 10000, tipoIva: 21, tipo: 'ingreso' });

    const a = autonomo.resumenAnual({ anio: 2026 });
    assert.equal(a.dificilJustificacion.importe, 500, '5 % de 10.000');
    assert.equal(a.rendimientoTrasReduccion, 9500);
  });

  it('respeta el tope de 2.000 € de la reducción', () => {
    autonomo.registrarFactura({ fecha: '2026-02-10', base: 80000, tipoIva: 21, tipo: 'ingreso' });

    // El 5 % de 80.000 serían 4.000, pero la ley lo limita a 2.000.
    assert.equal(autonomo.resumenAnual({ anio: 2026 }).dificilJustificacion.importe, 2000);
  });

  it('con pérdidas no genera una reducción negativa', () => {
    autonomo.registrarFactura({ fecha: '2026-02-10', base: 1000, tipoIva: 21, tipo: 'gasto' });

    const a = autonomo.resumenAnual({ anio: 2026 });
    assert.ok(a.rendimientoNeto < 0);
    assert.equal(a.dificilJustificacion.importe, 0);
  });
});

describe('guía de gastos deducibles', () => {
  it('la calculadora de suministros aplica el 30 % sobre la parte afecta', () => {
    // El error habitual es creer que se deduce el 30 % de la factura entera.
    const r = autonomo.suministrosDeducibles({ importeMensual: 100, porcentajeSuperficieAfecta: 20 });

    assert.equal(r.deducibleMensual, 6, '100 x 20 % x 30 %');
    assert.equal(r.deducibleAnual, 72);
    assert.equal(r.porcentajeEfectivo, 6, 'un 6 % efectivo, no un 30 %');
  });

  it('sin superficie afecta no hay nada que deducir', () => {
    assert.equal(autonomo.suministrosDeducibles({ importeMensual: 100, porcentajeSuperficieAfecta: 0 }).deducibleMensual, 0);
  });

  it('marca como riesgo alto lo que más revisa Hacienda', () => {
    const { gastos } = autonomo.guiaFiscal();
    const riesgoAlto = gastos.filter((g) => g.riesgo === 'alto').map((g) => g.concepto);

    assert.ok(riesgoAlto.some((c) => c.includes('Vehículo')));
    assert.ok(riesgoAlto.some((c) => c.includes('Manutención')));
  });

  it('cada gasto explica su regla, no solo si es deducible', () => {
    for (const gasto of autonomo.guiaFiscal().gastos) {
      assert.ok(gasto.nota.length > 30, `${gasto.concepto}: la nota no explica nada`);
      assert.ok(gasto.deducible.length > 0);
    }
  });

  it('trae las fuentes oficiales para poder comprobarlo', () => {
    const { fuentes, limites } = autonomo.guiaFiscal();

    assert.ok(fuentes.some((f) => f.url.includes('agenciatributaria')));
    assert.ok(fuentes.some((f) => f.url.includes('seg-social')));
    assert.equal(limites.dietaEspana, 26.67);
    assert.equal(limites.dietaEspanaPernocta, 53.34);
  });
});

describe('convivencia con el resto de la aplicación', () => {
  it('una factura cuenta como ingreso normal en el plan de ahorro', () => {
    const hoy = new Date();
    const mesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 15);
    const fecha = `${mesPasado.getFullYear()}-${String(mesPasado.getMonth() + 1).padStart(2, '0')}-15`;

    autonomo.registrarFactura({ fecha, base: 2000, tipoIva: 21, tipoIrpf: 15, tipo: 'ingreso' });

    const salud = saludFinanciera();
    // Entra lo cobrado (2.000 + 420 − 300 = 2.120), no la base.
    assert.equal(salud.medias.ingresos, 2120);
  });
});
