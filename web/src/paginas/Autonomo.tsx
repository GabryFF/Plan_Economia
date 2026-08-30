import { useState, type FormEvent } from 'react';
import { ErrorApi } from '../api/cliente';
import { ajustes as apiAjustes, autonomo as apiAutonomo, categorias as apiCategorias } from '../api/recursos';
import { Campo, SelectorTipo } from '../componentes/Campos';
import { GuiaFiscal } from '../componentes/GuiaFiscal';
import { Cargando, ErrorCarga } from '../componentes/Estados';
import { Modal } from '../componentes/Modal';
import { useAvisos } from '../hooks/useAvisos';
import { useRecurso } from '../hooks/useRecurso';
import type { PanelAutonomo, Tipo, TrimestreAutonomo } from '../tipos';
import { aNumero, euros, hoyISO } from '../utiles/formato';

/** Alta de factura con su desglose: base, IVA y retención. */
function FormularioFactura({
  tipoIvaDefecto, tipoIrpfDefecto, onGuardado, onCancelar,
}: {
  tipoIvaDefecto: number;
  tipoIrpfDefecto: number;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const { avisar } = useAvisos();
  const [tipo, setTipo] = useState<Tipo>('ingreso');
  const [fecha, setFecha] = useState(hoyISO());
  const [base, setBase] = useState('');
  const [tipoIva, setTipoIva] = useState(String(tipoIvaDefecto));
  const [tipoIrpf, setTipoIrpf] = useState(String(tipoIrpfDefecto));
  const [descripcion, setDescripcion] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [cliente, setCliente] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const categorias = useRecurso(() => apiCategorias.listar(), []);

  const importeBase = aNumero(base) ?? 0;
  const iva = Math.round(((importeBase * (aNumero(tipoIva) ?? 0)) / 100) * 100) / 100;
  const irpf = tipo === 'ingreso' ? Math.round(((importeBase * (aNumero(tipoIrpf) ?? 0)) / 100) * 100) / 100 : 0;
  const total = Math.round((importeBase + iva - irpf) * 100) / 100;

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (importeBase <= 0) {
      setError('Escribe la base imponible de la factura');
      return;
    }

    setGuardando(true);
    try {
      await apiAutonomo.registrarFactura({
        fecha,
        base: importeBase,
        tipoIva: aNumero(tipoIva) ?? 0,
        tipoIrpf: tipo === 'ingreso' ? aNumero(tipoIrpf) ?? 0 : 0,
        descripcion: descripcion.trim(),
        tipo,
        categoriaId: categoriaId ? Number(categoriaId) : null,
        cliente: cliente.trim() || null,
      });
      avisar('Factura registrada');
      onGuardado();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido registrar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      {error && <div className="alerta alerta--error">{error}</div>}

      <Campo etiqueta="¿Factura emitida o gasto de la actividad?">
        <SelectorTipo valor={tipo} onCambiar={setTipo} />
      </Campo>

      <div className="rejilla-formulario">
        <Campo etiqueta="Fecha" htmlFor="fac-fecha">
          <input id="fac-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>

        <Campo etiqueta="Base imponible (€)" ayuda="Sin IVA" htmlFor="fac-base">
          <input
            id="fac-base"
            type="text"
            inputMode="decimal"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder="1000"
            autoFocus
          />
        </Campo>
      </div>

      <div className="rejilla-formulario">
        <Campo etiqueta="IVA (%)" htmlFor="fac-iva">
          <input id="fac-iva" type="text" inputMode="decimal" value={tipoIva} onChange={(e) => setTipoIva(e.target.value)} />
        </Campo>

        {tipo === 'ingreso' && (
          <Campo etiqueta="Retención IRPF (%)" ayuda="15 % general, 7 % los tres primeros años" htmlFor="fac-irpf">
            <input id="fac-irpf" type="text" inputMode="decimal" value={tipoIrpf} onChange={(e) => setTipoIrpf(e.target.value)} />
          </Campo>
        )}
      </div>

      {tipo === 'ingreso' && (
        <Campo
          etiqueta="Cliente"
          ayuda="Sirve para ver tu concentración de clientes y si encajas como TRADE."
          htmlFor="fac-cliente"
        >
          <input
            id="fac-cliente"
            type="text"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="Nombre del cliente"
            maxLength={80}
          />
        </Campo>
      )}

      <Campo etiqueta="Concepto" htmlFor="fac-desc">
        <input
          id="fac-desc"
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Factura 2026-014, cliente X"
          maxLength={200}
        />
      </Campo>

      <Campo etiqueta="Categoría" htmlFor="fac-cat">
        <select id="fac-cat" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">Sin categoría</option>
          {(categorias.datos ?? []).filter((c) => c.tipo === tipo && !c.archivada).map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </Campo>

      {importeBase > 0 && (
        <div className="alerta alerta--info">
          <div>
            Base {euros(importeBase)} + IVA {euros(iva)}
            {tipo === 'ingreso' && irpf > 0 && <> − IRPF {euros(irpf)}</>} ={' '}
            <strong>{euros(total)}</strong> {tipo === 'ingreso' ? 'que cobras' : 'que pagas'}.
            {tipo === 'ingreso' && iva > 0 && (
              <>
                {' '}De ahí, <strong>{euros(iva)} no son tuyos</strong>: son el IVA que le debes a Hacienda.
              </>
            )}
          </div>
        </div>
      )}

      <div className="acciones-formulario">
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Registrar factura'}
        </button>
      </div>
    </form>
  );
}

function Trimestre({ datos, titulo }: { datos: TrimestreAutonomo; titulo: string }) {
  return (
    <section className="tarjeta">
      <h2 className="titulo-seccion">
        {titulo} · {datos.trimestre}T {datos.anio}
      </h2>
      <p className="texto-apagado">
        {datos.calendario.periodo} · se presenta {datos.calendario.presentacion} · {datos.facturas} factura(s)
      </p>

      <div className="rejilla-ahorro">
        <div>
          <h3 className="titulo-menor">IVA (modelo 303)</h3>
          <ul className="lista-datos">
            <li><span>Repercutido (cobrado)</span><strong>{euros(datos.iva.repercutido)}</strong></li>
            <li><span>Soportado (pagado)</span><strong>{euros(datos.iva.soportado)}</strong></li>
            <li className="es-destacado">
              <span>{datos.iva.aCompensar > 0 ? 'A compensar' : 'A ingresar'}</span>
              <strong className={datos.iva.aCompensar > 0 ? 'es-ingreso' : 'es-gasto'}>
                {euros(datos.iva.aCompensar > 0 ? datos.iva.aCompensar : datos.iva.aIngresar)}
              </strong>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="titulo-menor">IRPF</h3>
          <ul className="lista-datos">
            <li><span>Rendimiento neto</span><strong>{euros(datos.rendimientoNeto)}</strong></li>
            <li><span>Ya retenido en factura</span><strong>{euros(datos.irpf.retenidoEnFactura)}</strong></li>
            <li className="es-destacado">
              <span>Pago fraccionado (modelo 130)</span>
              <strong className="es-gasto">{euros(datos.irpf.pagoFraccionadoEstimado)}</strong>
            </li>
          </ul>
          <p className="nota">{datos.irpf.nota}</p>
        </div>

        <div>
          <h3 className="titulo-menor">Lo que te queda</h3>
          <ul className="lista-datos">
            <li><span>Cuota de autónomos (trimestre)</span><strong>{euros(datos.cuotaAutonomos.trimestre)}</strong></li>
            <li className="es-destacado">
              <span>Provisión: no lo gastes</span>
              <strong className="es-gasto">{euros(datos.provision)}</strong>
            </li>
            <li className="es-destacado">
              <span>Tuyo de verdad</span>
              <strong className={datos.disponibleReal >= 0 ? 'es-ingreso' : 'es-gasto'}>
                {euros(datos.disponibleReal)}
              </strong>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function FormularioConfiguracion({ panel, onGuardado, onCancelar }: {
  panel: PanelAutonomo;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const { avisar } = useAvisos();
  const [cuota, setCuota] = useState(String(panel.configuracion.cuota).replace('.', ','));
  const [tipoIva, setTipoIva] = useState(String(panel.configuracion.tipoIva));
  const [tipoIrpf, setTipoIrpf] = useState(String(panel.configuracion.tipoIrpf));
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await apiAjustes.guardar({
        autonomoCuota: aNumero(cuota) ?? 0,
        autonomoTipoIva: aNumero(tipoIva) ?? 21,
        autonomoTipoIrpf: aNumero(tipoIrpf) ?? 15,
      });
      avisar('Configuración guardada');
      onGuardado();
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido guardar', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const ref = panel.configuracion.referencia;

  return (
    <>
      <Campo
        etiqueta="Tu cuota de autónomos (€/mes)"
        ayuda="La que te cobran realmente. La conoces exacta: mírala en el recibo."
        htmlFor="cfg-cuota"
      >
        <input id="cfg-cuota" type="text" inputMode="decimal" value={cuota} onChange={(e) => setCuota(e.target.value)} />
      </Campo>

      <div className="alerta alerta--info">
        <div>
          <strong>Referencia {ref.fechaConsulta}:</strong> tarifa plana de {euros(ref.tarifaPlana)}/mes los primeros{' '}
          {ref.tarifaPlanaMeses} meses ({ref.tarifaPlanaNota}). Fuera de la tarifa plana hay {ref.tramos} tramos según
          rendimientos netos; los seis primeros son la tabla reducida, hasta {euros(ref.tablaReducidaHasta)} al mes.
          <br />
          <br />
          {ref.aviso}
        </div>
      </div>

      <div className="rejilla-formulario">
        <Campo etiqueta="IVA habitual (%)" htmlFor="cfg-iva">
          <input id="cfg-iva" type="text" inputMode="decimal" value={tipoIva} onChange={(e) => setTipoIva(e.target.value)} />
        </Campo>
        <Campo etiqueta="Retención IRPF habitual (%)" ayuda="15 % general, 7 % los tres primeros años" htmlFor="cfg-irpf">
          <input id="cfg-irpf" type="text" inputMode="decimal" value={tipoIrpf} onChange={(e) => setTipoIrpf(e.target.value)} />
        </Campo>
      </div>

      <div className="acciones-formulario">
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>Cancelar</button>
        <button type="button" className="boton" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </>
  );
}

export function PaginaAutonomo() {
  const [facturando, setFacturando] = useState(false);
  const [configurando, setConfigurando] = useState(false);
  const panel = useRecurso<PanelAutonomo>(() => apiAutonomo.panel(), []);

  return (
    <>
      <header className="cabecera-pagina">
        <div>
          <h1>Autónomo</h1>
          <p className="texto-apagado">
            Tus facturas con IVA e IRPF, y cuánto tienes que apartar cada trimestre para Hacienda.
          </p>
        </div>
        <div className="cabecera-pagina__acciones">
          <button type="button" className="boton boton--secundario" onClick={() => setConfigurando(true)}>
            Configurar cuota y tipos
          </button>
          <button type="button" className="boton" onClick={() => setFacturando(true)}>+ Nueva factura</button>
        </div>
      </header>

      {panel.cargando && <Cargando />}
      {panel.error && <ErrorCarga mensaje={panel.error} onReintentar={panel.recargar} />}

      {panel.datos && (
        <>
          <div className="alerta alerta--aviso">
            <div>
              <strong>El IVA que cobras no es tuyo.</strong> Lo tienes en depósito para Hacienda y hay que devolverlo
              cada trimestre. Gastarlo y llegar al modelo 303 sin fondos es el error más común y más caro del oficio:
              por eso esta pantalla habla de <em>provisión</em> antes que de beneficio.
            </div>
          </div>

          {panel.datos.configuracion.cuota === 0 && (
            <div className="alerta alerta--info">
              <div>
                Aún no has indicado tu cuota de autónomos, así que no se está descontando del disponible.{' '}
                <button type="button" className="boton boton--texto" onClick={() => setConfigurando(true)}>
                  Configúrala
                </button>
              </div>
            </div>
          )}

          <section className="rejilla-indicadores">
            <div className="indicador indicador--gasto">
              <span className="indicador__titulo">Provisión de este trimestre</span>
              <strong className="indicador__valor">{euros(panel.datos.actual.provision)}</strong>
              <span className="indicador__detalle">IVA + pago fraccionado. Guárdalo.</span>
            </div>
            <div className="indicador indicador--ingreso">
              <span className="indicador__titulo">Tuyo de verdad</span>
              <strong className="indicador__valor">{euros(panel.datos.actual.disponibleReal)}</strong>
              <span className="indicador__detalle">Tras impuestos y cuota</span>
            </div>
            <div className="indicador">
              <span className="indicador__titulo">Cuota mensual</span>
              <strong className="indicador__valor">{euros(panel.datos.configuracion.cuota)}</strong>
            </div>
            <div className="indicador indicador--acento">
              <span className="indicador__titulo">Facturado (base)</span>
              <strong className="indicador__valor">{euros(panel.datos.actual.ingresos.base)}</strong>
              <span className="indicador__detalle">{panel.datos.actual.facturas} factura(s)</span>
            </div>
          </section>

          <Trimestre datos={panel.datos.actual} titulo="Trimestre en curso" />
          <Trimestre datos={panel.datos.anterior} titulo="Trimestre anterior" />

          <section className="tarjeta">
            <h2 className="titulo-seccion">Qué presentas y cuándo</h2>
            <div className="tabla-envoltorio">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Qué es</th>
                    <th>Quién lo presenta</th>
                  </tr>
                </thead>
                <tbody>
                  {panel.datos.modelos.map((m) => (
                    <tr key={m.modelo}>
                      <td><strong>{m.modelo}</strong></td>
                      <td>{m.que}</td>
                      <td>{m.quien}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="titulo-menor">Plazos trimestrales</h3>
            <ul className="lista-datos">
              {panel.datos.calendario.map((c) => (
                <li key={c.trimestre}>
                  <span>{c.trimestre}T — {c.periodo}</span>
                  <strong>{c.presentacion}</strong>
                </li>
              ))}
            </ul>

            <p className="nota">
              Esto es una previsión de tesorería sobre tus propios datos, no una liquidación. No presenta modelos ni
              sustituye a una gestoría: los cálculos reales dependen de tu situación completa (deducciones,
              amortizaciones, prorrata de IVA…).
            </p>
          </section>

          <GuiaFiscal guia={panel.datos.guia} clientes={panel.datos.clientes} anual={panel.datos.anual} />
        </>
      )}

      <Modal titulo="Nueva factura" abierto={facturando} onCerrar={() => setFacturando(false)}>
        {panel.datos && (
          <FormularioFactura
            tipoIvaDefecto={panel.datos.configuracion.tipoIva}
            tipoIrpfDefecto={panel.datos.configuracion.tipoIrpf}
            onGuardado={() => { setFacturando(false); panel.recargar(); }}
            onCancelar={() => setFacturando(false)}
          />
        )}
      </Modal>

      <Modal titulo="Configuración de autónomo" abierto={configurando} onCerrar={() => setConfigurando(false)}>
        {panel.datos && (
          <FormularioConfiguracion
            panel={panel.datos}
            onGuardado={() => { setConfigurando(false); panel.recargar(); }}
            onCancelar={() => setConfigurando(false)}
          />
        )}
      </Modal>
    </>
  );
}
