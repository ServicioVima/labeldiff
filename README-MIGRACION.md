# LabelDiff – Arquitectura de producción (Azure App Service)

Migración a monorepo con backend FastAPI, frontend React (Vite), PostgreSQL, Azure Blob y Microsoft Entra ID.

## Estructura

```
/
├── main.py                 # Entrada: monta API en /api y sirve frontend en /
├── requirements.txt        # Dependencias Python
├── .env.example            # Variables de entorno (copiar a .env)
├── backend/
│   ├── app.py              # FastAPI app, rutas bajo /api
│   ├── config.py           # Settings desde env
│   ├── database.py         # SQLAlchemy async + PostgreSQL
│   ├── dependencies.py     # Auth (cookie/JWT) y require_role
│   ├── models/             # User, Catalog, UserLog, CatalogLog
│   ├── routes/             # health, auth, catalog, logs
│   └── services/           # auth_service (msal), blob_storage, jwt_session
└── frontend/               # React (Vite) + Tailwind + Framer Motion + Lucide
    ├── src/
    │   ├── lib/            # gemini.ts (llamada directa a Gemini), api.ts
    │   ├── components/     # RegionSelector, FilePreview, ComparisonSlider, LabelManager
    │   └── contexts/       # AuthContext
    └── dist/               # Build (generado con npm run build)
```

## API (`/api`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /health | Estado del sistema |
| GET | /config | Config Gemini (modelo; opcionalmente apiKey) |
| GET | /auth/login | Redirige a Microsoft Entra ID |
| GET | /auth/callback | Callback OAuth, setea cookie de sesión |
| GET | /auth/me | Usuario actual (cookie/Bearer) |
| GET | /catalog | Listar catálogo (filtros: name, version, client) |
| POST | /catalog | Crear (multipart: name, version, client, instructions, reference_file, new_version_file) |
| PUT | /catalog/{id} | Actualizar |
| DELETE | /catalog/{id} | Borrado lógico (solo admin) |
| GET | /catalog/sas?blob_path= | URL SAS temporal para un blob |
| GET | /logs/user | Historial user_logs (solo admin) |
| GET | /logs/catalog | Historial catalog_logs (solo admin) |

## Cómo ejecutar

### 1. Backend (Python)

```bash
cp .env.example .env
# Editar .env: DATABASE_URL, Azure AD, Blob, SECRET_KEY, etc.

python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
python main.py
# Servidor en http://localhost:8000
```

### 2. Frontend (desarrollo con proxy al backend)

```bash
cd frontend
npm install
npm run dev
# Frontend en http://localhost:3000; /api se redirige a :8000
```

### 3. Producción (una sola app)

```bash
cd frontend
npm run build
cd ..
python main.py
# Sirve API en /api y SPA en / (desde frontend/dist)
```

## Autenticación (Microsoft Entra ID)

- **Login:** el usuario abre `/api/auth/login` y es redirigido a Microsoft.
- **Callback:** tras autorizar, Microsoft redirige a `/api/auth/callback?code=...`; el backend intercambia el código por tokens, obtiene grupos vía Microsoft Graph, asigna rol (admin > user > viewer) según IDs de grupo en `.env`, crea/actualiza usuario en DB, registra en `user_logs` y setea una cookie HttpOnly con JWT de sesión.
- **Cookie:** nombre en `SESSION_COOKIE_NAME`; en Azure usar `SameSite=None` y `Secure=true` si el frontend está en otro dominio.

## Base de datos (PostgreSQL)

- **Users:** id, email, name, last_login, role, azure_oid.
- **Catalog:** name, version, client, metadata_json, reference_blob_path, new_version_blob_path, instructions, created_by_id, deleted_at.
- **user_logs:** user_id, action (login/logout/activity), details, ip_address, created_at.
- **catalog_logs:** user_id, catalog_id, action (create/update/delete), data_before, data_after, created_at.

Las tablas se crean al arrancar con `init_db()`.

## Azure Blob Storage

- Las imágenes/PDFs del catálogo se suben con `upload_blob()`; en DB se guarda solo el path del blob.
- El frontend obtiene URLs temporales con `GET /api/catalog/sas?blob_path=...` para visualizar sin hacer el contenedor público.

## IA (Gemini) y ROI

- El **frontend** sigue llamando a la API de Gemini con `@google/genai` (latencia).
- El backend expone en `GET /api/config` el modelo y, opcionalmente, la API key.
- **RegionSelector:** el usuario dibuja recuadros; las coordenadas se envían como `[ymin, xmin, ymax, xmax]` normalizadas 0–1000 en el prompt a Gemini.
- El prompt incluye las instrucciones del catálogo (o de la biblioteca local de etiquetas) y las coordenadas de enfoque de ambos archivos.

## Despliegue en Azure App Service

1. Crear **Azure Database for PostgreSQL** y configurar `DATABASE_URL`.
2. Crear **App Registration** en Entra ID, definir redirect URI `https://<tu-app>.azurewebsites.net/api/auth/callback`, y configurar grupos y opcional claims si quieres grupos en el token.
3. Crear **Cuenta de almacenamiento** y contenedor; configurar `AZURE_STORAGE_CONNECTION_STRING` y `AZURE_STORAGE_CONTAINER`.
4. En App Service: configurar variables de entorno desde `.env` (sin subir el archivo).
5. Build: `cd frontend && npm run build`; el artefacto debe incluir `main.py`, `backend/`, `frontend/dist/` y `requirements.txt`.
6. Comando de inicio: `python main.py` o `uvicorn main:app --host 0.0.0.0 --port 8000`.
