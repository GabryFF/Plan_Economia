import { useState } from 'react';
import { asistente as apiAsistente, resumen as apiResumen } from '../api/recursos';
import { AltaRapida } from '../componentes/AltaRapida';
import { Asistente } from '../componentes/Asistente';
import { Cargando, ErrorCarga, Vacio } from '../componentes/Estados';
import { GraficoDistribucion, GraficoEvolucion } from '../componentes/graficos';
import { useRecurso } from '../hooks/useRecurso';
import type { EstadoAsistente } from '../tipos';
import { euros, nombreMes, porcentaje, primerDiaDelMes, ultimoDiaDelMes } from '../utiles/formato';
import { Link, useSearchParams } from 'react-router-dom';

type Rango = 'mes' | 'anio' | 'todo';

const hoy = new Date();

function rangoAFechas(rango: Rango) {
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;

  if (rango === 'mes') return { desde: primerDiaDelMes(anio, mes), hasta: ultimoDiaDelMes(anio, mes) };
  if (rango === 'anio') return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
  return {};
}

const ETIQUETAS: Record<Rango, string> = {
  mes: `${nombreMes(hoy.getMonth() + 1)} ${hoy.getFullYear()}`,
  anio: `Año ${hoy.getFullYear()}`,
  todo: 'Todo el histórico',
};

/** Tarjeta de indicador con valor grande y contexto debajo. */
function Indicador({
  titulo, valor, detalle, tono = 'neutro',
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  tono?: 'neutro' | 'ingreso' | 'gasto' | 'acento';
}) {
  return (
    <div className={`indicador indicador--${tono}`}>
      <span className="indicador__titulo">{titulo}</span>
      <strong className="indicador__valor">{valor}</strong>
      {detalle && <span className="indicador__detalle">{detalle}</span>}
    </div>
  );
}

