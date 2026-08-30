# Decisiones de diseño y defectos encontrados

Lo que no se deduce leyendo el código: por qué está hecho así y qué se rompió por el
camino.

## Decisiones de fondo

### Dinero en céntimos, siempre

`importe_centimos` es un `INTEGER`. La coma flotante no representa 0,1 exactamente y los
errores se acumulan al sumar. La API expone euros; la conversión vive en la capa de
servicios.

### `node:sqlite` en vez de `better-sqlite3`

El driver SQLite nativo del runtime (Node 22+) no necesita compilar nada.
`better-sqlite3` exige toolchain de C++ y es la causa clásica de que `npm install` falle
en la máquina de otra persona. La aplicación tiene que arrancar con doble clic.

### Los recurrentes son plantillas, no movimientos

Un gasto fijo describe una regla; los movimientos reales los genera
`materializarPendientes` hasta la fecha de hoy. La idempotencia no es lógica de
aplicación: la garantiza un índice único parcial `(recurrente_id, fecha)`.

De ahí sale gratis el corte **fijo vs. variable**, que es donde se decide el ahorro.

### Las reglas se evalúan en orden, gana la primera

Como una lista de ACLs. Es predecible y depurable. La alternativa —«gana la más
específica»— es magia difícil de explicar cuando falla.

**Sin expresiones regulares a propósito.** Los cuatro modos (contiene, empieza, termina,
exacto) cubren los casos reales de un extracto bancario, y ningún patrón mal escrito
puede colgar el proceso con backtracking catastrófico.

### La coincidencia de reglas vive solo en el servidor

La vista previa de la importación llama a `POST /api/reglas/sugerir`. Duplicar la lógica
en el cliente habría hecho que la previsualización y lo que se guarda pudieran divergir.

### Mediana, no media, para los porcentajes recomendados

Con 14 pagas, dos meses del año valen el doble. La media aritmética queda por encima de
lo que se cobra un mes normal y presupuestar sobre ella lleva a gastar de más los otros
diez. La mediana ignora esos picos.

La media **sí** se usa para la tasa de ahorro: ahí lo que importa es el año completo.

### Dos perfiles de referencia, no uno escalado

Por debajo de 1.800 €/mes el reparto cambia de forma, no solo de tamaño: los gastos
incomprimibles pesan más (ley de Engel). Aplicar el 50/30/20 a esa renta produce un plan
que no se puede cumplir, y un presupuesto incumplible se abandona la primera semana.

### Un menú corto y siempre igual

Todas las secciones se ven siempre. La única excepción es **Autónomo**, que aparece solo
al activar el modo, porque a quien cobra una nómina no le dice nada.

Hubo una versión con secciones ocultables y un panel para activarlas. Se quitó junto con
las tres que sobraban: con nueve entradas el menú ya cabe de un vistazo, y un menú que
cambia según ajustes que no recuerdas haber tocado desorienta más de lo que ahorra.

### Deshacer en vez de preguntar más

Un «¿Seguro?» antes de borrar interrumpe siempre, incluso las veces que aciertas. Un
«Deshacer» después solo aparece cuando te equivocas, que es cuando hace falta.

El aviso de borrado lleva un botón que devuelve el movimiento, y dura el doble que un
aviso normal porque hay que leerlo y decidir. No resucita el `id` —es una fila nueva—,
pero sí conserva el **origen** y el vínculo con el gasto fijo que lo generó: sin ese
vínculo, el índice único `(recurrente_id, fecha)` dejaría de proteger el recibo y la
aplicación lo volvería a generar duplicado.

## Defectos encontrados y corregidos

### 1. La protección al borrar categorías no funcionaba

`obtenerCategoria` hacía `SELECT *`, que no incluye el contador de movimientos, así que
el servicio leía siempre `0` y borraba sin devolver el 409. La confirmación de la
interfaz sí avisaba (usa el listado, que cuenta), pero la garantía del servidor era papel
mojado.

**Lo encontró** el primer test de la API.

### 2. La autodetección de columnas se equivocaba con extractos españoles

Una columna «Fecha valor» —habitual en bancos españoles— se asignaba al campo *Importe*,
porque `valor` era una de sus pistas. Ahora se resuelven primero las coincidencias
exactas y cada columna se asigna a un único campo.

### 3. Corrupción silenciosa de fechas al importar CSV *(el más grave)*

SheetJS interpretaba `01/08/2026` como fecha **estadounidense** (8 de enero), la convertía
y la reescribía como `1/7/26`. Las filas con día ≤ 12 se importaban con **el mes
equivocado**; las de día > 12 se salvaban solo porque son imposibles de leer al revés.

