# 💶 Gestor de Gastos

Aplicación web **para uso personal** que registra tus ingresos y gastos, controla tus
gastos fijos, te dice cuánto puedes ahorrar y avisa cuando te pasas del presupuesto.

Funciona **en tu propio ordenador**: no hay servidores, no hay cuentas, no hay nube.
Todos tus datos viven en un único fichero (`data/gastos.db`) que solo tú tienes.

---

## Para empezar (si no sabes de programación)

1. **Descarga la aplicación**: en la página de GitHub, botón verde **`Code`** →
   **`Download ZIP`**. Descomprime el ZIP donde quieras (el Escritorio vale).
   Si sabes usar git: `git clone` de este repositorio.
2. **Instala Node.js** una sola vez, desde [nodejs.org](https://nodejs.org)
   (descarga la versión LTS, y dale a "Siguiente" en todo).
3. **Haz doble clic en `iniciar.bat`** (Windows), dentro de la carpeta que acabas de
   descomprimir. En macOS o Linux, abre una terminal en esa carpeta y ejecuta
   `./iniciar.sh`.
4. Se abrirá una ventana negra con texto y, a los pocos segundos, la aplicación se
   abrirá sola en tu navegador. **La primera vez tarda un par de minutos** porque
   descarga lo que necesita.

> ⚠️ **No cierres la ventana negra** mientras uses la aplicación: es el motor que la
> hace funcionar. Cuando termines, ciérrala y listo.

Si el navegador no se abre solo, entra a mano en **http://localhost:3001**.

### La primera vez: cuatro preguntas

La primera vez que la abras te recibe un **asistente** con cuatro preguntas: si cobras una
nómina o eres autónomo, cuánto ingresas, qué pagas todos los meses y cuánto tienes
ahorrado. En un minuto la aplicación queda funcionando, con tus gastos fijos apuntándose
solos cada mes.

Empiezas con la aplicación **vacía**: los datos son tuyos y no viene nada de ejemplo.

Si pulsaste «Lo configuro yo» y luego te arrepientes, puedes volver a abrirlo cuando
quieras desde **⚙️ Secciones → «Abrir el asistente»**, abajo a la izquierda. Si ya tenías
cosas apuntadas te avisará: lo que rellenes **se suma** a lo que hay, no lo sustituye.

Si dices que eres **autónomo**, se activa además la sección **Autónomo** (IVA, IRPF y
cuánto apartar cada trimestre para Hacienda).

Todo lo que respondas se puede cambiar después, y nada de lo que crea es especial: son
gastos fijos normales. Si prefieres montarlo tú, pulsa **«Lo configuro yo»**.

### Cómo hacer una copia de seguridad

En **Importar / Exportar** hay un botón **«Descargar copia de seguridad»**: te da un
fichero con absolutamente todo (movimientos, cuentas, categorías, reglas, objetivos y
ajustes). Guárdalo donde quieras. Para restaurarlo, ponlo en la carpeta `data` con el
nombre `gastos.db`.

Usa ese botón y no una copia manual del fichero: la base de datos trabaja en modo WAL y
parte de los datos recientes vive en un fichero aparte, así que copiar solo `gastos.db`
puede darte una copia **vacía**: ha pasado. El botón usa `VACUUM INTO`, que produce un
fichero único y consistente.

Si aun así necesitas moverla a mano, para el servidor antes y llévate los tres ficheros
juntos: `gastos.db`, `gastos.db-wal` y `gastos.db-shm`.

### Si borras algo sin querer

Al borrar un movimiento aparece abajo un aviso con un botón **«Deshacer»**. Vuelve tal y
como estaba, con su categoría y su fecha. El aviso dura unos segundos: si se va, siempre
puedes volver a apuntarlo a mano.

---

## Qué puedes hacer

| Sección | Para qué sirve |
| --- | --- |
| **Resumen** | Balance, ingresos, gastos, tasa de ahorro, evolución de 12 meses y gráficos por categoría. Arriba del todo tienes el **alta rápida**: importe, categoría y Enter para apuntar un gasto sin cambiar de pantalla. Incluye el panel **"Tu capacidad de ahorro"**: cuánto ahorras de media al mes, qué parte de tu nómina se va en gastos fijos y cuáles son los mayores. |
| **Cuentas** | Dónde está tu dinero (banco, efectivo, ahorro) con su saldo, y **traspasos** entre ellas. |
| **Movimientos** | Alta, edición y borrado de ingresos y gastos, con filtros por fecha, tipo, categoría y texto. |
| **Gastos fijos** | Nómina, alquiler, suscripciones… Se definen una vez (importe + día del mes) y la aplicación **crea los movimientos sola** cada mes. |
| **Plan de ahorro** | Cuánto ahorras de verdad, tu objetivo, el fondo de emergencia dimensionado sobre tu gasto real, la meta de ahorro para comprar vivienda, tu reparto frente a la regla 50/30/20 y recomendaciones priorizadas. |
| **Autónomo** | Solo si activas el modo: facturas con IVA e IRPF, resumen trimestral y cuánto tienes que apartar para Hacienda. |
| **Presupuestos** | Un tope de gasto por categoría y mes, con barra de consumo en verde / ámbar / rojo y el porcentaje orientativo que se recomienda destinar a cada partida. |
| **Categorías** | Crear, editar, archivar y borrar categorías, cada una con su color. |
| **Reglas** | Categorizan solas los movimientos al importar, según el concepto que escribe el banco. |
| **Importar / Exportar** | Descargar tus movimientos a Excel o CSV, e importar el extracto del banco con vista previa antes de guardar nada. |

### Sobre las cuentas y los traspasos

Cada movimiento pertenece a una cuenta: el banco, el efectivo, la de ahorro. **Si solo
tienes una, el selector no aparece en ningún sitio** y puedes ignorar el concepto entero.

Mover dinero entre cuentas tuyas es un **traspaso**, y no es ni un ingreso ni un gasto:
tu patrimonio no cambia. Por eso los traspasos viven en su propia tabla y no aparecen en
Movimientos ni en el Resumen. Si se registraran como dos movimientos enlazados habría que
acordarse de excluirlos en cada consulta de la aplicación, que es de donde salen los
errores silenciosos.

El saldo de cada cuenta **se calcula siempre, nunca se guarda**: saldo de partida, más
ingresos, menos gastos, más y menos traspasos. Así no puede desincronizarse.

### Sobre los gastos fijos

Es la parte que más te va a ahorrar tiempo. Das de alta "Alquiler, 850 €, día 1" y a
partir de ahí:

- Cada vez que abres la aplicación se generan los movimientos que ya tocaban, hasta hoy.
- **No todo es mensual**: un fijo puede repetirse cada 2, 3, 6 o 12 meses. Así caben el
  seguro del coche, la ITV o el IBI, que se generan cuando toca pero pesan su **coste
  mensual equivalente** (una ITV de 45 € al año son 3,75 €/mes) en presupuestos y planes.
- **¿Te suben el sueldo?** Edita la nómina y pon el importe nuevo: los recibos ya cobrados
  conservan el antiguo y todos los cálculos usan el nuevo desde ese momento.
- Nunca se duplican, aunque abras la app diez veces al día.
- Si un mes cambia el importe, edita ese movimiento concreto en **Movimientos**.
- Si dejas de pagarlo, **pausa** el fijo (o ponle fecha de fin). El histórico se conserva.

Ese origen "fijo" es lo que permite separar el gasto **comprometido** del **variable**,
que es justo donde se decide cuánto ahorras.

### Sobre el plan de ahorro

Compara tus números con tres referencias de planificación financiera:

- **Regla 50/30/20**: 50 % a necesidades, 30 % a caprichos y 20 % a ahorro. La aplicación
  usa tus gastos fijos como «necesidades» y los variables como «deseos»; es una
  aproximación, no un dogma.
- **Fondo de emergencia de 3 a 6 meses de gastos**, dimensionado sobre tu gasto medio real,
  no sobre una cifra redonda. El saldo que ya tienes apartado lo introduces tú: la
  aplicación no lee cuentas bancarias.
- **Tasa de ahorro media de los hogares españoles**: 12 % de la renta disponible en 2025
  (INE). Sirve de contexto, no de objetivo.

Además puedes crear **objetivos de ahorro con nombre**: un viaje, un coche, la entrada de
un piso. Cada uno con su importe, lo que llevas apartado y una fecha opcional.

- **Apartar no es gastar**, y por eso los objetivos no son gastos fijos. Registrar
  «vacaciones, 100 €/mes» como gasto hundiría tu tasa de ahorro, inflaría el fondo de
  emergencia (que se dimensiona sobre el gasto) y contaría dos veces cuando pagaras el
  viaje de verdad.
- Se llenan **en cascada, por orden**, no a partes iguales: repartir entre cinco
  objetivos hace que no termines ninguno, que es como se abandonan. Súbelos y bájalos
  con las flechas.
- El **colchón de imprevistos va por delante de todos**, y los plazos lo descuentan.
- Con **fecha límite**, te dice cuánto tendrías que apartar cada mes para llegar a tiempo.
- Las **pagas extra sí cuentan** aquí: no son parte del ciclo mensual y su destino
  natural es un objetivo a años vista.

Son referencias divulgativas calculadas sobre tus datos, no asesoramiento financiero
personalizado.

### Sobre las reglas de categorización

Una regla dice «si el concepto contiene MERCADONA, es Alimentación». Con cuatro o
cinco reglas, importar el extracto del mes deja de ser un trabajo manual.

- Se evalúan **de arriba abajo y gana la primera que coincide**, como una lista de
  ACLs: pon las específicas por encima de las genéricas.
- La comparación ignora mayúsculas, tildes y espacios de más, así que `mercadona`
  captura `COMPRA   TARJ. MERCADONA MADRID`.
- Una regla que apunta a una categoría de gasto **no** clasifica ingresos, aunque el
  texto coincida: una devolución no es una compra.
- Solo rellenan huecos: si el fichero que importas ya trae columna de categoría, esa
  manda.
- **Aplicar al histórico** reaplica las reglas a los movimientos que ya guardaste sin
  categoría, sin tener que reimportar nada. Nunca pisa una categoría existente.
- Hay un probador: pega un concepto de tu extracto y te dice qué regla lo captura.
- **Cargar reglas típicas de España** inserta un catálogo de ~95 reglas listas
  (Mercadona, Repsol, Iberdrola, Netflix, Glovo, Nómina…), ya ordenadas para que las
  específicas ganen a las genéricas. Es idempotente: no duplica lo que ya tengas ni
  toca tu orden, y omite las reglas cuya categoría hayas borrado.

No se usan expresiones regulares a propósito: los cuatro modos (contiene, empieza,
termina, es exactamente) cubren los casos reales de un extracto y ningún patrón mal
escrito puede colgar el proceso.

### Modo autónomo

Todas las secciones están siempre en la barra lateral. La única que aparece y desaparece
es **Autónomo**, porque a quien cobra una nómina no le dice nada.

En **⚙️ Ajustes**, abajo a la izquierda, está el interruptor **«Soy autónomo»**, que añade
una sección para España:

- **Facturas con desglose**: base imponible, IVA e IRPF retenido. La aplicación calcula
  lo que realmente entra en el banco (base + IVA − retención) y lo registra como
  movimiento normal, así que cuenta en el resto de la aplicación.
- **Resumen trimestral**: IVA repercutido menos soportado (modelo 303), rendimiento neto
  y pago fraccionado estimado (modelo 130) descontando lo ya retenido en factura.
- **Provisión**: lo que hay que tener guardado y no gastar. Es la idea central de la
  sección: **el IVA que cobras no es tuyo**, lo tienes en depósito para Hacienda.
- **Guía de gastos deducibles** con las reglas reales, no solo el «sí/no»: el 30 % de
  suministros se aplica sobre la parte de la vivienda afecta (100 € de luz con un 20 %
  afecto son 6 € deducibles, no 30), las dietas tienen límite de 26,67 €/día en España y
  exigen restaurante y pago electrónico, y el turismo no es deducible en IRPF salvo
  afectación exclusiva aunque sí lo sea al 50 % en IVA. Los gastos que más revisa Hacienda
  van marcados.
- **Concentración de clientes**: si uno supera el 75 % de tu facturación, avisa de que
  podrías ser **TRADE** (autónomo económicamente dependiente), con sus siete requisitos y
  los derechos que da. También advierte de la frontera con el «falso autónomo».
- **Resumen anual** con la reducción por gastos de difícil justificación (5 % del
  rendimiento neto, tope 2.000 €).
- **Cuota de autónomos**: la introduces tú, porque te la cobran cada mes y la conoces
  exacta. La aplicación **no incluye la tabla de los 15 tramos**: las fuentes públicas
  discrepan en los extremos (200-230 € de mínima, 590-604,8 € de máxima) y la oficial es
  la de la Seguridad Social. Sí se muestra como referencia la tarifa plana de 80 €/mes
  los primeros 12 meses.

No presenta modelos ni sustituye a una gestoría: es una previsión de tesorería sobre tus
propios datos.

### Sobre los porcentajes recomendados en presupuestos

Cada categoría por defecto trae un rango orientativo en **porcentaje de lo que ingresas
un mes normal**, convertido a euros. El botón **Usar** fija el punto medio del rango.

**La base es la mediana de tus meses cerrados, no la media.** Con 14 pagas, dos meses
del año valen el doble; la media aritmética saldría por encima de lo que cobras un mes
corriente y presupuestar sobre ella te haría gastar de más los otros diez. La mediana
ignora esos dos picos. Declara tus pagas en **Plan de ahorro → Ajustar objetivos**.

Hay **dos perfiles**, porque el reparto cambia de forma —no solo de tamaño— según la
renta. Por debajo de 1.800 € netos al mes se aplica el ajustado: cuanto menor es la
renta, más pesan los gastos que no se pueden comprimir (ley de Engel), y el propio INE
lo mide: la vivienda supone el 41,9 % del presupuesto en los hogares de menor gasto
frente al 28,9 % en los de mayor. Aplicar el 50/30/20 sin más produce un plan
incumplible, y un presupuesto incumplible se abandona la primera semana.

| Partida | Estándar | Renta ajustada (< 1.800 €) | Media España (INE, EPF 2024) |
| --- | --- | --- | --- |
| Vivienda | 25–30 % | 25–35 % | — |
| Alimentación | 10–15 % | 13–18 % | 16 % |
| Transporte | 8–15 % | 10–16 % | 11,5 % |
| Suministros | 5–8 % | 6–9 % | — |
| Ocio (cenas, cine, videojuegos, viajes, gimnasio) | 5–10 % | 4–8 % | 9,3 % |
| Compras | 3–5 % | 2–4 % | — |
| Salud | 3–5 % | 2–4 % | — |
| Otros gastos | 3–5 % | 3–5 % | — |
| Suscripciones | 1–3 % | 1–2 % | — |
| Ahorro/Inversión | 15–20 % | 10–15 % | — |

Tres advertencias que la propia interfaz repite:

- **Los máximos no suman 100 % a propósito.** Son topes por partida, no un reparto: no
  puedes estar en el máximo de todas.
- **«Media España» no es comparable con las otras columnas.** El porcentaje del INE es
  sobre el *gasto* total del hogar; los recomendados son sobre los *ingresos*. Sirve
  para comparar hábitos, no para sumarlo.
- **Las pagas extra se presupuestan aparte.** El objetivo de ahorro mensual del perfil
  ajustado baja al 10–15 % precisamente porque las extras son la vía para acercarse al
  20 % anual sin ahogar el mes a mes.

Las categorías que crees tú no llevan referencia: no hay una cifra estándar para
«Mascota».

---

## Stack y decisiones técnicas

| Capa | Elección | Por qué |
| --- | --- | --- |
| Backend | Node 22+ / Express | Un único proceso sirve API y estáticos. Cero infraestructura. |
| Base de datos | **`node:sqlite`** (módulo nativo del runtime) | SQLite sin dependencias nativas que compilar: `better-sqlite3` habría exigido toolchain de C++ y es la causa clásica de que `npm install` falle en otra máquina. La BD es un fichero: backup = copiar. |
| Validación | Zod | Un único contrato de entrada, con errores en español campo a campo. |
| Frontend | React 18 + TypeScript + Vite | Tipado extremo a extremo y build estático que sirve el propio Express. |
| Gráficos | Chart.js | Ligero y suficiente para líneas y anillos. Sin CDN: funciona sin internet. |
| Excel / CSV | SheetJS (`xlsx`) | Lee y escribe `.xlsx`, `.xls` y `.csv` con el mismo código. |

**Importes:** se guardan siempre como **enteros de céntimos** (`importe_centimos`).
Nada de coma flotante para dinero. La API expone euros y la conversión ocurre en la
capa de servicios.

**Migraciones:** versionadas con `PRAGMA user_version` y aplicadas al arrancar dentro
de una transacción. Para evolucionar el esquema se **añade** una función al array de
`server/src/db/migraciones.js`; nunca se modifica una existente.

---

## Estructura del proyecto

```
GestorDeGastos/
├─ iniciar.bat / iniciar.sh   Arranque de doble clic
├─ docs/                      Contexto, referencias con fuentes e historial de decisiones
├─ scripts/                   Carga de la configuración personal descrita en docs/
├─ data/gastos.db             Tu base de datos (no se sube a git)
├─ server/
│  ├─ pruebas/                Suite de pruebas (node:test)
│  └─ src/
│     ├─ index.js             Bootstrap: arranca el servidor y lo apaga limpiamente
│     ├─ app.js                Construye la app Express (sin escuchar: lo usan las pruebas)
│     ├─ config.js            Puerto, rutas, flags
│     ├─ db/                  conexion · migraciones · semilla
│     ├─ rutas/               Un router por recurso (HTTP y nada más)
│     ├─ servicios/           Lógica de negocio y SQL
│     ├─ validacion/          Esquemas Zod
│     ├─ middleware/          Manejador central de errores
│     └─ utiles/              dinero · fechas · errores
└─ web/
   ├─ pruebas/                Pruebas del parseo de importación y del formato de números
   └─ src/
      ├─ api/                 Cliente HTTP y un módulo por recurso
      ├─ paginas/             Panel · Movimientos · Cuentas · Fijos · Ahorro · Autónomo · Presupuestos · Categorías · Reglas · Datos
      ├─ componentes/         Diseño, modales, campos, gráficos, estados
      ├─ hooks/               useRecurso (carga + error) · useAvisos (notificaciones)
      ├─ utiles/              Formato español, parseo de ficheros importados y avisos entre pantallas
      └─ estilos.css          Hoja única con variables de tema
```

---

## Desarrollo

```bash
npm install     # una sola vez
npm run dev     # Express en :3001 con --watch + Vite en :5173 (proxy /api)
npm run build   # comprueba tipos y compila la web a web/dist
npm start       # sirve todo desde :3001
npm test        # suite completa (sin dependencias externas)
```

### Pruebas

308 pruebas con el runner nativo de Node (`node:test`), sin Jest ni Vitest:

| Fichero | Qué cubre |
| --- | --- |
| `server/pruebas/dinero.test.js` | Céntimos y parseo de importes escritos por personas o bancos. |
| `server/pruebas/medias.test.js` | Medias y medianas mensuales, proyección del mes en curso y reacción a una subida de sueldo. |
| `server/pruebas/cuentas.test.js` | Saldos calculados, traspasos que no alteran el patrimonio ni contaminan el resumen, y borrado protegido. |
| `server/pruebas/categorias.test.js` | CRUD, duplicados, borrado protegido y la búsqueda que usa la importación. |
| `server/pruebas/fechas.test.js` | Formatos de fecha, meses bisiestos y el día 31 en febrero. |
| `server/pruebas/movimientos.test.js` | CRUD, filtros, paginación y totales. |
| `server/pruebas/recurrentes.test.js` | Generación de fijos: idempotencia, fechas de fin, pausados. |
| `server/pruebas/presupuestos.test.js` | Upsert, consumo, estados y copia entre meses. |
| `server/pruebas/resumen.test.js` | Balance, desgloses, evolución y panel de ahorro. |
| `server/pruebas/salud.test.js` | Objetivos, fondo de emergencia, 50/30/20 y consejos. |
| `server/pruebas/autonomo.test.js` | Desglose de facturas, IVA a ingresar o compensar, pago fraccionado y provisión trimestral. |
| `server/pruebas/metas.test.js` | Objetivos de ahorro: progreso, orden en cascada, aportaciones y que apartar no cuente como gasto. |
| `server/pruebas/reglas.test.js` | Coincidencias, orden de evaluación, autocategorización al importar y reaplicado al histórico. |
| `server/pruebas/referencias.test.js` | Catálogo de reglas típicas (orden, idempotencia, falsos positivos), perfiles por renta y base mediana con 14 pagas. |
| `server/pruebas/datos.test.js` | Exportación, detección de columnas e importación atómica. |
| `server/pruebas/api.test.js` | La API por HTTP real: validación, códigos de estado y errores. |
| `web/pruebas/importacion.test.ts` | El parseo de la vista previa de importación (TypeScript, ejecutado directamente por Node). |

Cada fichero usa su propia base de datos temporal, así que la suite no toca `data/gastos.db`.

Variables de entorno opcionales:

| Variable | Efecto |
| --- | --- |
| `PUERTO` | Puerto del servidor (por defecto `3001`). |
| `RUTA_BD` | Ruta alternativa del fichero SQLite. |
| `ABRIR_NAVEGADOR=0` | No abrir el navegador al arrancar. |

### API

Todas las rutas cuelgan de `/api` y devuelven JSON. Los errores tienen siempre la forma
`{ "error": "...", "detalles": [{ "campo": "...", "mensaje": "..." }] }`.

```
GET    /api/salud
GET    /api/categorias            POST /api/categorias
PUT    /api/categorias/:id        DELETE /api/categorias/:id?forzar=true
GET    /api/movimientos?desde&hasta&tipo&categoriaId&texto&pagina&porPagina
POST   /api/movimientos           PUT|DELETE /api/movimientos/:id
GET    /api/recurrentes           POST /api/recurrentes
PUT    /api/recurrentes/:id       DELETE /api/recurrentes/:id?borrarGenerados=true
POST   /api/recurrentes/generar
GET    /api/presupuestos?anio&mes PUT /api/presupuestos
POST   /api/presupuestos/copiar-mes-anterior
GET    /api/resumen?desde&hasta
GET    /api/resumen/evolucion?meses=12
GET    /api/resumen/ahorro?meses=6
GET    /api/resumen/salud?meses=6
GET    /api/ajustes              PUT /api/ajustes
GET    /api/cuentas              POST /api/cuentas
PUT    /api/cuentas/:id          DELETE /api/cuentas/:id
GET    /api/cuentas/traspasos    POST /api/cuentas/traspasos
DELETE /api/cuentas/traspasos/:id
GET    /api/datos/copia-seguridad
GET    /api/autonomo             GET /api/autonomo/trimestre
GET    /api/autonomo/anual       GET /api/autonomo/clientes
GET    /api/autonomo/guia        GET /api/autonomo/suministros
POST   /api/autonomo/facturas
GET    /api/metas                POST /api/metas
PUT    /api/metas/:id            DELETE /api/metas/:id
POST   /api/metas/:id/aportar    POST /api/metas/:id/mover
GET    /api/reglas               POST /api/reglas
PUT    /api/reglas/:id           DELETE /api/reglas/:id
POST   /api/reglas/:id/mover     POST /api/reglas/probar
POST   /api/reglas/sugerir       POST /api/reglas/aplicar
POST   /api/reglas/catalogo
GET    /api/datos/exportar?formato=csv|xlsx      GET /api/datos/plantilla
POST   /api/datos/importar/analizar (multipart)  POST /api/datos/importar/confirmar
```

---

## Documentación adicional

En [`docs/`](docs/) está el contexto que no se deduce del código: el perfil económico
sobre el que se ha calibrado la aplicación, las cifras macro usadas en las
recomendaciones con su fuente y fecha, las decisiones de diseño con su porqué y el
historial de peticiones.

---

## Problemas frecuentes

| Síntoma | Solución |
| --- | --- |
| «No se ha encontrado Node.js» | Instálalo desde [nodejs.org](https://nodejs.org) y vuelve a ejecutar `iniciar.bat`. |
| «El puerto 3001 ya está en uso» | La aplicación ya está abierta en otra ventana. Ciérrala, o arranca con `PUERTO=3002 npm start`. |
| La página dice «La interfaz no está compilada» | Ejecuta `npm run build` (o usa `iniciar.bat`, que lo hace solo). |
| El navegador no abre nada | Entra a mano en <http://localhost:3001>. |
| Quiero empezar de cero | Cierra la aplicación y borra `data/gastos.db`. Se creará una nueva vacía. |
