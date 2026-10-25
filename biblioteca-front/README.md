# Entrelíneas · Biblioteca escolar

Interfaz React 19 + Vite para el catálogo público y la gestión de una biblioteca. El API se inicia por separado en `biblioteca-back`.

## Inicio

```bash
pnpm install
pnpm dev
```

Por defecto, la interfaz se conecta a `http://localhost:3000/api`. Para usar otra URL, crea un archivo `.env` en `biblioteca-front`:

```env
VITE_API_URL=http://localhost:3000/api
```

## Validación

```bash
pnpm lint
pnpm build
```

En la barra superior se puede alternar entre el panel de gestión y el catálogo público. El panel incluye altas/ediciones/bajas de libros y usuarios, registro de préstamos y devoluciones.
