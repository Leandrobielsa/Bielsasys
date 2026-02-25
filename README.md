# BielsaSys — Sistema B2B Hortofrutícola

## 🚀 Cómo arrancarlo

### Requisitos
- Node.js instalado (descarga en https://nodejs.org)

### Pasos

1. Descomprime la carpeta `bielsasys` donde quieras
2. Abre una terminal dentro de esa carpeta
3. Ejecuta:

```bash
node server.js
```

4. Abre el navegador:
   - **Tienda B2B:** http://localhost:3000
   - **Panel Admin:** http://localhost:3000/admin
   - **API directa:** http://localhost:3000/api/products

---

## 📁 Estructura de archivos

```
bielsasys/
├── server.js          ← Backend (API + servidor web)
├── db.json            ← Base de datos (se crea sola al primer arranque)
└── public/
    ├── index.html     ← Tienda frontend
    └── admin.html     ← Panel de administración
```

---

## 🔧 API REST

| Método | Ruta                   | Descripción             |
|--------|------------------------|-------------------------|
| GET    | /api/products          | Listar todos los productos |
| POST   | /api/products          | Añadir un producto nuevo |
| DELETE | /api/products/:id      | Eliminar un producto    |

### Ejemplo POST (añadir producto)
```json
{
  "name": "Sandía sin pepitas",
  "category": "fruta",
  "emoji": "🍉",
  "price": 0.35,
  "unit": "kg",
  "origin": "Almería",
  "minOrder": "50 kg",
  "badge": "Temporada",
  "badgeType": ""
}
```

---

## 🌐 Migrar a MariaDB (siguiente paso del proyecto ASIR)

Cuando tengas MariaDB instalado en Proxmox, el único archivo a modificar es `server.js`.
Sustituye las funciones `readDB()` / `writeDB()` por consultas SQL usando el módulo `mysql2`.

La estructura de tabla equivalente:
```sql
CREATE TABLE products (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  category  VARCHAR(50),
  emoji     VARCHAR(10),
  price     DECIMAL(10,2),
  unit      VARCHAR(20),
  origin    VARCHAR(100),
  badge     VARCHAR(50),
  badgeType VARCHAR(20),
  minOrder  VARCHAR(30),
  stock     BOOLEAN DEFAULT TRUE
);
```

---

Proyecto ASIR · Leandro Bielsa Raro · 2025
