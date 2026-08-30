import { useState } from 'react';
import { autonomo as apiAutonomo } from '../api/recursos';
import { Campo } from './Campos';
import type { ConcentracionClientes, GuiaFiscal as Guia, ResumenAnual, Suministros } from '../tipos';
import { aNumero, euros, numero } from '../utiles/formato';

const ETIQUETA_RIESGO = {
  alto: 'Hacienda lo revisa',
  medio: 'Justifícalo bien',
  bajo: 'Sin complicaciones',
} as const;

/** Calculadora de suministros: la fórmula sorprende y conviene verla en euros. */
function CalculadoraSuministros({ limites }: { limites: Guia['limites'] }) {
  const [importe, setImporte] = useState('100');
  const [superficie, setSuperficie] = useState('20');
  const [resultado, setResultado] = useState<Suministros | null>(null);

  const calcular = async () => {
    const importeMensual = aNumero(importe);
    const porcentaje = aNumero(superficie);
    if (importeMensual === null || porcentaje === null) return;

    setResultado(await apiAutonomo.suministros(importeMensual, porcentaje));
  };

  return (
    <>
      <div className="filtros__campos">
        <Campo etiqueta="Factura mensual (€)" htmlFor="sum-importe">
          <input id="sum-importe" type="text" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} />
        </Campo>
        <Campo etiqueta="% de la casa afecto" ayuda="El declarado en el 036/037" htmlFor="sum-superficie">
          <input id="sum-superficie" type="text" inputMode="decimal" value={superficie} onChange={(e) => setSuperficie(e.target.value)} />
        </Campo>
        <button type="button" className="boton boton--secundario" onClick={calcular}>Calcular</button>
      </div>

      {resultado && (
        <div className="alerta alerta--info">
          <div>
            {euros(resultado.importeMensual)} × {numero(resultado.porcentajeSuperficieAfecta, 0)} % ×{' '}
            {resultado.porcentajeAplicado} % = <strong>{euros(resultado.deducibleMensual)} al mes</strong> (
            {euros(resultado.deducibleAnual)} al año). Es un{' '}
            <strong>{numero(resultado.porcentajeEfectivo, 1)} % efectivo</strong> de la factura, no el{' '}
            {limites.suministrosPorcentaje} %: ese porcentaje se aplica sobre la parte afecta, no sobre el total.
          </div>
        </div>
      )}
    </>
  );
}

