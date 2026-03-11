# Despliegue en Azure App Service – Guía completa

Esta guía cubre: App Service, PostgreSQL, Blob Storage, GitHub y dónde configurar la API key de Gemini.

---

## 1. Resumen de recursos Azure que necesitas

| Recurso | Uso |
|--------|-----|
| **App Service** (plan + app web) | Ejecuta tu app (Python + frontend estático). |
| **Azure Database for PostgreSQL** | Base de datos (usuarios, catálogo, logs). |
| **Storage Account** (Blob) | Guardar imágenes/PDFs del catálogo. |
| **Microsoft Entra ID (Azure AD)** | Login y roles (opcional; puedes usar solo `DEV_SKIP_AUTH` al inicio). |
| **GitHub** | Repositorio + opcionalmente GitHub Actions para desplegar. |

---

## 2. Crear los recursos en Azure

### 2.1 Azure Database for PostgreSQL

1. En el portal: **Crear un recurso** → buscar **Azure Database for PostgreSQL**.
2. Elige **Servidor flexible** (Flexible Server).
3. Configuración mínima:
   - **Suscripción y grupo de recursos** (crea uno, ej. `rg-labeldiff`).
   - **Nombre del servidor**: `labeldiff-pg` (o el que quieras; quedará `labeldiff-pg.postgres.database.azure.com`).
   - **Región**: la misma que tu App Service.
   - **Versión**: 16.
   - **Carga de trabajo**: Desarrollo (o Producción si lo necesitas).
   - **Cómputo y almacenamiento**: el plan más bajo suele bastar para empezar.
   - **Autenticación**: contraseña (o “Azure AD” si quieres login con identidad administrada).
4. En **Configuración del servidor**:
   - **Nombre de usuario del administrador**: `labeldiffadmin` (o el que elijas).
   - **Contraseña**: una contraseña segura (guárdala).
5. En **Redes**:
   - **Conectividad**: acceso público permitido (o Red privada si usas VNet).
   - Si es público: habilita **Permitir acceso público desde cualquier servicio de Azure dentro de Azure a este servidor** para que App Service pueda conectarse.
6. Crear. Cuando esté listo, anota:
   - **Nombre del host**: `labeldiff-pg.postgres.database.azure.com`
   - **Usuario**: `labeldiffadmin`
   - **Contraseña**: la que pusiste.
   - **Base de datos**: por defecto `postgres`; crea una para la app, ej. `labeldiff`:
     - En el recurso PostgreSQL → **Bases de datos** → **Agregar** → nombre: `labeldiff`.

**Cadena de conexión para la app:**

```
postgresql+asyncpg://labeldiffadmin:TU_CONTRASEÑA@labeldiff-pg.postgres.database.azure.com:5432/labeldiff?sslmode=require
```

(En Azure PostgreSQL flexible suele ser obligatorio SSL; `sslmode=require` es lo habitual.)

---

### 2.2 Cuenta de almacenamiento (Blob Storage)

1. **Crear un recurso** → **Cuenta de almacenamiento**.
2. Grupo de recursos: el mismo (ej. `rg-labeldiff`).
3. **Nombre**: `stlabeldiff` (debe ser único globalmente; si no está libre, prueba `stlabeldiff123`).
4. **Región**: la misma que App Service y PostgreSQL.
5. **Rendimiento**: estándar. **Redundancia**: LRS (o superior si lo necesitas).
6. Crear.
7. Dentro de la cuenta de almacenamiento:
   - **Contenedores** → **+ Contenedor** → nombre: `etiquetas` (o el que uses en la app) → Crear.
8. Obtener la cadena de conexión:
   - **Claves de acceso** (en el menú izquierdo) → **Clave 1** → **Cadena de conexión** → copiar.

Esa cadena la usarás como `AZURE_STORAGE_CONNECTION_STRING` en App Service.

---

### 2.3 App Service (donde va tu código y la API key de Gemini)

1. **Crear un recurso** → **Aplicación web**.
2. **Suscripción y grupo de recursos**: el mismo.
3. **Nombre**: `labeldiff-app` (o el que quieras; la URL será `https://labeldiff-app.azurewebsites.net`).
4. **Publicar**: Código.
5. **Pila en tiempo de ejecución**: **Python 3.11** (o 3.12 si está disponible).
6. **Sistema operativo**: Linux (recomendado) o Windows.
7. **Región**: la misma que PostgreSQL y Storage.
8. **Plan de App Service**: crear uno nuevo (ej. B1 para pruebas) o usar uno existente.
9. Crear.

---

## 3. Configuración de la App Service (Variables y Gemini)

Aquí es **donde debes meter la API key de Gemini** y el resto de la configuración. No la pongas en el código ni en el repositorio.

