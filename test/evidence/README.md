# Evidencias de pruebas de integración (PetSafe Back)

## Objetivo
Generar evidencia técnica y visual para informe académico (LaTeX) sobre pruebas de integración backend con colecciones Postman ejecutables vía Newman.

## Herramientas utilizadas
- Node.js `v24.15.0`
- npm (con restricciones de red/política en este entorno)
- Colecciones Postman en `test/*.postman_collection.json`

## Colecciones priorizadas
- `test/PetSafe-API.postman_collection.json`
- `test/Encounters-Vaccinations.postman_collection.json`
- `test/PetSafe-Encounters-Attachments.postman_collection.json`
- `test/PetSafe-Encounters-Drafts.postman_collection.json`
- `test/PetSafe-Vaccinations-Fixed.postman_collection.json`
- `test/PetSafe-Appointments.postman_collection.json`
- `test/PetSafe-Appointments-NoShow-ClinicalFollowUps.postman_collection.json`
- `test/PetSafe-Notificaciones.postman_collection.json`

## Comandos usados
Ver `test/evidence/logs/commands.log` y archivos de log individuales.

## Resultados generales
- Se realizó diagnóstico del entorno y análisis estructural de colecciones.
- **Bloqueo principal**: Newman no ejecutable por error `403 Forbidden` al resolver/validar paquete (`npx newman -v`).
- Por el bloqueo anterior, no fue posible ejecutar corridas reales HTTP ni generar JSON/JUnit/HTML de Newman.
- Se generó evidencia del bloqueo y tablas de cobertura estructural (requests detectados, `pm.test` declarados).

## Bloqueos encontrados
1. Restricción de acceso/política al registro npm para `newman` (`E403`).
2. Sin ejecución efectiva de backend + base de datos semilla + credenciales de prueba verificadas para corridas end-to-end.
3. Librerías de render de imágenes (matplotlib/PIL) no disponibles en el entorno para PNG/JPG automáticos.

## Cómo reproducir cuando se habilite el entorno
1. Instalar dependencias completas y asegurar `newman` operativo.
2. Levantar backend y base de datos con variables válidas (sin exponer secretos en repo).
3. Ejecutar, por colección:
   - `npx newman run <coleccion> --reporters cli,json,junit,html --reporter-json-export test/reports/newman/<name>.json --reporter-junit-export test/reports/newman/<name>.xml --reporter-html-export test/reports/newman/<name>.html`
4. Consolidar resultados en `test/evidence/tables/` y `test/evidence/figures/`.

## Uso en informe LaTeX
- Insertar tablas `.csv/.md` como anexos técnicos (o convertir a `longtable`).
- Adjuntar evidencia visual de bloqueo y estructura de pruebas.
- Cuando Newman esté habilitado, añadir reportes por colección y resumen general.

## Seguridad / secretos
- No se incluyeron secretos reales, tokens, credenciales ni `.env` productivo.
- Cualquier variable sensible debe inyectarse externamente (CI/CD o `.env` local no versionado).
