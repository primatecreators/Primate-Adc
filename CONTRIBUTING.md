# Contribuir a Primate ADC

Este repositorio es un snapshot local de la landing de Sites versión 2. La fuente original fue verificada limpia en el commit `fca7b8c2162421373f316667d6cf561c3b3e2e49`; esta importación conserva el contenido de la fuente, pero no su historia Git original.

## Desarrollo local

Con Node.js `>=22.13.0` y pnpm `11.25.0`, instala las dependencias con `pnpm run install:ci`. Usa `pnpm run dev` para el entorno de desarrollo, `pnpm run build` para validar la compilación y `pnpm run lint` para revisar el código. No ejecutes despliegues desde este repositorio sin revisar primero el identificador del proyecto de Sites y sus datos.

## Flujo de ramas

- Crea cada cambio en una rama `feature/*` basada en `develop`.
- Abre un pull request de `feature/*` hacia `develop` para revisión.
- Los lanzamientos se preparan en `develop` y llegan a `main` mediante un pull request.
- No sobrescribas trabajo existente: conserva la historia y documenta cualquier migración.

## Publicación y datos

GitHub no despliega automáticamente este repositorio en Sites. Conserva el identificador del proyecto de Sites y sus datos al trabajar con el código importado. No incluyas secretos, credenciales ni archivos `.env*`; usa configuración local fuera del control de versiones.

