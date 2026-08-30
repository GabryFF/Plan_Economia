import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ErrorApi } from '../api/cliente';
import { ajustes as apiAjustes } from '../api/recursos';
import { Modal } from './Modal';
import { useAvisos } from '../hooks/useAvisos';
import { useRecurso } from '../hooks/useRecurso';
import { useAjustesCambiados } from '../utiles/eventos';
import type { Ajustes } from '../tipos';

/**
 * Secciones de la aplicación.
 *
 * Todas se ven siempre, salvo `soloAutonomo`, que aparece solo con el modo
 * activado porque a quien cobra una nómina no le dice nada.
 */
interface Seccion {
  ruta: string;
  clave: string;
  texto: string;
  icono: string;
  exacto?: boolean;
  /** Solo aparece con el modo autónomo activado. */
  soloAutonomo?: boolean;
}

const SECCIONES: Seccion[] = [
  { ruta: '/', clave: 'resumen', texto: 'Resumen', icono: '📊', exacto: true },
  { ruta: '/movimientos', clave: 'movimientos', texto: 'Movimientos', icono: '📝' },
  { ruta: '/cuentas', clave: 'cuentas', texto: 'Cuentas', icono: '🏦' },
  { ruta: '/fijos', clave: 'fijos', texto: 'Gastos fijos', icono: '🔁' },
  { ruta: '/ahorro', clave: 'ahorro', texto: 'Plan de ahorro', icono: '🐖' },
  { ruta: '/autonomo', clave: 'autonomo', texto: 'Autónomo', icono: '🧾', soloAutonomo: true },
  { ruta: '/presupuestos', clave: 'presupuestos', texto: 'Presupuestos', icono: '🎯' },
  { ruta: '/categorias', clave: 'categorias', texto: 'Categorías', icono: '🏷️' },
  { ruta: '/reglas', clave: 'reglas', texto: 'Reglas', icono: '🪄' },
  { ruta: '/datos', clave: 'datos', texto: 'Importar / Exportar', icono: '📁' },
];

/**
 * Ajustes de la aplicación.
 *
 * Son dos cosas: si eres autónomo —que estrena una sección entera— y volver a
 * abrir el asistente. No hay más porque no hace falta más.
 */
function PanelAjustes({
  ajustes, onCerrar, onGuardado,
}: {
  ajustes: Ajustes;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { avisar } = useAvisos();
  const [autonomo, setAutonomo] = useState(Boolean(ajustes.modoAutonomo));
  const [guardando, setGuardando] = useState(false);
  const navegar = useNavigate();

  const guardar = async () => {
    setGuardando(true);
    try {
      await apiAjustes.guardar({ modoAutonomo: autonomo ? 1 : 0 });
      avisar(autonomo ? 'Modo autónomo activado' : 'Ajustes guardados');
      onGuardado();
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido guardar', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <label className="interruptor">
        <input type="checkbox" checked={autonomo} onChange={(e) => setAutonomo(e.target.checked)} />
        <span aria-hidden="true">🧾</span> <strong>Soy autónomo</strong>
      </label>
      <p className="texto-apagado">
        Añade una sección para gestionar la cuota de autónomos, el IVA y el IRPF de tus facturas, y calcular cuánto
        tienes que apartar cada trimestre para Hacienda.
      </p>

      <hr className="separador" />

      <p className="texto-apagado">
        <strong>¿Empiezas de cero?</strong> El asistente pregunta cuatro cosas y deja la aplicación funcionando:
        lo que ingresas, lo que pagas cada mes y lo que tienes ahorrado.
      </p>
      <button
        type="button"
        className="boton boton--secundario"
        onClick={() => { onCerrar(); navegar('/?asistente=1'); }}
      >
        🧭 Abrir el asistente
      </button>

      <div className="acciones-formulario">
        <button type="button" className="boton boton--secundario" onClick={onCerrar}>Cancelar</button>
        <button type="button" className="boton" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </>
  );
}

export function Diseno() {
  const [configurando, setConfigurando] = useState(false);
  const ajustes = useRecurso<Ajustes>(() => apiAjustes.obtener(), []);

  // El asistente puede activar el modo autónomo: la barra tiene que enterarse
  // sin que el usuario recargue la página.
  useAjustesCambiados(ajustes.recargar);

  const esAutonomo = Boolean(ajustes.datos?.modoAutonomo);
  const visibles = SECCIONES.filter((s) => !s.soloAutonomo || esAutonomo);

  return (
    <div className="app">
      <aside className="lateral">
        <div className="lateral__marca">
          <span className="lateral__logo">💶</span>
          <div>
            <strong>Gestor de Gastos</strong>
            <small>Tus finanzas, en local</small>
          </div>
        </div>

        <nav className="lateral__nav">
          {visibles.map((seccion) => (
            <NavLink
              key={seccion.ruta}
              to={seccion.ruta}
              end={seccion.exacto}
              className={({ isActive }) => `lateral__enlace ${isActive ? 'es-activo' : ''}`}
            >
              <span aria-hidden="true">{seccion.icono}</span>
              {seccion.texto}
            </NavLink>
          ))}
        </nav>

        <button type="button" className="boton boton--secundario boton--secciones" onClick={() => setConfigurando(true)}>
          ⚙️ Ajustes
        </button>

        <footer className="lateral__pie">
          Los datos se guardan solo en este ordenador,
          <br />en el fichero <code>data/gastos.db</code>.
        </footer>
      </aside>

      <main className="contenido">
        <Outlet />
      </main>

      <Modal titulo="Ajustes" abierto={configurando} onCerrar={() => setConfigurando(false)}>
        {ajustes.datos && (
          <PanelAjustes
            ajustes={ajustes.datos}
            onCerrar={() => setConfigurando(false)}
            onGuardado={() => { setConfigurando(false); ajustes.recargar(); }}
          />
        )}
      </Modal>
    </div>
  );
}
