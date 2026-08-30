import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorApi } from '../api/cliente';
import { datos as apiDatos, reglas as apiReglas } from '../api/recursos';
import { Cargando } from '../componentes/Estados';
import { useAvisos } from '../hooks/useAvisos';
import type { AnalisisFichero, CoincidenciaRegla, FiltrosMovimientos } from '../tipos';
import { euros, fechaLegible } from '../utiles/formato';
import { prepararFilas, type Mapeo, type ReglaTipo } from '../utiles/importacion';

const CAMPOS_MAPEO = [
  { clave: 'fecha' as const, etiqueta: 'Fecha', obligatorio: true },
  { clave: 'importe' as const, etiqueta: 'Importe', obligatorio: true },
  { clave: 'descripcion' as const, etiqueta: 'Descripción', obligatorio: false },
  { clave: 'categoria' as const, etiqueta: 'Categoría', obligatorio: false },
];

const REGLAS: { valor: ReglaTipo; etiqueta: string; ayuda: string }[] = [
  { valor: 'signo', etiqueta: 'Por el signo del importe', ayuda: 'Los negativos son gastos y los positivos, ingresos.' },
  { valor: 'columna', etiqueta: 'Hay una columna que lo dice', ayuda: 'Se entienden valores como "Gasto"/"Ingreso", "Cargo"/"Abono".' },
  { valor: 'todo-gasto', etiqueta: 'Todo son gastos', ayuda: 'Útil si el fichero solo trae gastos.' },
  { valor: 'todo-ingreso', etiqueta: 'Todo son ingresos', ayuda: 'Útil si el fichero solo trae ingresos.' },
];

