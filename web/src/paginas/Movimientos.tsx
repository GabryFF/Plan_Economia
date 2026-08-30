import { useState } from 'react';
import { ErrorApi } from '../api/cliente';
import { categorias as apiCategorias, movimientos as apiMovimientos } from '../api/recursos';
import { Cargando, ErrorCarga, Vacio } from '../componentes/Estados';
import { Confirmacion, Modal } from '../componentes/Modal';
import { FormularioMovimiento } from '../componentes/FormularioMovimiento';
import { useAvisos } from '../hooks/useAvisos';
import { useRecurso } from '../hooks/useRecurso';
import type { FiltrosMovimientos, Movimiento } from '../tipos';
import { euros, fechaLegible } from '../utiles/formato';

const FILTROS_INICIALES: FiltrosMovimientos = {
  desde: '', hasta: '', tipo: '', categoriaId: '', texto: '', pagina: 1, porPagina: 25,
};

export function PaginaMovimientos() {
  const { avisar } = useAvisos();
  const [filtros, setFiltros] = useState<FiltrosMovimientos>(FILTROS_INICIALES);
  // undefined = formulario cerrado; null = alta; objeto = edición.
  const [editando, setEditando] = useState<Movimiento | null | undefined>(undefined);
  const [borrando, setBorrando] = useState<Movimiento | null>(null);

  const listado = useRecurso(() => apiMovimientos.listar(filtros), [JSON.stringify(filtros)]);
  const categorias = useRecurso(() => apiCategorias.listar(), []);

  const cambiarFiltro = (cambios: Partial<FiltrosMovimientos>) =>
    setFiltros((actuales) => ({ ...actuales, ...cambios, pagina: cambios.pagina ?? 1 }));

  const cerrarFormulario = () => setEditando(undefined);

  const trasGuardar = (mensaje: string) => {
    cerrarFormulario();
    listado.recargar();
    avisar(mensaje);
  };

  const deshacerBorrado = async (movimiento: Movimiento) => {
    try {
      await apiMovimientos.restaurar(movimiento);
      avisar('Movimiento recuperado');
    } catch (error) {
      avisar(error instanceof ErrorApi ? error.textoCompleto : 'No se ha podido recuperar', 'error');
    } finally {
      listado.recargar();
    }
  };

  const confirmarBorrado = async () => {
    if (!borrando) return;
    const borrado = borrando;
    try {
      await apiMovimientos.borrar(borrado.id);
      // El aviso lleva «Deshacer»: equivocarse al borrar es fácil, y tener que
      // reescribir el movimiento de memoria es un castigo desproporcionado.
      avisar('Movimiento eliminado', 'exito', {
        texto: 'Deshacer',
        alPulsar: () => deshacerBorrado(borrado),
      });
      listado.recargar();
    } catch (error) {
      avisar(error instanceof ErrorApi ? error.textoCompleto : 'No se ha podido eliminar', 'error');
    } finally {
      setBorrando(null);
    }
  };

  const hayFiltros = Boolean(filtros.desde || filtros.hasta || filtros.tipo || filtros.categoriaId || filtros.texto);

  return (
    <>
      <header className="cabecera-pagina">
        <div>
          <h1>Movimientos</h1>
          <p className="texto-apagado">Todos tus ingresos y gastos, uno a uno.</p>
        </div>
        <button type="button" className="boton" onClick={() => setEditando(null)}>
          + Nuevo movimiento
        </button>
      </header>

      <section className="tarjeta filtros">
        <div className="filtros__campos">
          <label>
            Desde
            <input type="date" value={filtros.desde} onChange={(e) => cambiarFiltro({ desde: e.target.value })} />
          </label>
          <label>
            Hasta
            <input type="date" value={filtros.hasta} onChange={(e) => cambiarFiltro({ hasta: e.target.value })} />
          </label>
          <label>
            Tipo
            <select
              value={filtros.tipo}
              onChange={(e) => cambiarFiltro({ tipo: e.target.value as FiltrosMovimientos['tipo'] })}
            >
              <option value="">Todos</option>
              <option value="ingreso">Ingresos</option>
              <option value="gasto">Gastos</option>
            </select>
          </label>
          <label>
            Categoría
            <select
              value={filtros.categoriaId}
              onChange={(e) => cambiarFiltro({ categoriaId: e.target.value ? Number(e.target.value) : '' })}
            >
              <option value="">Todas</option>
              {(categorias.datos ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </label>
          <label className="filtros__busqueda">
            Buscar
            <input
              type="search"
              placeholder="Descripción o categoría…"
              value={filtros.texto}
              onChange={(e) => cambiarFiltro({ texto: e.target.value })}
            />
          </label>
          {hayFiltros && (
            <button type="button" className="boton boton--texto" onClick={() => setFiltros(FILTROS_INICIALES)}>
              Limpiar filtros
            </button>
          )}
        </div>

        {listado.datos && (
          <div className="filtros__totales">
            <span className="etiqueta-total es-ingreso">Ingresos {euros(listado.datos.totales.ingresos)}</span>
            <span className="etiqueta-total es-gasto">Gastos {euros(listado.datos.totales.gastos)}</span>
            <span className={`etiqueta-total ${listado.datos.totales.balance >= 0 ? 'es-ingreso' : 'es-gasto'}`}>
              Balance {euros(listado.datos.totales.balance)}
            </span>
          </div>
        )}
      </section>

      <section className="tarjeta">
        {listado.cargando && <Cargando />}
        {listado.error && <ErrorCarga mensaje={listado.error} onReintentar={listado.recargar} />}

        {listado.datos && listado.datos.movimientos.length === 0 && (
          <Vacio
            titulo={hayFiltros ? 'Ningún movimiento coincide con los filtros' : 'Aún no hay movimientos'}
            texto={
              hayFiltros
                ? 'Prueba a ampliar el rango de fechas o a limpiar los filtros.'
                : 'Empieza añadiendo tu primer ingreso o gasto.'
            }
            accion={
              !hayFiltros ? (
                <button type="button" className="boton" onClick={() => setEditando(null)}>
                  + Nuevo movimiento
                </button>
              ) : undefined
            }
          />
        )}

        {listado.datos && listado.datos.movimientos.length > 0 && (
          <>
            <div className="tabla-envoltorio">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th className="a-derecha">Importe</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {listado.datos.movimientos.map((m) => (
                    <tr key={m.id}>
                      <td className="celda-fecha">{fechaLegible(m.fecha)}</td>
                      <td>
                        {m.descripcion || <span className="texto-apagado">Sin descripción</span>}
                        {m.origen === 'recurrente' && <span className="pastilla pastilla--fijo">fijo</span>}
                        {m.origen === 'importacion' && <span className="pastilla">importado</span>}
                      </td>
                      <td>
                        {m.categoriaNombre ? (
                          <span
                            className="pastilla-categoria"
                            style={{
                              backgroundColor: `${m.categoriaColor}1f`,
                              color: m.categoriaColor ?? undefined,
                            }}
                          >
                            {m.categoriaNombre}
                          </span>
                        ) : (
                          <span className="texto-apagado">Sin categoría</span>
                        )}
                      </td>
                      <td className={`a-derecha importe ${m.tipo === 'ingreso' ? 'es-ingreso' : 'es-gasto'}`}>
                        {m.tipo === 'ingreso' ? '+' : '−'} {euros(m.importe)}
                      </td>
                      <td className="a-derecha celda-acciones">
                        <button type="button" className="boton boton--texto" onClick={() => setEditando(m)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="boton boton--texto boton--peligro-texto"
                          onClick={() => setBorrando(m)}
                        >
                          Borrar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {listado.datos.paginas > 1 && (
              <div className="paginacion">
                <button
                  type="button"
                  className="boton boton--secundario"
                  disabled={listado.datos.pagina <= 1}
                  onClick={() => cambiarFiltro({ pagina: (filtros.pagina ?? 1) - 1 })}
                >
                  ‹ Anterior
                </button>
                <span>
                  Página {listado.datos.pagina} de {listado.datos.paginas} · {listado.datos.total} movimientos
                </span>
                <button
                  type="button"
                  className="boton boton--secundario"
                  disabled={listado.datos.pagina >= listado.datos.paginas}
                  onClick={() => cambiarFiltro({ pagina: (filtros.pagina ?? 1) + 1 })}
                >
                  Siguiente ›
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <Modal
        titulo={editando ? 'Editar movimiento' : 'Nuevo movimiento'}
        abierto={editando !== undefined}
        onCerrar={cerrarFormulario}
      >
        <FormularioMovimiento
          categorias={categorias.datos ?? []}
          movimiento={editando}
          onGuardado={trasGuardar}
          onCancelar={cerrarFormulario}
        />
      </Modal>

      <Confirmacion
        abierto={borrando !== null}
        titulo="Borrar movimiento"
        mensaje={
          borrando && (
            <>
              <p>
                ¿Seguro que quieres borrar <strong>{borrando.descripcion || 'este movimiento'}</strong> de{' '}
                {euros(borrando.importe)} del {fechaLegible(borrando.fecha)}?
              </p>
              <p className="texto-apagado">
                Si te equivocas, podrás deshacerlo desde el aviso que aparece justo después.
              </p>
            </>
          )
        }
        textoConfirmar="Sí, borrar"
        onConfirmar={confirmarBorrado}
        onCancelar={() => setBorrando(null)}
      />
    </>
  );
}