export function GuiaFiscal({ guia, clientes, anual }: {
  guia: Guia;
  clientes: ConcentracionClientes;
  anual: ResumenAnual;
}) {
  return (
    <>
      {clientes.clientes.length > 0 && (
        <section className="tarjeta">
          <h2 className="titulo-seccion">Tus clientes en {clientes.anio}</h2>

          {clientes.posibleTrade && (
            <div className="alerta alerta--aviso">
              <div>
                <strong>
                  {clientes.principal!.cliente} concentra el {numero(clientes.principal!.porcentaje, 1)} % de lo que
                  facturas.
                </strong>{' '}
                Por encima del {clientes.umbral} % puedes cumplir el primer requisito para ser <strong>TRADE</strong>{' '}
                (trabajador autónomo económicamente dependiente), una figura con derechos que un autónomo normal no
                tiene. Ojo: es solo uno de los siete requisitos, y los demás no los puede saber la aplicación.
              </div>
            </div>
          )}

          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="a-derecha">Facturado (base)</th>
                  <th style={{ width: '14rem' }}>Peso</th>
                </tr>
              </thead>
              <tbody>
                {clientes.clientes.map((c) => (
                  <tr key={c.cliente}>
                    <td>{c.cliente}</td>
                    <td className="a-derecha importe">{euros(c.facturado)}</td>
                    <td>
                      <div className="barra-consumo">
                        <div className={`barra-consumo__pista barra-consumo__pista--${c.porcentaje > clientes.umbral ? 'excedido' : 'ok'}`}>
                          <span style={{ width: `${Math.min(c.porcentaje, 100)}%` }} />
                        </div>
                        <small>{numero(c.porcentaje, 1)} %</small>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="nota">
            La concentración de clientes tiene dos lecturas y conviene ver las dos: puede darte derechos como TRADE, y
            es el mayor riesgo de tu negocio, porque si ese cliente se cae te quedas sin ingresos de golpe.
          </p>
        </section>
      )}

      <section className="tarjeta">
        <h2 className="titulo-seccion">Autónomo dependiente (TRADE)</h2>
        <div className="rejilla-dos">
          <div>
            <h3 className="titulo-menor">Los siete requisitos</h3>
            <ul className="lista-notas">
              {guia.trade.requisitos.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>
          <div>
            <h3 className="titulo-menor">Lo que ganas si lo eres</h3>
            <ul className="lista-notas">
              {guia.trade.derechos.map((d) => <li key={d}>{d}</li>)}
            </ul>
            <p className="nota">{guia.trade.formalizacion}</p>
          </div>
        </div>

        <div className="alerta alerta--aviso">
          <div>{guia.trade.avisoFalsoAutonomo}</div>
        </div>
      </section>

      <section className="tarjeta">
        <h2 className="titulo-seccion">Qué puedes deducir</h2>

        <div className="rejilla-dos">
          {guia.requisitos.map((r) => (
            <div key={r.requisito} className="consejo consejo--info">
              <div>
                <strong>{r.requisito}</strong>
                <p>{r.detalle}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="tabla-envoltorio">
          <table className="tabla">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Cuánto</th>
                <th>Reglas</th>
              </tr>
            </thead>
            <tbody>
              {guia.gastos.map((g) => (
                <tr key={g.concepto} className={g.riesgo === 'alto' ? 'es-excedida' : ''}>
                  <td>
                    <strong>{g.concepto}</strong>
                    <br />
                    <span className={`pastilla ${g.riesgo === 'alto' ? 'pastilla--error' : g.riesgo === 'medio' ? 'pastilla--aviso' : 'pastilla--ok'}`}>
                      {ETIQUETA_RIESGO[g.riesgo as keyof typeof ETIQUETA_RIESGO]}
                    </span>
                  </td>
                  <td><strong>{g.deducible}</strong></td>
                  <td><small>{g.nota}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="titulo-menor">Calculadora de suministros</h3>
        <CalculadoraSuministros limites={guia.limites} />
      </section>

      <section className="tarjeta">
        <h2 className="titulo-seccion">Resumen del año {anual.anio}</h2>
        <div className="rejilla-ahorro">
          <ul className="lista-datos">
            <li><span>Facturado (base)</span><strong>{euros(anual.facturado)}</strong></li>
            <li><span>Gastos deducidos</span><strong>{euros(anual.gastos)}</strong></li>
            <li className="es-destacado"><span>Rendimiento neto</span><strong>{euros(anual.rendimientoNeto)}</strong></li>
          </ul>

          <ul className="lista-datos">
            <li><span>IVA ingresado</span><strong>{euros(anual.ivaIngresado)}</strong></li>
            <li><span>IRPF retenido en facturas</span><strong>{euros(anual.irpfRetenido)}</strong></li>
            <li><span>Cuota de autónomos</span><strong>{euros(anual.cuotaAnual)}</strong></li>
          </ul>

          <ul className="lista-datos">
            <li>
              <span>Gastos de difícil justificación ({anual.dificilJustificacion.porcentaje} %, tope {euros(anual.dificilJustificacion.tope)})</span>
              <strong className="es-ingreso">−{euros(anual.dificilJustificacion.importe)}</strong>
            </li>
            <li className="es-destacado">
              <span>Rendimiento tras la reducción</span>
              <strong>{euros(anual.rendimientoTrasReduccion)}</strong>
            </li>
          </ul>
        </div>
        <p className="nota">{anual.dificilJustificacion.nota}</p>
      </section>

      <section className="tarjeta">
        <h2 className="titulo-seccion">Comprobarlo en la fuente</h2>
        <ul className="lista-fuentes">
          {guia.fuentes.map((f) => (
            <li key={f.url}>
              <div>
                <strong>{f.organismo}</strong>
                <p><a href={f.url} target="_blank" rel="noreferrer">{f.url}</a></p>
              </div>
            </li>
          ))}
        </ul>
        <p className="nota">
          Los límites de esta pantalla se consultaron el {guia.limites.fechaConsulta} y <strong>caducan</strong>: se
          revisan cada año. Nada de esto sustituye a una gestoría; está aquí para que sepas qué preguntar y qué
          guardar.
        </p>
      </section>
    </>
  );
}
