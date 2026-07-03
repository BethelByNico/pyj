# 💰 R2 Finanzas

Centro de administración financiera familiar de **Julieth & Felipe**. Aplicación web instalable (PWA) construida con HTML, CSS y JavaScript puro, con **Google Sheets** como base de datos a través de **Google Apps Script**, y publicable gratis en **GitHub Pages**.

Funciona en iPhone, iPad y computador. Diseño premium con glassmorphism, modo claro/oscuro y navegación tipo iOS.

---

## ✨ Qué incluye

- **Acceso con contraseña** (`185463`) y sesión que permanece iniciada.
- **Dashboard familiar** con selector *Familia / Julieth / Felipe* (familiar por defecto).
- **Centro Financiero**: patrimonio disponible, distribución del dinero por cuenta, semáforo financiero.
- **Cuentas**: Davivienda, Lulo Bank, Nequi, Daviplata y Efectivo, con saldo independiente y saldo por persona.
- **Registro de salario** con cálculo automático de **Diezmo (10%)**, **Ahorro (20%)** y **Disponible**.
- **Gastos** con categoría, cuenta, método de pago y descuento automático del saldo.
- **Transferencias entre cuentas** y **Retiro de efectivo** (mueven el saldo automáticamente).
- **Servicios y obligaciones** con estados (Pendiente/Pagado/Vencido), botón **Ir a pagar** a los portales, recordatorios para pagos por app bancaria y **fecha oportuna de pago editable** en cada obligación.
- **Deudas y créditos**: registra cuánto debes con cada entidad; cada abono descuenta la cuenta y reduce el saldo, y al llegar a $0 la deuda queda **Saldada ✅**. Incluye barra de avance, cuota, día de pago y monto restante.
- **Calendario de vencimientos** que reúne servicios y deudas por fecha, con aviso de “hoy / mañana / en X días”.
- **Metas de ahorro** con progreso, abonos y monto restante.
- **Análisis inteligente**: comparativos mes a mes, promedio diario, proyección de fin de mes, gasto atípico.
- **Gastos hormiga**: detecta compras pequeñas repetitivas y estima el ahorro potencial.
- **Historial** con filtros por mes, usuario, categoría y cuenta, y **exportación a CSV** (compatible con Excel).
- **Gráficos** interactivos (dona, barras, líneas) con Chart.js.
- **Búsqueda global**, confirmación antes de eliminar, notificaciones y **modo offline**.

> **Offline-first:** la app guarda todo en el dispositivo y, cuando conectas Google Sheets, sincroniza automáticamente. Puedes empezar a usarla **de una vez**, aún sin backend.

---

## 📁 Archivos del proyecto

```
r2-finanzas/
├── index.html          Estructura de la app
├── styles.css          Diseño (glassmorphism, claro/oscuro, responsive)
├── script.js           Lógica: estado, API, vistas, análisis, gráficos
├── manifest.json       Configuración PWA
├── service-worker.js   Funcionamiento sin conexión
├── appsscript.gs       Backend (Google Apps Script)
├── README.md           Esta guía
└── icons/              Íconos de la app
```

---

## 🚀 Guía de implementación (paso a paso)

### 1) Crear el Google Sheets