export function PaginaPanel() {
  const [rango, setRango] = useState<Rango>('mes');

  const resumen = useRecurso(() => apiResumen.general(rangoAFechas(rango)), [rango]);
  const evolucion = useRecurso(() => apiResumen.evolucion(12), []);
  const ahorro = useRecurso(() => apiResumen.ahorro(6), []);
  // Sirve para saber si la aplicación está recién estrenada, independientemente del rango elegido.
  const historico = useRecurso(() => apiResumen.general({}), []);
  const asistente = useRecurso<EstadoAsistente>(() => apiAsistente.estado(), []);

  const sinDatos = historico.datos?.movimientos === 0;

  // «?asistente=1» abre el asistente a mano. Con la aplicación vacía sale solo,
  // pero quien pulsó «Lo configuro yo» y luego se arrepintió no tenía forma de
  // recuperarlo, y volver a empezar borrando la base de datos no es una
  // respuesta razonable.
  const [parametros, setParametros] = useSearchParams();
  const pedidoAMano = parametros.get('asistente') === '1';

  const cerrarAsistente = () => {
    if (pedidoAMano) {
      parametros.delete('asistente');
      setParametros(parametros, { replace: true });
    }
  };

  const recargarTodo = () => {
    resumen.recargar();
    evolucion.recargar();
    ahorro.recargar();
    historico.recargar();
  };

  // El asistente sustituye a todo lo demás: es lo único que hay que hacer.
  if (asistente.datos && (asistente.datos.mostrar || pedidoAMano)) {
    return (
      <Asistente
        estado={asistente.datos}
        onTerminar={() => { cerrarAsistente(); asistente.recargar(); recargarTodo(); }}
      />
    );
  }

  return (
    <>
      <header className="cabecera-pagina">
        <div>
          <h1>Resumen</h1>
          <p className="texto-apagado">Cómo van tus finanzas de un vistazo.</p>
        </div>
        <div className="grupo-botones" role="group" aria-label="Periodo">
          {(['mes', 'anio', 'todo'] as Rango[]).map((opcion) => (
            <button
              key={opcion}
              type="button"
              className={`grupo-botones__opcion ${rango === opcion ? 'es-activo' : ''}`}
              onClick={() => setRango(opcion)}
            >
              {opcion === 'mes' ? 'Este mes' : opcion === 'anio' ? 'Este año' : 'Todo'}
            </button>
          ))}
        </div>
      </header>

      <AltaRapida onCreado={recargarTodo} />

      {resumen.cargando && <Cargando />}
      {resumen.error && <ErrorCarga mensaje={resumen.error} onReintentar={resumen.recargar} />}

      {sinDatos && (
        <section className="tarjeta">
          <Vacio
            titulo="Todavía no hay nada que resumir"
            texto="Añade tu primer movimiento o configura tus gastos fijos (nómina, alquiler, suscripciones) para empezar a ver datos aquí."
            accion={
              <div className="acciones-formulario">
                <Link className="boton" to="/movimientos">Añadir movimiento</Link>
                <Link className="boton boton--secundario" to="/fijos">Configurar gastos fijos</Link>
              </div>
            }
          />
        </section>
      )}

      {resumen.datos && !sinDatos && (
        <>
          <section className="rejilla-indicadores">
            <Indicador titulo={`Ingresos · ${ETIQUETAS[rango]}`} valor={euros(resumen.datos.ingresos)} tono="ingreso" />
            <Indicador titulo={`Gastos · ${ETIQUETAS[rango]}`} valor={euros(resumen.datos.gastos)} tono="gasto" />
            <Indicador
              titulo="Balance"
              valor={euros(resumen.datos.balance)}
              detalle={`${resumen.datos.movimientos} movimientos`}
              tono={resumen.datos.balance >= 0 ? 'ingreso' : 'gasto'}
            />
            <Indicador
              titulo="Tasa de ahorro"
              valor={porcentaje(resumen.datos.tasaAhorro)}
              detalle="Parte de tus ingresos que no gastas"
              tono="acento"
            />
          </section>

          {ahorro.datos && (
            <section className="tarjeta">
              <h2 className="titulo-seccion">Tu capacidad de ahorro</h2>
              <div className="rejilla-ahorro">
                <div>
                  <h3 className="titulo-menor">
                    {ahorro.datos.mediaMensual.meses > 0
                      ? `Media de los últimos ${ahorro.datos.mediaMensual.meses} meses`
                      : 'Media mensual (aún sin meses completos)'}
                  </h3>
                  <ul className="lista-datos">
                    <li><span>Ingresos</span><strong>{euros(ahorro.datos.mediaMensual.ingresos)}</strong></li>
                    <li><span>Gastos</span><strong>{euros(ahorro.datos.mediaMensual.gastos)}</strong></li>
                    <li className="es-destacado">
                      <span>Ahorro mensual</span>
                      <strong className={ahorro.datos.mediaMensual.ahorro >= 0 ? 'es-ingreso' : 'es-gasto'}>
                        {euros(ahorro.datos.mediaMensual.ahorro)}
                      </strong>
                    </li>
                    <li><span>Tasa de ahorro</span><strong>{porcentaje(ahorro.datos.mediaMensual.tasaAhorro)}</strong></li>
                    <li>
                      <span>A este ritmo, en un año</span>
                      <strong className="es-acento">{euros(ahorro.datos.proyeccionAnual)}</strong>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="titulo-menor">Compromisos fijos cada mes</h3>
                  <ul className="lista-datos">
                    <li><span>Ingresos fijos</span><strong>{euros(ahorro.datos.compromisosFijos.ingresosFijos)}</strong></li>
                    <li><span>Gastos fijos</span><strong>{euros(ahorro.datos.compromisosFijos.gastosFijos)}</strong></li>
                    <li className="es-destacado">
                      <span>Te queda libre</span>
                      <strong className={ahorro.datos.compromisosFijos.margenFijo >= 0 ? 'es-ingreso' : 'es-gasto'}>
                        {euros(ahorro.datos.compromisosFijos.margenFijo)}
                      </strong>
                    </li>
                    <li>
                      <span>Peso de los fijos sobre tus ingresos</span>
                      <strong>{porcentaje(ahorro.datos.compromisosFijos.pesoSobreIngresos)}</strong>
                    </li>
                  </ul>
                  {ahorro.datos.compromisosFijos.ingresosFijos === 0 && (
                    <p className="texto-apagado">
                      Configura tu nómina y tus gastos fijos en <Link to="/fijos">Gastos fijos</Link> para ver esta parte.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="titulo-menor">Dónde puedes recortar</h3>
                  {ahorro.datos.compromisosFijos.mayores.length === 0 ? (
                    <p className="texto-apagado">
                      Aún no has dado de alta gastos fijos. Son los que más margen dan: se pagan todos los meses.
                    </p>
                  ) : (
                    <ul className="lista-fijos">
                      {ahorro.datos.compromisosFijos.mayores.map((fijo) => (
                        <li key={fijo.nombre}>
                          <span className="punto-color" style={{ backgroundColor: fijo.color }} />
                          <span className="lista-fijos__nombre">{fijo.nombre}</span>
                          <span className="lista-fijos__importe">
                            {euros(fijo.importe)}
                            {fijo.porcentajeIngresosFijos !== null && (
                              <small> · {porcentaje(fijo.porcentajeIngresosFijos, 0)} de tus ingresos</small>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="tarjeta">
            <h2 className="titulo-seccion">Evolución de los últimos 12 meses</h2>
            {evolucion.cargando && <Cargando />}
            {evolucion.error && <ErrorCarga mensaje={evolucion.error} onReintentar={evolucion.recargar} />}
            {evolucion.datos && <GraficoEvolucion datos={evolucion.datos} />}
          </section>

          <div className="rejilla-dos">
            <section className="tarjeta">
              <h2 className="titulo-seccion">En qué se va el dinero</h2>
              <GraficoDistribucion datos={resumen.datos.gastosPorCategoria} />
            </section>

            <section className="tarjeta">
              <h2 className="titulo-seccion">De dónde viene el dinero</h2>
              <GraficoDistribucion datos={resumen.datos.ingresosPorCategoria} />
            </section>
          </div>

          <section className="tarjeta">
            <h2 className="titulo-seccion">Desglose por categoría · {ETIQUETAS[rango]}</h2>
            {resumen.datos.gastosPorCategoria.length === 0 && resumen.datos.ingresosPorCategoria.length === 0 ? (
              <Vacio titulo="No hay movimientos en este periodo" />
            ) : (
              <div className="tabla-envoltorio">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th>Tipo</th>
                      <th className="a-derecha">Movimientos</th>
                      <th className="a-derecha">Total</th>
                      <th className="a-derecha">% del tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ...resumen.datos.gastosPorCategoria.map((c) => ({ ...c, tipo: 'Gasto' as const })),
                      ...resumen.datos.ingresosPorCategoria.map((c) => ({ ...c, tipo: 'Ingreso' as const })),
                    ].map((c) => (
                      <tr key={`${c.tipo}-${c.categoriaId ?? 'sin'}`}>
                        <td>
                          <span className="punto-color" style={{ backgroundColor: c.color }} />
                          {c.nombre}
                        </td>
                        <td>{c.tipo}</td>
                        <td className="a-derecha">{c.movimientos}</td>
                        <td className={`a-derecha importe ${c.tipo === 'Ingreso' ? 'es-ingreso' : 'es-gasto'}`}>
                          {euros(c.total)}
                        </td>
                        <td className="a-derecha">
                          <div className="barra-mini" title={`${c.porcentaje} %`}>
                            <span style={{ width: `${Math.min(c.porcentaje, 100)}%`, backgroundColor: c.color }} />
                          </div>
                          {porcentaje(c.porcentaje, 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
