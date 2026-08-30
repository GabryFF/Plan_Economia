import { useState } from 'react';
import { ErrorApi } from '../api/cliente';
import { presupuestos as apiPresupuestos } from '../api/recursos';
import { Cargando, ErrorCarga, Vacio } from '../componentes/Estados';
import { SelectorPeriodo } from '../componentes/SelectorPeriodo';
import { useAvisos } from '../hooks/useAvisos';
import { useRecurso } from '../hooks/useRecurso';
import type { PresupuestoCategoria, Presupuestos } from '../tipos';
import { aNumero, euros, nombreMes, porcentaje } from '../utiles/formato';

const TEXTO_ESTADO: Record<PresupuestoCategoria['estado'], string> = {
  'sin-presupuesto': 'Sin presupuesto',
  ok: 'Dentro del presupuesto',
  riesgo: 'Cerca del límite',
  excedido: 'Presupuesto superado',
};

/** Barra de consumo del presupuesto: verde / ámbar / rojo según el estado. */
function BarraConsumo({ fila }: { fila: PresupuestoCategoria }) {
  if (fila.presupuesto === null) return <span className="texto-apagado">—</span>;

  const ancho = Math.min(fila.porcentaje ?? 0, 100);

  return (
    <div className="barra-consumo" title={TEXTO_ESTADO[fila.estado]}>
      <div className={`barra-consumo__pista barra-consumo__pista--${fila.estado}`}>
        <span style={{ width: `${ancho}%` }} />
      </div>
      <small>{porcentaje(fila.porcentaje, 0)}</small>
    </div>
  );
}