1. En el portal, entra en tu **App Service** (`labeldiff-app`).
2. Menú izquierdo: **Configuración** → **Configuración de la aplicación** (Application settings).
3. **+ Nueva configuración de la aplicación** y añade cada variable. En “Configuración de la aplicación” se traducen a variables de entorno para tu app.

### Variables obligatorias / recomendadas

| Nombre | Valor | Notas |
|--------|--------|--------|
| `ENV` | `production` | Para que la app no use modo desarrollo. |
| `SECRET_KEY` | Una cadena larga y aleatoria | Para firmar la sesión JWT. Genera una con: `python -c "import secrets; print(secrets.token_urlsafe(32))"`. |
| `DATABASE_URL` | `postgresql+asyncpg://labeldiffadmin:TU_CONTRASEÑA@labeldiff-pg.postgres.database.azure.com:5432/labeldiff?sslmode=require` | Sustituye `TU_CONTRASEÑA` por la contraseña real del usuario de PostgreSQL. |
| `AZURE_STORAGE_CONNECTION_STRING` | La cadena de conexión de la cuenta de almacenamiento | La que copiaste en “Claves de acceso”. |
| `AZURE_STORAGE_CONTAINER` | `etiquetas` | Nombre del contenedor que creaste. |
| **`GEMINI_API_KEY`** | **Tu API key de Gemini** | **Aquí es donde se configura la API key de Gemini.** La app la lee como variable de entorno. |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Modelo que expone el backend al frontend vía `/api/config`. Si obtienes 404, usa `gemini-1.5-flash` o `gemini-1.5-pro`. |
| `GEMINI_API_KEY_EXPOSE` | `true` | Debe ser `true` para que el análisis funcione: el frontend obtiene la clave vía `GET /api/config` y llama a la API de Gemini desde el navegador. Sin esto, "Ejecutar Análisis" fallará. |

### Si usas login con Microsoft (Entra ID)

| Nombre | Valor |
|--------|--------|
| `AZURE_AD_CLIENT_ID` | ID de la aplicación (cliente) del registro de app. |
| `AZURE_AD_CLIENT_SECRET` | Secreto del cliente. |
| `AZURE_AD_TENANT_ID` | ID del inquilino (tenant). |
| `AZURE_AD_REDIRECT_URI` | `https://labeldiff-app.azurewebsites.net/api/auth/callback` (sustituye por tu URL real). |
| `AZURE_AD_GROUP_ADMIN` | IDs de grupos de Azure AD para rol admin (separados por coma). |
| `AZURE_AD_GROUP_USER` | IDs de grupos para rol user. |
| `AZURE_AD_GROUP_VIEWER` | IDs de grupos para rol viewer. |
| `SESSION_SAME_SITE` | `None` |
| `SESSION_SECURE` | `true` |

Si no usas Entra ID al principio, no hace falta configurar estas; puedes usar solo base de datos y Blob.

### Resumen: dónde va la API key de Gemini y qué configurar en App Service

- **Dónde meter la API key de Gemini:** en la **App Service** → **Configuración** → **Configuración de la aplicación** → nueva entrada **`GEMINI_API_KEY`** con el valor de tu clave.
- **Qué configurar en App Service:** además de `GEMINI_API_KEY` y `GEMINI_MODEL`, las variables anteriores: `ENV`, `SECRET_KEY`, `DATABASE_URL`, `AZURE_STORAGE_*`, y las de Azure AD si usas login. No hace falta “activar” nada extra en App Service para que lea estas variables; las inyecta como entorno.

Guarda los cambios en “Configuración de la aplicación” (Guardar arriba).

---

## 4. Desplegar el código en App Service

Tienes dos formas típicas: **GitHub + despliegue continuo** o **despliegue manual (ZIP / CLI)**.

### 4.1 Opción A: Conectar GitHub y desplegar con GitHub Actions

El proyecto incluye un workflow en **`.github/workflows/azure-app-service.yml`** que:

- Hace **checkout** del repo y **construye el frontend** en el mismo runner (`npm ci` + `npm run build` en `frontend/`), generando `frontend/dist/` dentro del árbol del repo (no se commitea; está en `.gitignore`).
- **Despliega el directorio actual** (repo completo con `frontend/dist/` ya creado) a la App Service con `azure/webapps-deploy@v3`. No se usa un zip custom: se sube todo en un solo paso (backend + frontend/dist).
- El backend (`main.py`) sirve la API en `/api/*` y el SPA desde `frontend/dist/` (estáticos + `index.html`). Un solo App Service sirve ambos.

**Pasos:**

1. **Sube el proyecto a GitHub** (crea un repo y haz push de tu código, incluido `.github/workflows/azure-app-service.yml`).