export function PaginaDatos() {
  const { avisar } = useAvisos();

  // --- Exportación ---
  const [filtrosExport, setFiltrosExport] = useState<FiltrosMovimientos>({ desde: '', hasta: '' });

  // --- Importación ---
  const [analisis, setAnalisis] = useState<AnalisisFichero | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [mapeo, setMapeo] = useState<Mapeo | null>(null);
  const [crearCategorias, setCrearCategorias] = useState(true);
  const [importando, setImportando] = useState(false);

  const elegirFichero = async (fichero: File | undefined) => {
    if (!fichero) return;
    setAnalizando(true);
    try {
      const resultado = await apiDatos.analizar(fichero);
      setAnalisis(resultado);
      setMapeo({
        fecha: resultado.sugerencia.fecha ?? '',
        importe: resultado.sugerencia.importe ?? '',
        descripcion: resultado.sugerencia.descripcion ?? '',
        categoria: resultado.sugerencia.categoria ?? '',
        tipo: resultado.sugerencia.tipo ?? '',
        reglaTipo: resultado.sugerencia.tipo ? 'columna' : 'signo',
      });
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido leer el fichero', 'error');
    } finally {
      setAnalizando(false);
    }
  };

  const preparadas = useMemo(
    () => (analisis && mapeo ? prepararFilas(analisis.filas, mapeo) : []),
    [analisis, mapeo]
  );

  // Las reglas se evalúan en el servidor: una sola implementación de la
  // coincidencia, la misma que se aplicará al guardar.
  const [sugerencias, setSugerencias] = useState<(CoincidenciaRegla | null)[]>([]);
  const [aplicarReglas, setAplicarReglas] = useState(true);

  // Clave estable del lote: evita repetir la petición mientras no cambien las filas.
  const clavePeticion = JSON.stringify(preparadas.map((f) => [f.tipo, f.descripcion]));

  useEffect(() => {
    const conTipo = preparadas.filter((f) => f.tipo !== null);
    if (!aplicarReglas || conTipo.length === 0) {
      setSugerencias([]);
      return;
    }

    let cancelado = false;
    apiReglas
      .sugerir(preparadas.map((f) => ({ descripcion: f.descripcion, tipo: f.tipo ?? 'gasto' })))
      .then((respuesta) => {
        if (!cancelado) setSugerencias(respuesta.sugerencias);
      })
      .catch(() => {
        if (!cancelado) setSugerencias([]);
      });

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clavePeticion, aplicarReglas]);

  /** Categoría final de una fila: la del fichero manda; si no hay, la de la regla. */
  const categoriaDe = (indice: number) => {
    const propia = preparadas[indice]?.categoria;
    if (propia) return { nombre: propia, porRegla: false, color: null as string | null };

    const sugerida = sugerencias[indice];
    return sugerida
      ? { nombre: sugerida.categoriaNombre, porRegla: true, color: sugerida.categoriaColor }
      : null;
  };

  const validas = preparadas.filter((f) => f.errores.length === 0);
  const invalidas = preparadas.filter((f) => f.errores.length > 0);
  const faltanObligatorios = mapeo ? !mapeo.fecha || !mapeo.importe : true;

  const categorizadasPorRegla = validas.filter(
    (fila) => !fila.categoria && sugerencias[fila.indice]
  ).length;

  const cancelarImportacion = () => {
    setAnalisis(null);
    setMapeo(null);
    setSugerencias([]);
  };

  const confirmar = async () => {
    if (validas.length === 0) return;
    setImportando(true);
    try {
      const resultado = await apiDatos.confirmar({
        crearCategorias,
        aplicarReglas,
        movimientos: validas.map((f) => ({
          fecha: f.fecha,
          importe: f.importe,
          descripcion: f.descripcion,
          tipo: f.tipo,
          categoria: f.categoria,
        })),
      });

      const partes = [`${resultado.importados} movimiento(s) importados`];
      if (resultado.categorizadosPorRegla > 0) {
        partes.push(`${resultado.categorizadosPorRegla} categorizados por reglas`);
      }
      if (resultado.categoriasCreadas.length > 0) {
        partes.push(`${resultado.categoriasCreadas.length} categoría(s) nuevas`);
      }
      if (resultado.sinCategoria.length > 0) {
        partes.push(`${resultado.sinCategoria.length} fila(s) quedaron sin categoría`);
      }
      avisar(partes.join(' · '));
      cancelarImportacion();
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido importar', 'error');
    } finally {
      setImportando(false);
    }
  };

  return (
    <>
      <header className="cabecera-pagina">
        <div>
          <h1>Importar y exportar</h1>
          <p className="texto-apagado">
            Saca tus datos a Excel para trabajarlos fuera, o trae movimientos desde el extracto de tu banco.
          </p>
        </div>
      </header>

      <section className="tarjeta">
        <h2 className="titulo-seccion">Exportar</h2>
        <p className="texto-apagado">
          Se exportan los movimientos del rango que elijas. Déjalo vacío para exportarlo todo.
        </p>

        <div className="filtros__campos">
          <label>
            Desde
            <input
              type="date"
              value={filtrosExport.desde}
              onChange={(e) => setFiltrosExport((f) => ({ ...f, desde: e.target.value }))}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={filtrosExport.hasta}
              onChange={(e) => setFiltrosExport((f) => ({ ...f, hasta: e.target.value }))}
            />
          </label>
        </div>

        <div className="acciones-formulario acciones-formulario--izquierda">
          <button type="button" className="boton" onClick={() => apiDatos.exportar(filtrosExport, 'xlsx')}>
            Descargar Excel (.xlsx)
          </button>
          <button
            type="button"
            className="boton boton--secundario"
            onClick={() => apiDatos.exportar(filtrosExport, 'csv')}
          >
            Descargar CSV
          </button>
        </div>
      </section>

      <section className="tarjeta">
        <h2 className="titulo-seccion">Copia de seguridad</h2>
        <p className="texto-apagado">
          Descarga un fichero con <strong>absolutamente todo</strong>: movimientos, cuentas, categorías, reglas,
          objetivos y ajustes. Guárdalo donde quieras (un USB, otra carpeta, la nube). Para restaurarlo, colócalo
          en la carpeta <code>data</code> con el nombre <code>gastos.db</code>.
        </p>

        <div className="acciones-formulario acciones-formulario--izquierda">
          <button
            type="button"
            className="boton"
            onClick={() => apiDatos.copiaSeguridad()}
          >
            Descargar copia de seguridad
          </button>
        </div>

        <p className="nota">
          Hazlo de vez en cuando, sobre todo antes de importar un fichero grande. Tus datos solo están en este
          ordenador: si se rompe el disco y no hay copia, no hay forma de recuperarlos.
        </p>
      </section>

      <section className="tarjeta">
        <h2 className="titulo-seccion">Importar</h2>

        {!analisis && (
          <>
            <ol className="pasos">
              <li>Elige un fichero <strong>.csv</strong>, <strong>.xlsx</strong> o <strong>.xls</strong>.</li>
              <li>Dinos qué columna es la fecha, cuál el importe, etc.</li>
              <li>Revisa la vista previa y confirma. Nada se guarda hasta ese momento.</li>
            </ol>

            <div className="acciones-formulario acciones-formulario--izquierda">
              <label className="boton">
                Elegir fichero…
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="entrada-fichero"
                  onChange={(e) => elegirFichero(e.target.files?.[0])}
                />
              </label>
              <button type="button" className="boton boton--secundario" onClick={() => apiDatos.plantilla()}>
                Descargar plantilla de ejemplo
              </button>
            </div>

            {analizando && <Cargando texto="Leyendo el fichero…" />}
          </>
        )}

        {analisis && mapeo && (
          <>
            <div className="alerta alerta--info">
              <strong>{analisis.nombreFichero}</strong> · hoja «{analisis.hoja}» · {analisis.totalFilas} filas
              <button type="button" className="boton boton--texto" onClick={cancelarImportacion}>
                Elegir otro fichero
              </button>
            </div>

            <h3 className="titulo-menor">1. Empareja las columnas</h3>
            <div className="rejilla-mapeo">
              {CAMPOS_MAPEO.map((campo) => (
                <label key={campo.clave}>
                  {campo.etiqueta}
                  {campo.obligatorio && <span className="obligatorio"> *</span>}
                  <select
                    value={mapeo[campo.clave]}
                    onChange={(e) => setMapeo({ ...mapeo, [campo.clave]: e.target.value })}
                  >
                    <option value="">— No usar —</option>
                    {analisis.columnas.map((columna) => (
                      <option key={columna} value={columna}>{columna}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <h3 className="titulo-menor">2. ¿Cómo distinguimos ingresos de gastos?</h3>
            <div className="opciones-regla">
              {REGLAS.map((regla) => (
                <label key={regla.valor} className={`opcion-regla ${mapeo.reglaTipo === regla.valor ? 'es-activo' : ''}`}>
                  <input
                    type="radio"
                    name="regla-tipo"
                    checked={mapeo.reglaTipo === regla.valor}
                    onChange={() => setMapeo({ ...mapeo, reglaTipo: regla.valor })}
                  />
                  <span>
                    <strong>{regla.etiqueta}</strong>
                    <small>{regla.ayuda}</small>
                  </span>
                </label>
              ))}
            </div>

            {mapeo.reglaTipo === 'columna' && (
              <label className="campo">
                Columna que indica el tipo
                <select value={mapeo.tipo} onChange={(e) => setMapeo({ ...mapeo, tipo: e.target.value })}>
                  <option value="">— Elige una columna —</option>
                  {analisis.columnas.map((columna) => (
                    <option key={columna} value={columna}>{columna}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="interruptor">
              <input
                type="checkbox"
                checked={crearCategorias}
                onChange={(e) => setCrearCategorias(e.target.checked)}
              />
              Crear automáticamente las categorías que no existan
            </label>

            <label className="interruptor">
              <input
                type="checkbox"
                checked={aplicarReglas}
                onChange={(e) => setAplicarReglas(e.target.checked)}
              />
              Categorizar automáticamente con mis <Link to="/reglas">reglas</Link>
            </label>

            <h3 className="titulo-menor">3. Vista previa</h3>

            {faltanObligatorios ? (
              <div className="alerta alerta--aviso">
                Elige al menos las columnas de <strong>fecha</strong> e <strong>importe</strong> para ver la vista previa.
              </div>
            ) : (
              <>
                <div className="resumen-importacion">
                  <span className="etiqueta-total es-ingreso">{validas.length} filas listas</span>
                  {categorizadasPorRegla > 0 && (
                    <span className="etiqueta-total es-acento">
                      {categorizadasPorRegla} categorizadas por reglas
                    </span>
                  )}
                  {invalidas.length > 0 && (
                    <span className="etiqueta-total es-gasto">{invalidas.length} filas con problemas (se omitirán)</span>
                  )}
                </div>

                <div className="tabla-envoltorio tabla-envoltorio--limitada">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Fecha</th>
                        <th>Descripción</th>
                        <th>Categoría</th>
                        <th>Tipo</th>
                        <th className="a-derecha">Importe</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preparadas.slice(0, 50).map((fila) => (
                        <tr key={fila.indice} className={fila.errores.length > 0 ? 'es-invalida' : ''}>
                          <td>{fila.indice + 1}</td>
                          <td className="celda-fecha">{fila.fecha ? fechaLegible(fila.fecha) : '—'}</td>
                          <td>{fila.descripcion || <span className="texto-apagado">—</span>}</td>
                          <td>
                            {(() => {
                              const categoria = categoriaDe(fila.indice);
                              if (!categoria) return <span className="texto-apagado">—</span>;

                              return (
                                <>
                                  <span
                                    className="pastilla-categoria"
                                    style={
                                      categoria.color
                                        ? { backgroundColor: `${categoria.color}1f`, color: categoria.color }
                                        : undefined
                                    }
                                  >
                                    {categoria.nombre}
                                  </span>
                                  {categoria.porRegla && <span className="pastilla pastilla--regla">regla</span>}
                                </>
                              );
                            })()}
                          </td>
                          <td>{fila.tipo === 'ingreso' ? 'Ingreso' : fila.tipo === 'gasto' ? 'Gasto' : '—'}</td>
                          <td className="a-derecha importe">{fila.importe !== null ? euros(fila.importe) : '—'}</td>
                          <td>
                            {fila.errores.length === 0 ? (
                              <span className="pastilla pastilla--ok">correcta</span>
                            ) : (
                              <span className="pastilla pastilla--error">{fila.errores.join('. ')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {preparadas.length > 50 && (
                  <p className="nota">Se muestran las primeras 50 filas de {preparadas.length}.</p>
                )}

                <div className="acciones-formulario">
                  <button type="button" className="boton boton--secundario" onClick={cancelarImportacion}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="boton"
                    onClick={confirmar}
                    disabled={importando || validas.length === 0}
                  >
                    {importando ? 'Importando…' : `Importar ${validas.length} movimiento(s)`}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}