Importar un extracto español metía fechas incorrectas en cerca del 40 % de las filas sin
ningún error visible. Un movimiento en el mes equivocado descuadra el presupuesto, el
balance y la media de ahorro.

Ahora el CSV se lee como texto crudo y lo interpreta `parsearFecha`, que asume formato
español. En un `.xlsx` real, donde las fechas sí son celdas tipadas, se convierten a ISO
con las partes locales para que el paso por UTC no reste un día.

**Lo encontró** probar la importación con un CSV que imitaba un extracto real. Ni la
suite de 113 tests ni la revisión visual lo habían detectado.

### 4. Doble conteo de las pagas extra

Al proyectar la tasa de ahorro anual se sumaban las extras al ahorro medio mensual, que
ya las lleva prorrateadas. Daba **114,3 %**, imposible para una tasa de ahorro. Ahora se
parte del ahorro de un mes normal (mediana menos gasto medio).

### 5. La primera pantalla con la base vacía

El mensaje de bienvenida dependía de tener seleccionado el rango «Todo», así que con el
rango por defecto se veía un panel entero de ceros. Y con todos los valores a cero,
Chart.js generaba ticks fraccionarios que se formateaban todos como «0 €» y «-0 €».

### 6. El asistente de primer arranque fallaba siempre al guardar

`aNumero` hacía `texto.trim()` sobre el valor de un campo leído de un `Record` por clave.
La casilla que el usuario no toca no vale `''`: vale `undefined`. TypeScript no lo avisa
porque un acceso por índice se tipa como `string` salvo que se active
`noUncheckedIndexedAccess`.

Como el asistente pregunta por seis gastos fijos habituales y nadie los tiene todos,
**el fallo saltaba prácticamente siempre**: el usuario veía «No se ha podido guardar» y
no había forma de terminar. El `TypeError` ocurría antes del `fetch`, así que en el
servidor no quedaba ni rastro: no llegaba a haber petición.

Sólo apareció ejecutando el asistente en un navegador. Las 14 pruebas del servicio
pasaban, porque prueban el servidor, y ahí el problema no existía.

`aNumero` acepta ahora `null`/`undefined`. Un formulario a medio rellenar es lo normal.

### 7. La sección de autónomo no aparecía hasta recargar

El asistente activaba el modo autónomo, pero la barra lateral pide los ajustes una sola
vez al arrancar y no se enteraba. La sección nueva no salía hasta recargar la página a
mano, que es justo lo que no se le puede pedir a quien no toca un ordenador.

Resuelto con un evento del navegador (`utiles/eventos.ts`) que la barra escucha. Son dos
pantallas: no hacía falta montar un estado global.

### 8. Copiar la base de datos con `cp` destruyó los datos *(pérdida de datos)*

Para probar el asistente con la aplicación vacía, aparté la base de datos con `cp` y `mv`.
Los dos ficheros resultantes tenían **cero tablas**: en modo WAL el fichero `.db` puede
estar prácticamente vacío mientras todo vive en el `-wal`, que se quedó atrás. Al arrancar
de nuevo, SQLite creó una base vacía junto a aquel `-wal` huérfano y lo sobrescribió.

La propia documentación de este proyecto ya decía que las copias se hacen con
`VACUUM INTO` precisamente por esto. No seguí mi propia regla.

**Norma**: nunca copiar `gastos.db` con herramientas de fichero. Se usa la copia de
seguridad de la aplicación (`Importar / Exportar`), que hace `VACUUM INTO` y produce un
fichero único y consistente. Si hay que hacerlo a mano, con el servidor parado y
llevándose los tres ficheros (`.db`, `-wal`, `-shm`) juntos.

La configuración se pudo reconstruir porque estaba escrita en la documentación del
proyecto, no porque hubiera una copia. Es la razón de que la copia de seguridad sea un
botón y no una instrucción de la que acordarse.

### 9. Los gastos fijos no contaban en el saldo de la cuenta

`materializarPendientes` insertaba los recibos sin `cuenta_id`. Como la nómina y los
fijos son la mayor parte del dinero que se mueve, la pantalla de **Cuentas** enseñaba un
saldo que no se parecía en nada al balance de **Movimientos**: en la base de pruebas,
−9,49 € y «2 movimientos» frente a 111 movimientos y 13.659,12 € reales.

Los movimientos manuales sí lo hacían, porque pasan por `crearMovimiento`, que aplica la
cuenta por defecto. El camino automático se saltaba ese paso.

