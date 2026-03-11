# Patrón de diseño y arquitectura

Este proyecto sigue una **arquitectura en capas (Layered Architecture)** combinada con un enfoque **API-first** y **monorepo**, adecuada para una aplicación web desplegable en Azure App Service.

---

## 1. Patrón global: arquitectura en capas

El backend se organiza en capas con responsabilidades claras:

```
┌─────────────────────────────────────────────────────────┐
│  Capa de presentación (API)                              │
│  routes/ → endpoints REST, validación entrada/salida     │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Capa de aplicación / servicios                          │
│  services/ → lógica de negocio, integraciones externas   │
│  (auth, blob, JWT, Entra ID, Graph)                      │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Capa de datos                                           │
│  models/ + database.py → entidades, persistencia (ORM)    │
└─────────────────────────────────────────────────────────┘
```

- **Rutas** no contienen lógica de negocio pesada: orquestan llamadas a servicios y a la base de datos, y devuelven DTOs (Pydantic).
- **Servicios** encapsulan reglas e integraciones (auth, storage, auditoría).
- **Modelos** definen el dominio y el esquema de persistencia; la capa de datos se concentra en `database.py` y en el uso de SQLAlchemy.

Este reparto encaja con FastAPI, Azure (Blob, Entra ID) y PostgreSQL, y escala bien a un equipo pequeño o a futuras ampliaciones (más rutas o servicios).

---

## 2. Cómo se mapea el código al patrón

| Capa / concepto        | Ubicación        | Rol |
|------------------------|------------------|-----|
| **Entrada HTTP**       | `main.py`        | Monta la API en `/api`, sirve estáticos del frontend, CORS. |
| **Composición**        | `backend/app.py` | Crea la app FastAPI, lifespan, registra routers. |
| **Presentación (API)** | `backend/routes/` | `health`, `auth`, `catalog`, `logs`: definen contratos REST y usan dependencias (auth, roles). |
| **Aplicación**         | `backend/services/` | `auth_service`, `blob_storage`, `jwt_session`: lógica e integraciones (Entra ID, Graph, Blob, JWT). |
| **Datos / dominio**    | `backend/models/` + `backend/database.py` | Entidades (User, Catalog, UserLog, CatalogLog) y sesión async (AsyncSessionLocal). |
| **Cross-cutting**      | `backend/dependencies.py` | Autenticación y autorización (usuario actual, roles); inyectables en rutas. |
| **Configuración**      | `backend/config.py` | Variables de entorno y configuración centralizada. |

El flujo típico es: **Request → Router → Dependencies (auth) → Servicios / DB → Response**. No hay una capa “de dominio” pura separada (sin ORM); el dominio está en los modelos y en el uso que hacen de ellos las rutas y los servicios, lo que es coherente con un patrón en capas clásico.

---

## 3. Frontend: componente + contexto + API

- **Componentes** (`frontend/src/components/`): UI reutilizable (RegionSelector, FilePreview, etc.).
- **Contexto** (`AuthContext`): estado global de autenticación y datos de usuario.
- **Cliente API** (`lib/api.ts`): centraliza llamadas al backend (`/api/...`).
- **Lógica de IA** (`lib/gemini.ts`): llamada directa a Gemini desde el cliente; el backend solo expone configuración (`/api/config`).

No se usa un patrón formal tipo “Clean Architecture” en el frontend; es una estructura **orientada a componentes y a API**, adecuada para el tamaño actual del producto.

---

## 4. Principios que se respetan

- **Separación de responsabilidades**: rutas, servicios y datos están separados por carpetas y roles.
- **Configuración por entorno**: `config.py` + `.env` / App Service; no secretos en código.
- **API como contrato**: el frontend depende del contrato REST (`/api/...`), no de detalles internos del backend.
- **Autorización por roles**: `require_role` y `RequireAdmin` en dependencias; las rutas declaran qué rol exigen.
- **Auditoría**: acciones relevantes (login, CRUD catálogo) se registran en tablas de log (user_logs, catalog_logs).

---

## 5. ¿Encaja con Azure y el resto del stack?

Sí. Este patrón se adapta bien a:

- **App Service**: una sola app (FastAPI) que sirve API + estáticos.
- **PostgreSQL**: acceso a través de una única capa de datos (ORM + sesión).
- **Blob Storage**: abstraído en un servicio (`blob_storage`); las rutas no conocen detalles de Azure.
- **Entra ID**: encapsulado en `auth_service` + MSAL; las rutas solo usan “usuario actual” y roles.
- **GitHub / CI**: el monorepo y la separación por capas facilitan tests y despliegues (backend + build del frontend).

Si más adelante quieres endurecer la capa de datos (por ejemplo con un **patrón Repository** sobre los modelos), se puede hacer sin cambiar la estructura de rutas ni la forma en que el frontend consume la API.