/** Celda editable del importe presupuestado: se guarda al salir del campo. */
function CeldaPresupuesto({
  fila, onGuardar,
}: {
  fila: PresupuestoCategoria;
  onGuardar: (categoriaId: number, importe: number) => Promise<void>;
}) {
  const [valor, setValor] = useState(fila.presupuesto !== null ? String(fila.presupuesto).replace('.', ',') : '');
  const [error, setError] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const numero = valor.trim() === '' ? 0 : aNumero(valor);
    if (numero === null || numero < 0) {
      setError(true);
      return;
    }
    setError(false);
    if (numero === (fila.presupuesto ?? 0)) return;

    setGuardando(true);
    try {
      await onGuardar(fila.categoriaId, numero);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className={`celda-editable ${error ? 'es-error' : ''}`}>
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        placeholder="Sin límite"
        aria-label={`Presupuesto de ${fila.categoriaNombre}`}
        onChange={(e) => setValor(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        disabled={guardando}
      />
      <span className="celda-editable__sufijo">€</span>
    </div>
  );
}

/**
 * Referencia orientativa de la categoría: el rango en porcentaje de los ingresos
 * y su equivalente en euros, con un atajo para aplicarlo.
 */
function Recomendacion({
  fila, ingresoBase, onUsar,
}: {
  fila: PresupuestoCategoria;
  ingresoBase: Presupuestos['ingresoBase'];
  onUsar: (categoriaId: number, importe: number) => Promise<void>;
}) {
  if (!fila.recomendado) return <span className="texto-apagado">—</span>;

  const { minPorcentaje, maxPorcentaje, min, max, sugerido, mediaEspana, nota } = fila.recomendado;

  /**
   * Gastar por debajo del mínimo NO es un problema: es ahorro. Solo pasarse del
   * máximo merece aviso, y solo entonces (o si no hay presupuesto) tiene sentido
   * ofrecer el punto medio.
   */
  const estado =
    fila.presupuesto === null || min === null || max === null
      ? 'sin-presupuesto'
      : fila.presupuesto < min
        ? 'por-debajo'
        : fila.presupuesto > max
          ? 'por-encima'
          : 'en-rango';

  return (
    <div className="recomendacion" title={nota}>
      <span className="recomendacion__rango">
        {minPorcentaje}–{maxPorcentaje} %
        {min !== null && max !== null && (
          <small>
            {euros(min)} – {euros(max)}
          </small>
        )}
      </span>

      {sugerido !== null && (estado === 'sin-presupuesto' || estado === 'por-encima') && (
        <button
          type="button"
          className="boton boton--texto"
          onClick={() => onUsar(fila.categoriaId, sugerido)}
          title={`Fijar ${euros(sugerido)}, el punto medio del rango`}
        >
          Usar
        </button>
      )}
      {estado === 'en-rango' && <span className="pastilla pastilla--ok">en rango</span>}
      {estado === 'por-debajo' && min !== null && (
        <span className="pastilla pastilla--ok" title={`${euros(min - fila.presupuesto!)} por debajo del mínimo`}>
          por debajo ✓
        </span>
      )}
      {estado === 'por-encima' && <span className="pastilla pastilla--aviso">por encima</span>}

      {mediaEspana !== null && (
        <small className="recomendacion__media">Media España: {mediaEspana} % del gasto</small>
      )}

      {ingresoBase.origen === 'sin-datos' && <small className="texto-apagado">sin ingresos registrados</small>}
    </div>
  );
}

export function PaginaPresupuestos() {
  const { avisar } = useAvisos();
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);

  const datos = useRecurso(() => apiPresupuestos.listar(anio, mes), [anio, mes]);

  const guardar = async (categoriaId: number, importe: number) => {
    try {
      await apiPresupuestos.guardar({ categoriaId, anio, mes, importe });
      avisar(importe === 0 ? 'Presupuesto eliminado' : 'Presupuesto guardado');
      datos.recargar();
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido guardar', 'error');
    }
  };

  const copiar = async () => {
    try {
      const resultado = await apiPresupuestos.copiarMesAnterior(anio, mes);
      avisar(
        resultado.copiados > 0
          ? `${resultado.copiados} presupuesto(s) copiados del mes anterior`
          : 'No había presupuestos que copiar del mes anterior',
        resultado.copiados > 0 ? 'exito' : 'info'
      );
      datos.recargar();
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido copiar', 'error');
    }
  };

  const totales = datos.datos?.totales;

  return (
    <>
      <header className="cabecera-pagina">
        <div>
          <h1>Presupuestos</h1>
          <p className="texto-apagado">
            Fija un tope de gasto por categoría y mes. Escribe el importe en la casilla y se guarda solo.
          </p>
        </div>
        <div className="cabecera-pagina__acciones">
          {datos.datos && datos.datos.ingresoBase.importe > 0 && (
            <span className={`pastilla-perfil pastilla-perfil--${datos.datos.perfil.clave}`}>
              Perfil: {datos.datos.perfil.etiqueta}
            </span>
          )}
          <SelectorPeriodo anio={anio} mes={mes} onCambiar={(a, m) => { setAnio(a); setMes(m); }} />
          <button type="button" className="boton boton--secundario" onClick={copiar}>
            Copiar del mes anterior
          </button>
        </div>
      </header>

      {totales && (
        <section className="rejilla-indicadores">
          <div className="indicador">
            <span className="indicador__titulo">Presupuestado</span>
            <strong className="indicador__valor">{euros(totales.presupuestado)}</strong>
            <span className="indicador__detalle">{nombreMes(mes)} {anio}</span>
          </div>
          <div className="indicador indicador--gasto">
            <span className="indicador__titulo">Gastado</span>
            <strong className="indicador__valor">{euros(totales.gastado)}</strong>
          </div>
          <div className={`indicador indicador--${totales.restante >= 0 ? 'ingreso' : 'gasto'}`}>
            <span className="indicador__titulo">{totales.restante >= 0 ? 'Te queda' : 'Te has pasado'}</span>
            <strong className="indicador__valor">{euros(Math.abs(totales.restante))}</strong>
          </div>
          <div className={`indicador indicador--${totales.categoriasExcedidas > 0 ? 'gasto' : 'acento'}`}>
            <span className="indicador__titulo">Categorías superadas</span>
            <strong className="indicador__valor">{totales.categoriasExcedidas}</strong>
          </div>
        </section>
      )}

      <section className="tarjeta">
        {datos.cargando && <Cargando />}
        {datos.error && <ErrorCarga mensaje={datos.error} onReintentar={datos.recargar} />}

        {datos.datos && datos.datos.presupuestos.length === 0 && (
          <Vacio
            titulo="No hay categorías de gasto"
            texto="Crea alguna categoría de gasto para poder presupuestarla."
          />
        )}

        {datos.datos && datos.datos.presupuestos.length > 0 && (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--presupuestos">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th style={{ width: '10rem' }}>Presupuesto</th>
                  <th className="a-derecha">Gastado</th>
                  <th className="a-derecha">Restante</th>
                  <th style={{ width: '13rem' }}>Consumo</th>
                  <th style={{ width: '15rem' }}>Recomendado</th>
                </tr>
              </thead>
              <tbody>
                {datos.datos.presupuestos.map((fila) => (
                  <tr key={fila.categoriaId} className={fila.estado === 'excedido' ? 'es-excedida' : ''}>
                    <td>
                      <span className="punto-color" style={{ backgroundColor: fila.categoriaColor }} />
                      {fila.categoriaNombre}
                      {fila.archivada && <span className="pastilla">archivada</span>}
                    </td>
                    <td>
                      <CeldaPresupuesto fila={fila} onGuardar={guardar} />
                    </td>
                    <td className="a-derecha importe">{euros(fila.gastado)}</td>
                    <td className={`a-derecha importe ${fila.restante !== null && fila.restante < 0 ? 'es-gasto' : ''}`}>
                      {fila.restante === null ? '—' : euros(fila.restante)}
                    </td>
                    <td>
                      <BarraConsumo fila={fila} />
                    </td>
                    <td>
                      <Recomendacion fila={fila} ingresoBase={datos.datos!.ingresoBase} onUsar={guardar} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="nota">
          Deja la casilla vacía (o escribe 0) para quitar el presupuesto de esa categoría. Los presupuestos son
          independientes mes a mes: usa <strong>Copiar del mes anterior</strong> para no reescribirlos cada vez.
        </p>

        {datos.datos && (
          <p className="nota">
            <strong>Recomendado</strong> es un rango orientativo sobre lo que ingresas en un mes normal
            {datos.datos.ingresoBase.origen === 'mediana' && ' (mediana de tus meses cerrados, que ignora las pagas extra)'}
            {datos.datos.ingresoBase.origen === 'fijos' && ' (tus ingresos fijos declarados)'}
            {datos.datos.ingresoBase.origen === 'sin-datos'
              ? '. Registra tu nómina en Gastos fijos para ver los importes.'
              : `: ${euros(datos.datos.ingresoBase.importe)}.`}{' '}
            {datos.datos.ingresoBase.extrasAlAnio > 0 && (
              <>
                Tus {datos.datos.ingresoBase.pagasAlAnio - 12} pagas extra ({euros(datos.datos.ingresoBase.extrasAlAnio)} al
                año) quedan fuera de este presupuesto a propósito: repartirlas entre los doce meses te haría gastar de
                más. Neto anual: {euros(datos.datos.ingresoBase.anual)}.{' '}
              </>
            )}
            {datos.datos.perfil.clave === 'renta-ajustada' && (
              <>
                Se está aplicando el perfil <strong>ajustado a tu renta</strong>: por debajo de 1.800 € al mes los
                gastos incomprimibles (vivienda, comida, transporte) pesan más y el 50/30/20 clásico produce un plan
                que no se puede cumplir.{' '}
              </>
            )}
            Los máximos no suman 100 % a propósito: son topes por partida, no un reparto. «Media España» es el peso
            real de esa partida en el gasto de un hogar según la {datos.datos.fuenteReferencias}, calculado sobre el
            gasto total y no sobre los ingresos. Son referencias generales, no asesoramiento financiero.
          </p>
        )}
      </section>
    </>
  );
}
