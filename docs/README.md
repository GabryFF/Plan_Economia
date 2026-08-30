# Documentación del proyecto

Contexto que no se deduce del código y que conviene tener a mano para retomar el
proyecto más adelante.

| Documento | Qué contiene |
| --- | --- |
| [referencias-espana-2026.md](referencias-espana-2026.md) | Cifras macro usadas en las recomendaciones (IPC, carburantes, euríbor, vivienda, fiscalidad de autónomos), con fuente y fecha de consulta. |
| [decisiones.md](decisiones.md) | Decisiones de diseño con su porqué, y los defectos encontrados por el camino. |

> Los porcentajes que recomienda la aplicación se calibraron contra un perfil económico
> real, que no forma parte de esta versión. Lo que sí está aquí son las referencias con su
> fuente, que es lo que hace falta para entender —y discutir— de dónde salen.

## Cómo mantener esto vivo

Las cifras del documento de referencias **caducan**: el IPC, el euríbor y el precio del
combustible cambian cada mes. Están centralizadas en
`server/src/servicios/referencias.js`; cuando se actualicen ahí, hay que actualizarlas
aquí y anotar la fecha de consulta.