1. Entra a [sheets.google.com](https://sheets.google.com) con **tu cuenta de Google** y crea una **hoja de cálculo nueva**.
2. Nómbrala, por ejemplo, **“R2 Finanzas – Datos”**.
3. No necesitas crear pestañas a mano: el siguiente paso las genera automáticamente.

### 2) Configurar Google Apps Script como API

1. En la hoja, abre el menú **Extensiones → Apps Script**.
2. Borra el contenido de ejemplo y **pega todo el contenido de `appsscript.gs`**.
3. Guarda (💾).
4. En la lista de funciones (arriba), selecciona **`setup`** y presiona **Ejecutar** ▶️.
   - Google pedirá permisos la primera vez: **Revisar permisos → elige tu cuenta → Avanzado → Ir a (nombre del proyecto) → Permitir**.
   - Esto crea automáticamente las hojas: *Configuracion, Salarios, Gastos, Transferencias, Ahorros, Servicios, Metas, SaldosIniciales, Deudas*.

   > **¿Ya lo habías configurado antes?** Si actualizas a esta versión (con el módulo de Deudas), vuelve a pegar `appsscript.gs`, guarda y ejecuta **`setup`** otra vez. No borra nada: solo crea la hoja **Deudas** y agrega la columna que faltaba. Luego actualiza la implementación: **Implementar → Administrar implementaciones → Editar (✏️) → Nueva versión → Implementar**.
5. Publica la API: **Implementar → Nueva implementación**.
   - Tipo (⚙️): **Aplicación web**.
   - **Ejecutar como:** *Yo (tu cuenta)*.
   - **Quién tiene acceso:** **Cualquier persona**.
   - **Implementar** y **copia la URL** que termina en **`/exec`**.

> La opción “Cualquier persona” permite que la app lea/escriba; la contraseña `185463` viaja como token y solo ustedes conocen la dirección. Para máxima privacidad, ver **Seguridad** más abajo.

### 3) Conectar la app con Google Sheets

1. Abre `script.js`.
2. En la parte superior, pega tu URL en `API_URL`:
   ```js
   const CONFIG = {
     API_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
     PASSWORD: '185463',
     ...
   };
   ```
3. Guarda el archivo.

> Si dejas `API_URL` vacío, la app funciona 100% local en el dispositivo (sin sincronizar). Útil para probar.

### 4) Publicar en GitHub Pages

1. Crea una cuenta en [github.com](https://github.com) (si no tienes) y un **repositorio nuevo**, por ejemplo `r2-finanzas` (público).
2. Sube **todos los archivos** de la carpeta (incluida la carpeta `icons/`).
   - Fácil por web: en el repo → **Add file → Upload files** → arrastra todo → **Commit changes**.
3. Ve a **Settings → Pages**.
4. En **Source**, elige **Deploy from a branch**, rama **main** y carpeta **/ (root)** → **Save**.
5. Espera ~1 minuto. GitHub te dará una URL como:
   `https://tu-usuario.github.io/r2-finanzas/`
6. Abre esa URL: verás la pantalla de acceso. Ingresa `185463`.

### 5) Instalar la PWA en iPhone / iPad

1. Abre la URL en **Safari** (no en otro navegador).
2. Toca el botón **Compartir** (cuadro con flecha ⬆️).
3. Elige **Agregar a pantalla de inicio**.
4. Confirma el nombre **R2 Finanzas** y toca **Agregar**.
5. Se instalará con su ícono y se abrirá a pantalla completa, como una app nativa.

> En computador (Chrome/Edge) también puedes instalarla con el ícono **Instalar** de la barra de direcciones.

### 6) Actualizaciones futuras sin perder información

- **Tus datos viven en Google Sheets**, no en el código. Puedes actualizar la app cuantas veces quieras sin perder nada.
- Para actualizar: reemplaza los archivos en GitHub (**Upload files** sobre los existentes → Commit). GitHub Pages publica la nueva versión en segundos.
- La app tiene versión de caché (`r2-finanzas-v1` en `service-worker.js`). Si haces cambios grandes y quieres forzar la actualización en los iPhone, **sube el número** (por ejemplo `r2-finanzas-v2`) y vuelve a subir el archivo.
- Nunca ejecutes `setup()` de forma que borre datos: solo **crea** hojas que falten, no elimina las existentes.

---

## 🔐 Seguridad y privacidad

- La contraseña se valida en el dispositivo para dar acceso rápido a **ustedes dos**; no es un sistema de cuentas públicas.
- Toda la información queda **en tu cuenta de Google** (tu hoja de cálculo), no en servidores de terceros.
- Recomendaciones:
  - No compartas la URL de GitHub Pages ni la URL `/exec` públicamente.
  - Si quieres cerrar por completo el acceso a la API, en Apps Script puedes cambiar “Quién tiene acceso” a *Solo yo* y usar la app únicamente en modo local, o mantener “Cualquier persona” confiando en que la dirección es secreta.

---

## 🧮 Cómo se calculan las cosas

- **Saldo de cada cuenta** = saldo inicial (lo defines en *Cuentas → Ajustar saldo*) + salarios que ingresaron a esa cuenta + transferencias recibidas − gastos − transferencias enviadas − retiros.
- **Retirar efectivo** es una transferencia del banco a *Efectivo*.
- **Disponible del mes** = Salario − Diezmo (10%) − Ahorro (20%) − Gastos del mes.
- **Saldo de una deuda** = valor total registrado − suma de todos los abonos. Cada abono es también un gasto que descuenta la cuenta elegida. Al llegar a $0 queda **Saldada**.
- **Día de pago**: para deudas defines un día del mes (1-31) y la app calcula el próximo vencimiento; para servicios editas la fecha exacta con el botón ✏️.
- **Patrimonio** = suma de los saldos de todas las cuentas (según la vista: familia o persona). Las deudas se muestran aparte como “por pagar”.
- **Total ahorrado** y **metas** se muestran aparte para no “duplicar” dinero que ya está en las cuentas.

**Primer uso recomendado:** entra a **Cuentas → Ajustar saldo** y registra el saldo real actual de cada cuenta de Julieth y de Felipe. A partir de ahí, cada gasto, transferencia o retiro actualiza los saldos automáticamente.

---

## 🛠️ Personalización rápida

Todo está al inicio de `script.js`:

- `CONFIG.PASSWORD` – cambiar la contraseña.
- `CONFIG.ANT_THRESHOLD` – umbral de “gasto hormiga” (por defecto $20.000).
- `ACCOUNTS` – cuentas, ícono y color.
- `CATEGORIES` – categorías, ícono, color y si son gasto fijo.
- `SERVICES_CATALOG` – servicios y sus portales de pago.

---

## ❓ Solución de problemas

- **“Usando datos locales” siempre:** revisa que `API_URL` termine en `/exec` y que la implementación sea **Aplicación web** con acceso **Cualquier persona**.
- **No sincroniza al escribir:** vuelve a *Inicio → Ajustes → Sincronizar*. La app reintenta sola al recuperar conexión.
- **Los íconos no aparecen en el iPhone:** confirma que subiste la carpeta `icons/` completa a GitHub.
- **Cambié el código y no se actualiza en el iPhone:** sube la versión del caché en `service-worker.js` (v1 → v2) y recarga.

---

Hecho con cariño para que Julieth y Felipe tomen mejores decisiones financieras. 💚
