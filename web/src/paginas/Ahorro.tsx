import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ErrorApi } from '../api/cliente';
import { ajustes as apiAjustes, resumen as apiResumen } from '../api/recursos';
import { Campo } from '../componentes/Campos';
import { Metas } from '../componentes/Metas';
import { Cargando, ErrorCarga } from '../componentes/Estados';
import { Modal } from '../componentes/Modal';
import { useAvisos } from '../hooks/useAvisos';
import { useRecurso } from '../hooks/useRecurso';
import type { Ajustes, Consejo, SaludFinanciera, TramoReparto } from '../tipos';
import { aNumero, euros, numero, porcentaje } from '../utiles/formato';

const ETIQUETA_PRIORIDAD: Record<Consejo['prioridad'], string> = {
  alta: 'Prioritario',
  media: 'A mejorar',
  info: 'Para saber',
};

/** Barra de progreso del fondo de emergencia. */
function BarraFondo({ progreso }: { progreso: number | null }) {
  const valor = progreso ?? 0;
  const estado = valor >= 100 ? 'ok' : valor >= 50 ? 'riesgo' : 'excedido';

  return (
    <div className="barra-consumo">
      <div className={`barra-consumo__pista barra-consumo__pista--${estado}`}>
        <span style={{ width: `${Math.min(valor, 100)}%` }} />
      </div>
      <small>{porcentaje(progreso, 0)}</small>
    </div>
  );
}

/** Una fila de la regla 50/30/20: lo tuyo frente a la referencia. */
function FilaReparto({ nombre, tramo, explicacion }: { nombre: string; tramo: TramoReparto; explicacion: string }) {
  const desviacion = tramo.porcentaje === null ? null : Math.round((tramo.porcentaje - tramo.referencia) * 10) / 10;
  const esAhorro = nombre === 'Ahorro';
  // En ahorro, pasarse es bueno; en gasto, es lo contrario.
  const favorable = desviacion === null ? true : esAhorro ? desviacion >= 0 : desviacion <= 0;

  return (
    <tr>
      <td>
        <strong>{nombre}</strong>
        <br />
        <small className="texto-apagado">{explicacion}</small>
      </td>
      <td className="a-derecha importe">{euros(tramo.euros)}</td>
      <td className="a-derecha importe">{porcentaje(tramo.porcentaje, 0)}</td>
      <td className="a-derecha texto-apagado">{tramo.referencia} %</td>
      <td className={`a-derecha importe ${favorable ? 'es-ingreso' : 'es-gasto'}`}>
        {desviacion === null ? '—' : `${desviacion > 0 ? '+' : ''}${desviacion} pts`}
      </td>
    </tr>
  );
}

