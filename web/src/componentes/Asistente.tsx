import { useState } from 'react';
import { ErrorApi } from '../api/cliente';
import { asistente as apiAsistente } from '../api/recursos';
import { Campo } from './Campos';
import { useAvisos } from '../hooks/useAvisos';
import type { EstadoAsistente } from '../tipos';
import { avisarAjustesCambiados } from '../utiles/eventos';
import { aNumero, euros } from '../utiles/formato';

/**
 * Asistente de primer arranque.
 *
 * Cuatro preguntas y la aplicación queda funcionando. Antes, quien la abría por
 * primera vez se encontraba un panel vacío y tenía que descubrir solo que lo
 * primero son los gastos fijos.
 *
 * Todo se puede saltar, y todo lo que crea es editable después.
 */

const PASOS = ['Cómo trabajas', 'Lo que ingresas', 'Gastos fijos', 'Lo que tienes'];

export function Asistente({ estado, onTerminar }: { estado: EstadoAsistente; onTerminar: () => void }) {
  const { avisar } = useAvisos();
  const [paso, setPaso] = useState(0);
  const [esAutonomo, setEsAutonomo] = useState(false);

  const [importe, setImporte] = useState('');
  const [diaCobro, setDiaCobro] = useState('25');
  const [pagas, setPagas] = useState('12');
  const [cuota, setCuota] = useState('');

  const [gastos, setGastos] = useState<Record<string, string>>({});
  const [colchon, setColchon] = useState('');
  const [cargarReglas, setCargarReglas] = useState(true);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalFijos = Object.values(gastos).reduce((suma, v) => suma + (aNumero(v) ?? 0), 0);
  const ingresoMensual = aNumero(importe) ?? 0;

  const terminar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const resultado = await apiAsistente.completar({
        esAutonomo,
        ingreso: ingresoMensual > 0
          ? { importe: ingresoMensual, diaDelMes: Number(diaCobro) || 25, pagasAlAnio: Number(pagas) || 12 }
          : null,
        gastosFijos: estado.gastosHabituales
          .filter((g) => (aNumero(gastos[g.clave]) ?? 0) > 0)
          .map((g) => ({ clave: g.clave, importe: aNumero(gastos[g.clave]) as number })),
        colchonActual: aNumero(colchon) ?? 0,
        cuotaAutonomos: esAutonomo ? aNumero(cuota) ?? 0 : 0,
        cargarReglas,
      });

      const partes = [];
      if (resultado.ingreso) partes.push('ingreso configurado');
      if (resultado.gastosFijos.length > 0) partes.push(`${resultado.gastosFijos.length} gastos fijos`);
      if (resultado.reglas > 0) partes.push(`${resultado.reglas} reglas`);

      avisar(`Todo listo: ${partes.join(', ') || 'puedes empezar'}`);
      // El modo autónomo estrena una sección en el menú: hay que avisar.
      avisarAjustesCambiados();
      onTerminar();
    } catch (e) {
      console.error('[asistente] fallo al completar', e);
      setError(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido guardar');
    } finally {
      setGuardando(false);
    }
  };

  const omitir = async () => {
    await apiAsistente.omitir();
    onTerminar();
  };

  return (
    <div className="asistente">
      <header className="asistente__cabecera">
        <div>
          <h2>Vamos a configurarlo en un minuto</h2>
          <p className="texto-apagado">
            Cuatro preguntas y la aplicación queda lista. Todo lo que respondas se puede cambiar después.
          </p>
        </div>
        <button type="button" className="boton boton--texto" onClick={omitir}>
          Lo configuro yo
        </button>
      </header>

      <ol className="asistente__pasos">
        {PASOS.map((nombre, indice) => (
          <li key={nombre} className={indice === paso ? 'es-activo' : indice < paso ? 'es-hecho' : ''}>
            <span className="asistente__numero">{indice < paso ? '✓' : indice + 1}</span>
            {nombre}
          </li>
        ))}
      </ol>

      {!estado.vacia && (
        <div className="alerta alerta--aviso">
          <div>
            <strong>Ya tienes datos en la aplicación.</strong> Lo que rellenes aquí se{' '}
            <strong>añadirá</strong> a lo que ya hay: no sustituye nada. Si vuelves a poner un gasto fijo que ya
            tenías, acabarás con los dos y tendrás que borrar uno en <strong>Gastos fijos</strong>.
          </div>
        </div>
      )}

      {error && <div className="alerta alerta--error">{error}</div>}

      <div className="asistente__cuerpo">
        {paso === 0 && (
          <>
            <h3>¿Cómo ganas tu dinero?</h3>
            <p className="texto-apagado">
              Sirve para saber qué necesitas: quien es autónomo tiene que apartar dinero para Hacienda cada
              trimestre, y eso es una sección aparte.
            </p>

            <div className="opciones-regla">
              <label className={`opcion-regla ${!esAutonomo ? 'es-activo' : ''}`}>
                <input type="radio" name="tipo-trabajo" checked={!esAutonomo} onChange={() => setEsAutonomo(false)} />
                <span>
                  <strong>Cobro una nómina</strong>
                  <small>Trabajo por cuenta ajena. Me ingresan lo mismo cada mes.</small>
                </span>
              </label>

              <label className={`opcion-regla ${esAutonomo ? 'es-activo' : ''}`}>
                <input type="radio" name="tipo-trabajo" checked={esAutonomo} onChange={() => setEsAutonomo(true)} />
                <span>
                  <strong>Soy autónomo</strong>
                  <small>Emito facturas con IVA e IRPF y pago cuota de autónomos.</small>
                </span>
              </label>
            </div>

            {esAutonomo && (
              <div className="alerta alerta--info">
                <div>
                  Se activará la sección <strong>Autónomo</strong>: facturas con IVA e IRPF, resumen trimestral y
                  cuánto tienes que apartar para Hacienda.
                </div>
              </div>
            )}
          </>
        )}

        {paso === 1 && (
          <>
            <h3>{esAutonomo ? '¿Cuánto ingresas al mes, más o menos?' : '¿Cuánto cobras al mes?'}</h3>
            <p className="texto-apagado">
              {esAutonomo
                ? 'Una media te vale. Luego podrás registrar cada factura con su desglose.'
                : 'El importe neto, el que te llega a la cuenta.'}
            </p>

            <div className="rejilla-formulario">
              <Campo etiqueta="Importe (€)" htmlFor="as-importe">
                <input
                  id="as-importe"
                  type="text"
                  inputMode="decimal"
                  value={importe}
                  onChange={(e) => setImporte(e.target.value)}
                  placeholder="1600"
                  autoFocus
                />
              </Campo>

              <Campo etiqueta="Día de cobro" htmlFor="as-dia">
                <input
                  id="as-dia"
                  type="number"
                  min={1}
                  max={31}
                  value={diaCobro}
                  onChange={(e) => setDiaCobro(e.target.value)}
                />
              </Campo>

              {!esAutonomo && (
                <Campo etiqueta="Pagas al año" ayuda="12 o 14" htmlFor="as-pagas">
                  <select id="as-pagas" value={pagas} onChange={(e) => setPagas(e.target.value)}>
                    <option value="12">12 pagas</option>
                    <option value="14">14 pagas (dos extras)</option>
                  </select>
                </Campo>
              )}
            </div>

            {esAutonomo && (
              <Campo
                etiqueta="Cuota de autónomos (€/mes)"
                ayuda="La que te cobran. Si acabas de empezar, la tarifa plana son 80 €."
                htmlFor="as-cuota"
              >
                <input
                  id="as-cuota"
                  type="text"
                  inputMode="decimal"
                  value={cuota}
                  onChange={(e) => setCuota(e.target.value)}
                  placeholder="300"
                />
              </Campo>
            )}

            {!esAutonomo && pagas === '14' && ingresoMensual > 0 && (
              <div className="alerta alerta--info">
                <div>
                  Con 14 pagas cobras <strong>{euros(ingresoMensual * 14)}</strong> al año. Los presupuestos se
                  calcularán sobre los {euros(ingresoMensual)} de un mes normal, y las dos extras se tratarán aparte
                  para que no te las gastes sin darte cuenta.
                </div>
              </div>
            )}
          </>
        )}

        {paso === 2 && (
          <>
            <h3>¿Qué pagas todos los meses?</h3>
            <p className="texto-apagado">
              Deja en blanco lo que no tengas. La aplicación los apuntará sola cada mes, sin que tengas que
              acordarte.
            </p>

            <div className="asistente__gastos">
              {estado.gastosHabituales.map((g) => (
                <Campo key={g.clave} etiqueta={g.nombre} htmlFor={`as-${g.clave}`}>
                  <input
                    id={`as-${g.clave}`}
                    type="text"
                    inputMode="decimal"
                    value={gastos[g.clave] ?? ''}
                    onChange={(e) => setGastos((v) => ({ ...v, [g.clave]: e.target.value }))}
                    placeholder="—"
                  />
                </Campo>
              ))}
            </div>

            {totalFijos > 0 && (
              <div className="alerta alerta--info">
                <div>
                  Son <strong>{euros(totalFijos)}</strong> al mes de gastos fijos
                  {ingresoMensual > 0 && (
                    <>
                      , un <strong>{Math.round((totalFijos / ingresoMensual) * 100)} %</strong> de lo que ingresas
                    </>
                  )}
                  .
                </div>
              </div>
            )}
          </>
        )}

        {paso === 3 && (
          <>
            <h3>¿Cuánto tienes ahorrado ahora mismo?</h3>
            <p className="texto-apagado">
              Para saber cuánto te falta para tu colchón de imprevistos. Si no tienes nada, déjalo en blanco: es un
              punto de partida, no un examen.
            </p>

            <Campo etiqueta="Ahorros (€)" htmlFor="as-colchon">
              <input
                id="as-colchon"
                type="text"
                inputMode="decimal"
                value={colchon}
                onChange={(e) => setColchon(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </Campo>

            <label className="interruptor">
              <input type="checkbox" checked={cargarReglas} onChange={(e) => setCargarReglas(e.target.checked)} />
              Cargar reglas para categorizar solo (Mercadona, Netflix, Repsol…)
            </label>
            <p className="texto-apagado">
              Recomendado: cuando importes el extracto del banco, la aplicación clasificará los movimientos sin que
              tengas que hacerlo a mano.
            </p>
          </>
        )}
      </div>

      <div className="acciones-formulario">
        {paso > 0 && (
          <button type="button" className="boton boton--secundario" onClick={() => setPaso(paso - 1)}>
            ← Atrás
          </button>
        )}

        {paso < PASOS.length - 1 ? (
          <button type="button" className="boton" onClick={() => setPaso(paso + 1)}>
            Siguiente →
          </button>
        ) : (
          <button type="button" className="boton" onClick={terminar} disabled={guardando}>
            {guardando ? 'Preparando…' : 'Empezar a usarla'}
          </button>
        )}
      </div>
    </div>
  );
}
