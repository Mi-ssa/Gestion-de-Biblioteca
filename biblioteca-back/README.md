# API de Biblioteca escolar

API REST con Express y arquitectura en capas. La persistencia se guarda en los JSON de `src/data`; solamente `src/models` accede al sistema de archivos.

## Inicio

```bash
pnpm install
pnpm dev
```

El servidor inicia en `http://localhost:3000`. Puede configurarse con `PORT` y `FRONTEND_ORIGIN` (por defecto `http://localhost:5173`).

## Endpoints

| Método | Ruta | Operación |
| --- | --- | --- |
| GET | `/api/health` | Estado del servicio |
| GET | `/api/libros` | Lista y búsqueda por `titulo`, `autor`, `categoria`, `disponibilidad=true/false` |
| POST | `/api/libros` | Crear libro |
| PUT / DELETE | `/api/libros/:id` | Editar o eliminar libro |
| GET | `/api/usuarios` | Listar usuarios |
| POST | `/api/usuarios` | Crear usuario |
| PUT / DELETE | `/api/usuarios/:id` | Editar o eliminar usuario |
| GET | `/api/prestamos` | Listar préstamos con libro y usuario |
| POST | `/api/prestamos` | Registrar préstamo (`usuarioId`, `libroId`) |
| POST | `/api/prestamos/:id/devolucion` | Registrar devolución y calcular multa |

Las respuestas exitosas usan `{ "data": ... }`; los errores usan `{ "error": "..." }`. Los préstamos duran 14 días, el límite activo es de 3 para estudiantes y 5 para docentes, y el retraso genera una multa de USD 5 por día. Una devolución con más de 7 días de retraso bloquea al usuario durante 7 días.

La cola de operaciones evita conflictos de lectura/modificación/escritura dentro de una instancia del servidor. Al usar JSON como almacenamiento local, ejecutar una sola instancia del backend y conservar copias de seguridad de `src/data`.