2. **Obtén el perfil de publicación de la App Service:**
   - En el portal: tu **App Service** → **Centro de implementación** (o **Descripción general**) → **Descargar perfil de publicación** (Download publish profile).
   - Se descarga un archivo `.PublishSettings`.

3. **Añade el secreto en GitHub:**
   - Repositorio → **Settings** → **Secrets and variables** → **Actions**.
   - **New repository secret**.
   - Nombre: `AZURE_WEBAPP_PUBLISH_PROFILE`.
   - Valor: abre el archivo `.PublishSettings` descargado con un editor de texto y **copia todo el contenido** (es XML) y pégalo en el valor del secreto.

4. **Nombre de la App Service en el workflow:**  
   Abre `.github/workflows/azure-app-service.yml` y cambia la línea `AZURE_WEBAPP_NAME: labeldiff-app` por el nombre real de tu App Service si es distinto.

5. Haz **push a la rama `main`**. El workflow se ejecutará, construirá el frontend y desplegará en Azure. Puedes ver el progreso en la pestaña **Actions** del repo.

### 4.2 Opción B: Despliegue manual (ZIP) desde tu PC

1. En tu máquina, en la raíz del proyecto:

```bash
cd frontend
npm ci
npm run build
cd ..
```

2. Crea un ZIP que contenga (en la raíz del ZIP):
   - `main.py`
   - `requirements.txt`
   - carpeta `backend/`
   - carpeta `frontend/dist/` (generada en el pipeline, no en el repo)
   (No incluyas `node_modules`, `.venv`, `.env`, etc.)

3. En el portal: **App Service** → **Implementación** → **ZIP Deploy** (o usa Azure CLI):

```bash
az webapp deployment source config-zip --resource-group rg-labeldiff --name labeldiff-app --src ruta/al/archivo.zip
```

(Necesitas tener instalado e iniciado sesión en Azure CLI: `az login`.)

---

## 5. Configurar el stack de inicio en App Service (Python)

Para que App Service ejecute tu app Python correctamente:

1. **App Service** → **Configuración** → **Configuración general**:
   - **Pila**: Python 3.11 (o 3.12).
   - **Comando de inicio** (Startup Command): por ejemplo:
     ```bash
     pip install -r requirements.txt && python main.py
     ```
     O si usas Gunicorn (recomendado en Linux):
     ```bash
     pip install -r requirements.txt && gunicorn main:app --bind 0.0.0.0:8000 --worker-class uvicorn.workers.UvicornWorker
     ```
   - En Linux, el puerto que escucha la app debe ser el que App Service inyecta en la variable `PORT`. Si tu `main.py` usa `PORT` del entorno, asegúrate de que lee `os.getenv("PORT", "8000")` (ya lo hace tu código).

2. Guarda los cambios.

---

## 6. PostgreSQL: permitir conexiones desde App Service

- En el recurso **Azure Database for PostgreSQL (Flexible Server)** → **Redes**:
  - Si usas **acceso público**: añade la regla **Permitir acceso público desde cualquier servicio de Azure dentro de Azure a este servidor** (o añade las IP outbound de App Service si las tienes).
- Si la conexión falla, revisa firewall y que `DATABASE_URL` use `?sslmode=require` al final.

---

## 7. Blob Storage: ya está listo

- Con `AZURE_STORAGE_CONNECTION_STRING` y `AZURE_STORAGE_CONTAINER` configurados en App Service, la app podrá subir y generar SAS. No hace falta configurar CORS en el Storage para que funcione la API desde tu dominio; las peticiones van desde el servidor (backend).

---

## 8. Resumen rápido: checklist

- [ ] Crear **Azure Database for PostgreSQL** (flexible), crear base de datos `labeldiff`, anotar host, usuario, contraseña.
- [ ] Crear **Cuenta de almacenamiento** y contenedor `etiquetas`, copiar **cadena de conexión**.
- [ ] Crear **App Service** (Python 3.11+).
- [ ] En App Service → **Configuración de la aplicación**: añadir `DATABASE_URL`, `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER`, **`GEMINI_API_KEY`**, `GEMINI_MODEL`, `SECRET_KEY`, `ENV=production`.
- [ ] Configurar **comando de inicio** (pip install + python main.py o gunicorn).
- [ ] Usar **solo** el workflow de GitHub Actions para desplegar (no el “sync desde GitHub” del Centro de implementación, que no ejecuta el build y no incluye `frontend/dist/`). El workflow construye el frontend y despliega el repo completo; el backend sirve API + SPA.
- [ ] En PostgreSQL → Redes: permitir acceso desde Azure / App Service.

Con esto tienes desplegada la app en App Service, con PostgreSQL, Blob y la API key de Gemini configurada solo en App Service (sin ponerla en código ni en GitHub).