function FormularioAjustes({
  valores, onGuardado, onCancelar,
}: {
  valores: Ajustes;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const { avisar } = useAvisos();
  const [objetivo, setObjetivo] = useState(String(valores.objetivoAhorro));
  const [meses, setMeses] = useState(String(valores.mesesFondoEmergencia));
  const [colchon, setColchon] = useState(String(valores.colchonActual).replace('.', ','));
  const [pagas, setPagas] = useState(String(valores.pagasAlAnio));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();

    const objetivoAhorro = aNumero(objetivo);
    const mesesFondoEmergencia = Number(meses);
    const colchonActual = aNumero(colchon) ?? 0;
    const pagasAlAnio = Number(pagas);
    const nuevos: Record<string, string> = {};

    if (!Number.isInteger(pagasAlAnio) || pagasAlAnio < 12 || pagasAlAnio > 16) {
      nuevos.pagas = 'Lo habitual en España es 12 o 14';
    }

    if (objetivoAhorro === null || objetivoAhorro < 0 || objetivoAhorro > 90) {
      nuevos.objetivo = 'Escribe un porcentaje entre 0 y 90';
    }
    if (!Number.isInteger(mesesFondoEmergencia) || mesesFondoEmergencia < 1 || mesesFondoEmergencia > 24) {
      nuevos.meses = 'Entre 1 y 24 meses';
    }
    if (colchonActual < 0) nuevos.colchon = 'No puede ser negativo';

    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setGuardando(true);
    try {
      await apiAjustes.guardar({
        objetivoAhorro: objetivoAhorro as number,
        mesesFondoEmergencia,
        colchonActual,
        pagasAlAnio,
      });
      avisar('Objetivos actualizados');
      onGuardado();
    } catch (e) {
      setErrores({ general: e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido guardar' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      {errores.general && <div className="alerta alerta--error">{errores.general}</div>}

      <Campo
        etiqueta="¿Qué porcentaje de tus ingresos quieres ahorrar?"
        error={errores.objetivo}
        ayuda="La referencia habitual es el 20 % (regla 50/30/20). La media española está en el 12 %."
        htmlFor="ajuste-objetivo"
      >
        <input id="ajuste-objetivo" type="number" min={0} max={90} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
      </Campo>

      <Campo
        etiqueta="¿En cuántas pagas cobras al año?"
        error={errores.pagas}
        ayuda="12 o 14. Con 14, las dos extras se presupuestan aparte y no inflan tu mes normal."
        htmlFor="ajuste-pagas"
      >
        <select id="ajuste-pagas" value={pagas} onChange={(e) => setPagas(e.target.value)}>
          <option value="12">12 pagas</option>
          <option value="14">14 pagas (dos extras)</option>
          <option value="15">15 pagas</option>
          <option value="16">16 pagas</option>
        </select>
      </Campo>

      <Campo
        etiqueta="¿Cuántos meses de gastos quieres tener cubiertos ante imprevistos?"
        error={errores.meses}
        ayuda="Lo habitual es entre 3 y 6 meses. Si tus ingresos son irregulares, mejor tirar por lo alto."
        htmlFor="ajuste-meses"
      >
        <input id="ajuste-meses" type="number" min={1} max={24} value={meses} onChange={(e) => setMeses(e.target.value)} />
      </Campo>

      <Campo
        etiqueta="¿Cuánto tienes ya apartado para imprevistos? (€)"
        error={errores.colchon}
        ayuda="La aplicación no lee tus cuentas bancarias, así que este dato lo pones tú."
        htmlFor="ajuste-colchon"
      >
        <input
          id="ajuste-colchon"
          type="text"
          inputMode="decimal"
          value={colchon}
          onChange={(e) => setColchon(e.target.value)}
          placeholder="3000"
        />
      </Campo>

      <div className="acciones-formulario">
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar objetivos'}
        </button>
      </div>
    </form>
  );
}

export function PaginaAhorro() {
  const [editando, setEditando] = useState(false);
  const salud = useRecurso<SaludFinanciera>(() => apiResumen.salud(6), []);

  const datos = salud.datos;

  return (
    <>
      <header className="cabecera-pagina">
        <div>
          <h1>Plan de ahorro</h1>
          <p className="texto-apagado">
            Cuánto puedes ahorrar de verdad según tus propios números, y qué hacer primero.
          </p>
        </div>
        <button type="button" className="boton boton--secundario" onClick={() => setEditando(true)}>
          Ajustar objetivos
        </button>
      </header>

      {salud.cargando && <Cargando />}
      {salud.error && <ErrorCarga mensaje={salud.error} onReintentar={salud.recargar} />}

      {datos && (
        <>
          <section className="rejilla-indicadores">
            <div className={`indicador indicador--${datos.objetivo.cumplido ? 'ingreso' : 'acento'}`}>
              <span className="indicador__titulo">Ahorras cada mes</span>
              <strong className="indicador__valor">{euros(datos.ahorroMensual)}</strong>
              <span className="indicador__detalle">
                {datos.medias ? `Media de ${datos.medias.meses} ${datos.medias.meses === 1 ? 'mes' : 'meses'} cerrados` : 'Sin meses completos aún'}
              </span>
            </div>

            <div className="indicador indicador--acento">
              <span className="indicador__titulo">Tu tasa de ahorro</span>
              <strong className="indicador__valor">{porcentaje(datos.tasaAhorro)}</strong>
              <span className="indicador__detalle">
                Tu objetivo: {datos.objetivo.porcentaje} % · Media España: {datos.referencias.tasaAhorroMediaEspana} %
              </span>
            </div>

            <div className={`indicador indicador--${datos.objetivo.cumplido ? 'ingreso' : 'gasto'}`}>
              <span className="indicador__titulo">{datos.objetivo.cumplido ? 'Objetivo cumplido' : 'Te falta al mes'}</span>
              <strong className="indicador__valor">
                {datos.objetivo.cumplido ? euros(datos.objetivo.euros) : euros(datos.objetivo.diferenciaEuros)}
              </strong>
              <span className="indicador__detalle">
                {datos.objetivo.cumplido ? 'Es tu meta mensual, y la superas' : `Para llegar a tu ${datos.objetivo.porcentaje} %`}
              </span>
            </div>

            <div className="indicador">
              <span className="indicador__titulo">Colchón de imprevistos</span>
              <strong className="indicador__valor">
                {datos.fondoEmergencia.mesesCubiertos === null ? '—' : `${numero(datos.fondoEmergencia.mesesCubiertos, 1)} meses`}
              </strong>
              <span className="indicador__detalle">Objetivo: {datos.fondoEmergencia.mesesObjetivo} meses de gastos</span>
            </div>
          </section>

          <section className="tarjeta">
            <h2 className="titulo-seccion">
              Mes en curso · día {datos.mesEnCurso.diasTranscurridos} de {datos.mesEnCurso.diasDelMes}
            </h2>
            <p className="texto-apagado">
              Esto se actualiza en cuanto apuntas un movimiento. Las medias de más abajo solo miran meses cerrados,
              para que un mes a medias no las distorsione.
            </p>

            <div className="rejilla-ahorro">
              <ul className="lista-datos">
                <li><span>Ingresos</span><strong>{euros(datos.mesEnCurso.ingresos)}</strong></li>
                <li><span>Gastos fijos</span><strong>{euros(datos.mesEnCurso.gastosFijos)}</strong></li>
                <li>
                  <span>Gastos variables ({datos.mesEnCurso.movimientosVariables} movimientos)</span>
                  <strong>{euros(datos.mesEnCurso.gastosVariables)}</strong>
                </li>
                <li className="es-destacado">
                  <span>Llevas gastado</span>
                  <strong className="es-gasto">{euros(datos.mesEnCurso.gastos)}</strong>
                </li>
                {datos.mesEnCurso.proyectable && (
                  <li>
                    <span>Previsión a fin de mes</span>
                    <strong className="es-acento">{euros(datos.mesEnCurso.gastoProyectado)}</strong>
                  </li>
                )}
              </ul>

              <div>
                <p className="texto-apagado">
                  {datos.referenciaGasto.origen === 'meses-cerrados' && (
                    <>
                      El plan de abajo usa tu <strong>gasto medio de meses cerrados</strong>:{' '}
                      {euros(datos.referenciaGasto.importe)} al mes. Es la cifra fiable.
                    </>
                  )}
                  {datos.referenciaGasto.origen === 'mes-en-curso' && (
                    <>
                      Todavía no tienes ningún mes cerrado con gasto variable, así que el plan usa la{' '}
                      <strong>previsión de este mes</strong> ({euros(datos.referenciaGasto.importe)}). Se afina con
                      cada movimiento que apuntas, y cuando cierre el mes pasará a calcularse sobre datos reales.
                    </>
                  )}
                  {datos.referenciaGasto.origen === 'solo-fijos' && (
                    <>
                      El plan solo conoce tus <strong>gastos fijos</strong> ({euros(datos.referenciaGasto.importe)}),
                      así que va optimista. Apunta unos días de compras y ocio y empezará a ajustarse solo.
                    </>
                  )}
                </p>

                {datos.mesEnCurso.proyectable && !datos.referenciaGasto.provisional && (
                  <p className="texto-apagado">
                    La previsión extrapola solo el gasto variable: los fijos ya se conocen enteros desde el día 1.
                  </p>
                )}
              </div>
            </div>
          </section>

          {datos.extras && (
            <section className="tarjeta">
              <h2 className="titulo-seccion">Tus {datos.extras.pagas} pagas extra</h2>
              <div className="rejilla-ahorro">
                <ul className="lista-datos">
                  <li><span>Cobras un mes normal</span><strong>{euros(datos.extras.mensualRecurrente)}</strong></li>
                  <li><span>Extras al año</span><strong>{euros(datos.extras.importeAnual)}</strong></li>
                  <li><span>Neto anual</span><strong>{euros(datos.extras.netoAnual)}</strong></li>
                  <li className="es-destacado">
                    <span>Tasa de ahorro anual si las ahorras enteras</span>
                    <strong className="es-acento">{porcentaje(datos.extras.tasaAnualSiSeAhorran)}</strong>
                  </li>
                </ul>
                <p className="texto-apagado">
                  Los presupuestos se calculan sobre lo que entra un <strong>mes normal</strong>, no sobre la media
                  anual. Si repartieras las extras entre los doce meses acabarías gastando de más diez meses al año
                  para luego cuadrarlo en dos. Trátalas como lo que son: dinero que ya está fuera del presupuesto
                  corriente y puede ir entero al colchón de imprevistos.
                </p>
              </div>
            </section>
          )}

          <section className="tarjeta">
            <h2 className="titulo-seccion">Qué hacer ahora</h2>
            <ul className="lista-consejos">
              {datos.consejos.map((consejo) => (
                <li key={consejo.clave} className={`consejo consejo--${consejo.prioridad}`}>
                  <span className="consejo__etiqueta">{ETIQUETA_PRIORIDAD[consejo.prioridad]}</span>
                  <div>
                    <strong>{consejo.titulo}</strong>
                    <p>{consejo.detalle}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="nota">
              Estas recomendaciones son referencias generales de planificación financiera calculadas sobre tus
              datos. No son asesoramiento financiero personalizado.
            </p>
          </section>

          <Metas metas={datos.metas} onCambio={salud.recargar} />

          <div className="rejilla-dos">
            <section className="tarjeta">
              <h2 className="titulo-seccion">Fondo de emergencia</h2>
              <p className="texto-apagado">
                Dinero disponible para cubrir un imprevisto (una avería, quedarte sin ingresos) sin recurrir a
                deuda. Se mide en meses de tus gastos, no en una cifra redonda.
              </p>

              <BarraFondo progreso={datos.fondoEmergencia.progreso} />

              <ul className="lista-datos">
                <li><span>Tu gasto medio mensual</span><strong>{euros(datos.fondoEmergencia.gastoMensualReferencia)}</strong></li>
                <li><span>Objetivo ({datos.fondoEmergencia.mesesObjetivo} meses)</span><strong>{euros(datos.fondoEmergencia.objetivo)}</strong></li>
                <li><span>Tienes apartado</span><strong>{euros(datos.fondoEmergencia.actual)}</strong></li>
                <li className="es-destacado">
                  <span>Te falta</span>
                  <strong className={datos.fondoEmergencia.restante > 0 ? 'es-gasto' : 'es-ingreso'}>
                    {euros(datos.fondoEmergencia.restante)}
                  </strong>
                </li>
                {datos.fondoEmergencia.mesesParaCompletarlo !== null && (
                  <li>
                    <span>A tu ritmo actual, lo completas en</span>
                    <strong className="es-acento">{datos.fondoEmergencia.mesesParaCompletarlo} meses</strong>
                  </li>
                )}
              </ul>
            </section>

            <section className="tarjeta">
              <h2 className="titulo-seccion">Tu reparto frente a la regla 50/30/20</h2>
              {datos.reparto ? (
                <>
                  <div className="tabla-envoltorio">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Bloque</th>
                          <th className="a-derecha">Al mes</th>
                          <th className="a-derecha">Tú</th>
                          <th className="a-derecha">Referencia</th>
                          <th className="a-derecha">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        <FilaReparto nombre="Necesidades" tramo={datos.reparto.necesidades} explicacion="Tus gastos fijos" />
                        <FilaReparto nombre="Deseos" tramo={datos.reparto.deseos} explicacion="Tus gastos variables" />
                        <FilaReparto nombre="Ahorro" tramo={datos.reparto.ahorro} explicacion="Lo que no gastas" />
                      </tbody>
                    </table>
                  </div>
                  <p className="nota">
                    La aplicación usa tus gastos fijos como «necesidades» y los variables como «deseos». Es una
                    aproximación: la compra del supermercado es una necesidad aunque varíe cada mes.
                  </p>
                </>
              ) : (
                <p className="texto-apagado">
                  Necesitas al menos un mes cerrado con movimientos. Empieza por{' '}
                  <Link to="/fijos">tus gastos fijos</Link>.
                </p>
              )}
            </section>
          </div>
        </>
      )}

      <Modal titulo="Ajustar objetivos" abierto={editando} onCerrar={() => setEditando(false)}>
        {datos && (
          <FormularioAjustes
            valores={datos.ajustes}
            onGuardado={() => { setEditando(false); salud.recargar(); }}
            onCancelar={() => setEditando(false)}
          />
        )}
      </Modal>
    </>
  );
}
