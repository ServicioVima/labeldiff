# Testear en local

Pasos para ejecutar backend + frontend en tu máquina sin Azure AD ni Blob (opcional).

## Requisitos

- **Python 3.11+** y **Node.js 18+**
- **Docker** (para PostgreSQL) o PostgreSQL instalado
- **Clave de Gemini** (para el análisis con IA)

---

## 1. Base de datos (PostgreSQL)

### Opción A: Docker

```bash
docker-compose up -d
```

Usa por defecto: `postgresql+asyncpg://labeldiff:labeldiff@localhost:5432/labeldiff`.

### Opción B: PostgreSQL instalado

Crea una base de datos `labeldiff` y un usuario con permisos. Ejemplo:

```bash
psql -U postgres -c "CREATE USER labeldiff WITH PASSWORD 'labeldiff';"
psql -U postgres -c "CREATE DATABASE labeldiff OWNER labeldiff;"
```

---

## 2. Variables de entorno

Copia y ajusta (al menos para local):

```bash
cp .env.example .env
```

Edita `.env` y deja algo así para **solo local**:

```env
ENV=development
SECRET_KEY=una-clave-secreta-cualquiera-para-local
DATABASE_URL=postgresql+asyncpg://labeldiff:labeldiff@localhost:5432/labeldiff

# Sin Azure AD: la app usa un usuario "dev" automático
DEV_SKIP_AUTH=true

# Sin Blob: dejar vacío (el catálogo con subida de archivos fallará; el resto y la comparación con IA funcionan)
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER=etiquetas

# Gemini: necesaria para "Ejecutar Análisis"
GEMINI_API_KEY=tu_clave_de_gemini
GEMINI_MODEL=gemini-2.0-flash
# Opcional: que el frontend reciba la clave vía /api/config
GEMINI_API_KEY_EXPOSE=true
```

- Con **DEV_SKIP_AUTH=true** no hace falta login: se usa un usuario dev (admin) y puedes probar catálogo y logs.
- **GEMINI_API_KEY** es necesaria para que el botón "Ejecutar Análisis" funcione.

---

## 3. Backend

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate      # Linux/macOS

pip install -r requirements.txt
python main.py
```

Deberías ver algo como: `Uvicorn running on http://0.0.0.0:8000`.

Comprueba: [http://localhost:8000/api/health](http://localhost:8000/api/health) → `{"status":"ok",...}`.

---

## 4. Frontend (desarrollo)

En **otra terminal**:

```bash
cd frontend
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). El proxy redirige `/api` al backend en el puerto 8000.

---

## 5. Qué puedes probar

| Funcionalidad              | Sin Azure AD (DEV_SKIP_AUTH) | Sin Blob |
|---------------------------|-------------------------------|----------|
| Comparación (2 archivos + IA) | Sí                            | Sí       |
| Login / sesión            | No (usuario dev automático)   | -        |
| Catálogo: listar          | Sí                            | Sí       |
| Catálogo: crear (subir archivos) | Sí                        | No (falta Blob) |
| Logs (admin)              | Sí                            | Sí       |

Para probar **todo** (login real, subida a Blob): configura Azure AD y Azure Storage en `.env` y quita `DEV_SKIP_AUTH` o ponlo en `false`.

---

## 6. Simular producción (una sola app)

Para servir API + SPA desde el mismo proceso (como en App Service):

```bash
cd frontend
npm run build
cd ..
python main.py
```

Abre [http://localhost:8000](http://localhost:8000). La API sigue en `http://localhost:8000/api/...`.
