import { useState, type FormEvent } from 'react';
import { ErrorApi } from '../api/cliente';
import { categorias as apiCategorias, movimientos as apiMovimientos } from '../api/recursos';
import { useAvisos } from '../hooks/useAvisos';
import { useRecurso } from '../hooks/useRecurso';
import type { Tipo } from '../tipos';
import { aNumero, hoyISO } from '../utiles/formato';

/**
 * Alta rápida desde el Resumen.
 *
 * Apuntar un gasto es la acción más frecuente con diferencia —varias veces al
 * día— y exigía cuatro clics: ir a Movimientos, abrir el formulario, rellenar,
 * guardar. Aquí son dos campos y Enter. Cuanto más cuesta apuntar, menos se
 * apunta, y una aplicación de gastos sin gastos no sirve de nada.
 */
export function AltaRapida({ onCreado }: { onCreado: () => void }) {
  const { avisar } = useAvisos();
  const [tipo, setTipo] = useState<Tipo>('gasto');
  const [importe, setImporte] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);

  const categorias = useRecurso(() => apiCategorias.listar(), []);
  const disponibles = (categorias.datos ?? []).filter((c) => c.tipo === tipo && !c.archivada);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    const valor = aNumero(importe);

    if (valor === null || valor <= 0) {
      avisar('Escribe cuánto ha sido', 'error');
      return;
    }

    setGuardando(true);
    try {
      await apiMovimientos.crear({
        fecha: hoyISO(),
        importe: valor,
        descripcion: descripcion.trim(),
        tipo,
        categoriaId: categoriaId ? Number(categoriaId) : null,
      });

      // Se limpia el importe pero se conserva la categoría: quien apunta la
      // compra suele apuntar dos seguidas.
      setImporte('');
      setDescripcion('');
      avisar(tipo === 'gasto' ? 'Gasto apuntado' : 'Ingreso apuntado');
      onCreado();
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido guardar', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="tarjeta alta-rapida">
      <form onSubmit={enviar}>
        <div className="alta-rapida__campos">
          <div className="selector-tipo selector-tipo--compacto">
            <button
              type="button"
              className={`selector-tipo__opcion ${tipo === 'gasto' ? 'es-activo es-gasto' : ''}`}
              onClick={() => { setTipo('gasto'); setCategoriaId(''); }}
            >
              Gasto
            </button>
            <button
              type="button"
              className={`selector-tipo__opcion ${tipo === 'ingreso' ? 'es-activo es-ingreso' : ''}`}
              onClick={() => { setTipo('ingreso'); setCategoriaId(''); }}
            >
              Ingreso
            </button>
          </div>

          <label className="alta-rapida__importe">
            <span className="alta-rapida__etiqueta">¿Cuánto?</span>
            <input
              type="text"
              inputMode="decimal"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              placeholder="12,50"
              aria-label="Importe"
            />
          </label>

          <label>
            <span className="alta-rapida__etiqueta">¿En qué?</span>
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} aria-label="Categoría">
              <option value="">Sin categoría</option>
              {disponibles.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </label>

          <label className="alta-rapida__descripcion">
            <span className="alta-rapida__etiqueta">Nota (opcional)</span>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Café con Marta"
              maxLength={200}
              aria-label="Descripción"
            />
          </label>

          <button type="submit" className="boton" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Apuntar'}
          </button>
        </div>

        <p className="nota">
          Se apunta con la fecha de hoy. Para otra fecha o más detalle, usa <strong>Movimientos</strong>.
        </p>
      </form>
    </section>
  );
}
