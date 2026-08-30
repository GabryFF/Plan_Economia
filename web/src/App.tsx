import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Diseno } from './componentes/Diseno';
import { ProveedorAvisos } from './hooks/useAvisos';
import { PaginaPanel } from './paginas/Panel';
import { PaginaMovimientos } from './paginas/Movimientos';
import { PaginaCuentas } from './paginas/Cuentas';
import { PaginaFijos } from './paginas/Fijos';
import { PaginaAhorro } from './paginas/Ahorro';
import { PaginaAutonomo } from './paginas/Autonomo';
import { PaginaPresupuestos } from './paginas/Presupuestos';
import { PaginaCategorias } from './paginas/Categorias';
import { PaginaReglas } from './paginas/Reglas';
import { PaginaDatos } from './paginas/Datos';

export function App() {
  return (
    <ProveedorAvisos>
      <BrowserRouter>
        <Routes>
          <Route element={<Diseno />}>
            <Route index element={<PaginaPanel />} />
            <Route path="movimientos" element={<PaginaMovimientos />} />
            <Route path="cuentas" element={<PaginaCuentas />} />
            <Route path="fijos" element={<PaginaFijos />} />
            <Route path="ahorro" element={<PaginaAhorro />} />
            <Route path="autonomo" element={<PaginaAutonomo />} />
            <Route path="presupuestos" element={<PaginaPresupuestos />} />
            <Route path="categorias" element={<PaginaCategorias />} />
            <Route path="reglas" element={<PaginaReglas />} />
            <Route path="datos" element={<PaginaDatos />} />
            <Route path="*" element={<PaginaPanel />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ProveedorAvisos>
  );
}