Corregido en la inserción, y la migración `recibosSinCuenta` adopta los huérfanos que ya
existan. Apareció al mirar la pantalla de Cuentas en formato ficha: el defecto llevaba ahí
desde que se añadieron las cuentas, y ninguna prueba lo cubría.

### La aplicación no recomienda productos, y es deliberado

El plan de ahorro dice cuánto puedes apartar y en qué orden conviene hacerlo, a partir de
reglas explícitas sobre tus propios datos. En ningún momento dice **dónde** poner el
dinero.

No es una limitación técnica: recomendar productos concretos a una persona concreta es
asesoramiento financiero, depende de su situación completa y en España lo presta gente
registrada en la CNMV. Una aplicación doméstica que lo hiciera estaría dando consejos con
apariencia de autoridad y sin ninguna.

### Apartar dinero no es un gasto

Los objetivos de ahorro (viaje, coche, entrada del piso) son su propia entidad, no
movimientos fijos. Registrar «vacaciones, 100 €/mes» como gasto tendría tres efectos, los
tres malos: hundiría la tasa de ahorro, inflaría el fondo de emergencia —que se dimensiona
sobre el gasto— y contaría dos veces cuando el viaje se pagara de verdad.

El gasto se apunta **cuando ocurre**. Lo de antes es ahorro con destino.

El reparto entre objetivos es **en cascada y no proporcional**: se llena el primero y
luego el siguiente. Repartir a partes iguales entre cinco objetivos hace que no termines
ninguno en mucho tiempo, que es la forma más común de abandonarlos.

El fondo de emergencia **no** es una meta más: no es un importe fijo, sino N meses de tu
gasto, y cambia cuando cambia tu gasto.

### El módulo de autónomo no incluye la tabla de tramos

Las cuotas de 2026 se prorrogaron desde 2025, pero las fuentes públicas consultadas **no
coinciden** en los extremos: se publican 200 y 230 €/mes de cuota mínima, y 590 y
604,8 € de máxima. Con esa discrepancia, cargar los 15 tramos habría sido dar por cerrado
un dato que no lo está.

La cuota la introduce el usuario, que la conoce exacta porque se la cobran cada mes. La
aplicación aporta el contexto citable (tarifa plana de 80 €, número de tramos, umbral de
la tabla reducida) y remite a la Seguridad Social.

La sección se organiza alrededor de la **provisión** y no del beneficio, porque el error
que arruina autónomos no es calcular mal el margen: es gastarse el IVA cobrado y llegar
al modelo 303 sin fondos.

### Un traspaso no es un movimiento

Mover 500 € de la corriente al ahorro no cambia tu patrimonio, así que no puede aparecer
en el balance, ni hundir la tasa de ahorro, ni consumir presupuesto.

La implementación habitual —dos movimientos enlazados, uno de salida y otro de entrada—
obliga a excluirlos explícitamente en **cada** consulta de la aplicación: resumen, medias,
presupuestos, plan de ahorro, exportación. Olvidarse en una sola produce un error
silencioso que nadie detecta hasta que los números no cuadran.

Los traspasos tienen su propia tabla. Ninguna consulta existente necesitó cambiar.

El saldo de cada cuenta se **deriva** y no se almacena: saldo inicial + ingresos − gastos
+ traspasos recibidos − enviados. Un saldo guardado es un saldo que algún día se
desincroniza.

## Lo que se descartó

| Idea | Por qué no |
| --- | --- |
| Agregación bancaria automática (tipo Fintonic) | Exige PSD2, un agregador de pago y meter credenciales bancarias. Importar el CSV una vez al mes con buenas reglas da el 90 % del valor sin nada de ese riesgo. |
| Partida doble (tipo Firefly III) | Correcto contablemente, desproporcionado para un uso personal de una sola cuenta. |
| Regex en las reglas | Riesgo de backtracking catastrófico a cambio de casos que los cuatro modos ya cubren. |
| Jest o Vitest | El runner nativo de Node cubre todo lo necesario sin añadir dependencias. |
| Diseño para móvil | Llegó a estar hecho (cada fila una ficha debajo de 640 px) y se retiró: la aplicación se usa desde el ordenador, sentado, y mantener un segundo diseño para un caso que no se da es coste sin uso. Las tablas siguen desplazándose de lado si la ventana se estrecha. |

## Pendiente, por orden de valor

1. **Adjuntar el ticket** a un movimiento.
2. **Enlazar un gasto con un objetivo**: al pagar el viaje, descontarlo automáticamente
   de lo apartado en vez de tener que ajustarlo a mano.
