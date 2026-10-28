# API de Biblioteca escolar

API REST con Express y arquitectura en capas. La persistencia se guarda en los JSON de `src/data`; solamente `src/models` accede al sistema de archivos.

## Inicio

```bash
pnpm install
pnpm dev
```

El servidor inicia en `http://localhost:3000`. Puede configurarse con `PORT` y `FRONTEND_ORIGIN` (por defecto `http://localhost:5173`).

En desarrollo se registran en la terminal el método, la ruta, el estado HTTP y el tiempo de cada respuesta. El registro no incluye query strings, cuerpos, encabezados ni valores de parámetros de ruta; las rutas dinámicas se muestran con su patrón (por ejemplo, `/api/usuarios/:id`) y las no coincidentes como `/unmatched`. Se puede deshabilitar con `HTTP_REQUEST_LOGGING=false`; en producción está deshabilitado por defecto y se puede habilitar explícitamente con `HTTP_REQUEST_LOGGING=true`.

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

Las respuestas exitosas usan `{ "data": ... }`; los errores usan `{ "error": "..." }`. Los préstamos duran 14 días, el límite activo es de 3 para estudiantes y 5 para docentes, y el retraso genera una multa de USD 5 por día. La consulta de préstamos incluye `diasRetrasoEstimados` y `multaEstimada` para préstamos activos vencidos; son una proyección y no se guardan. Al devolver, `diasRetraso` y `multa` contienen los valores definitivos registrados. Una devolución con más de 7 días de retraso bloquea al usuario durante 7 días.

La cola de operaciones evita conflictos de lectura/modificación/escritura dentro de una instancia del servidor. Al usar JSON como almacenamiento local, ejecutar una sola instancia del backend y conservar copias de seguridad de `src/data`.

## Autenticación del personal bibliotecario

La identidad administrativa es el usuario existente de `src/data/usuarios.json`: solo el rol actual `bibliotecario` puede autenticarse. Las contraseñas se guardan como hashes bcrypt en `private/staff-credentials.json`, vinculados por `userId`; no se agregan campos ni se cambian identificadores del JSON público. La carpeta `private` está excluida de Git y debe mantenerse fuera de cualquier directorio público. En Windows, limita su acceso mediante permisos ACL.

En **Gestión de usuarios**, al registrar un bibliotecario se puede activar **Crear acceso al panel administrativo** y definir/confirmar la contraseña inicial. La API genera el ID real y asocia el hash a ese ID; no concede credenciales a estudiantes o docentes. Las contraseñas deben tener 12 caracteres como mínimo, coincidir con la confirmación y no superar 72 bytes UTF-8. Para los bibliotecarios existentes sin acceso, usa el botón **Configurar acceso** en su fila. El servidor valida rol y autorización de sesión en ambos flujos. La creación conjunta usa un diario privado `pending-user-creation.json` para completar de forma recuperable usuario+credencial si se interrumpe una escritura; el diario se elimina al completar.

Los endpoints administrativos afectados son `POST /api/usuarios` (alta, con `crearAcceso: true`, `password` y `confirmPassword` solo para bibliotecarios) y `POST /api/usuarios/:id/acceso` (provisión inicial para bibliotecario existente sin credencial). Ambos requieren sesión autenticada y CSRF.

### Vincular la cuenta administrativa anterior

La implementación previa guardaba credenciales sin una relación verificable con una persona de `usuarios.json`. No se vinculan por nombre ni correo. Primero verifica fuera de la aplicación quién controla esa cuenta y qué bibliotecario autorizado debe recibirla. Después, desde CMD y en `biblioteca-back`, indica explícitamente el ID revisado:

```cmd
pnpm run auth:migrate-legacy -- ID_VERIFICADO
```

El comando muestra nombre, correo e ID elegidos; solicita el usuario anterior y la contraseña de forma interactiva (la contraseña no se muestra) y verifica su hash existente. Solo entonces vincula ese hash al ID indicado. El archivo `private/admin-accounts.json` no se elimina ni modifica. Si no puedes verificar quién es la persona, detente y decide manualmente; no asignes el ID por coincidencia.

### Crear credenciales para otro bibliotecario

Un operador con acceso local al backend puede provisionar una credencial tras verificar la identidad y el rol. El ID es obligatorio y se comprueba contra el rol actual:

```cmd
pnpm run staff:credential:init -- ID_VERIFICADO
```

La contraseña se introduce oculta en la terminal, requiere al menos 12 caracteres y no puede superar 72 bytes UTF-8. Para cambiarla, usa `pnpm run staff:credential:reset -- ID_VERIFICADO --replace`; para revocarla usa `pnpm run staff:credential:revoke -- ID_VERIFICADO`. Sustituye `ID_VERIFICADO` por el ID del bibliotecario previamente comprobado. Los usuarios normales no reciben credenciales al registrarse ni al cambiar datos; solo una sesión administrativa puede gestionar el directorio, y no puede cambiar su propio rol.

Al bajar un bibliotecario de rol o eliminarlo desde la gestión, se quitan sus credenciales y se destruyen sus sesiones almacenadas cuando es posible. El middleware vuelve a comprobar el ID y rol en cada solicitud privada; una sesión sin un bibliotecario vigente recibe 401. La lectura pública `GET /api/libros` permanece accesible.

### Iniciar en Windows CMD

Desde una ventana CMD, configura un secreto aleatorio de al menos 32 bytes y fija el origen exacto del frontend. Conserva el mismo secreto al reiniciar si quieres mantener sesiones; guarda el secreto fuera del repositorio:

```cmd
cd /d "C:\ruta\al\proyecto\biblioteca-back"
for /f "delims=" %S in ('node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64'))"') do set "SESSION_SECRET=%S"
set "FRONTEND_ORIGIN=http://localhost:5173"
set "PORT=3000"
pnpm dev
```

En otra ventana CMD:

```cmd
cd /d "C:\ruta\al\proyecto\biblioteca-front"
set "VITE_API_URL=http://localhost:3000/api"
pnpm dev
```

Abre la dirección que muestra Vite, pulsa **Gestión** e inicia sesión con el correo de biblioteca y la contraseña provisionada. **Cerrar sesión** invalida la sesión y devuelve al catálogo.

### Cookies y producción

Las sesiones del servidor duran ocho horas y se guardan en `private/sessions`, no en memoria. Se rota el identificador al autenticar. Las cookies son `HttpOnly` y `SameSite=Lax`; en desarrollo HTTP no llevan `Secure`. En producción se activa `Secure` y el prefijo `__Host-`; usa HTTPS. Si frontend y API están en sitios distintos, configura `SESSION_COOKIE_SAME_SITE=none` solo en producción con HTTPS para ambos. Si TLS termina en proxy, configura `TRUST_PROXY=1` únicamente si el backend solo recibe tráfico de ese proxy.

Las mutaciones requieren token CSRF y un `Origin` igual a `FRONTEND_ORIGIN`; CORS no usa comodines. El límite es cinco intentos fallidos por IP cada 15 minutos. El almacén de sesión en archivos y el limitador predeterminado son locales a una instancia; para varias instancias se requiere almacenamiento compartido.

## Pruebas

Desde `biblioteca-back`, ejecuta `pnpm test`. Las pruebas cubren la vinculación de credenciales al ID creado, rechazo de roles normales, provisión a bibliotecarios existentes, validación de contraseñas y recuperación sin duplicados. Para validar también el frontend, ejecuta `pnpm run lint` y `pnpm run build` desde `biblioteca-front`.
