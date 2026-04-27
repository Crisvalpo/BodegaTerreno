# Bodega Terreno 🏗️📦

Sistema de gestión de inventario y logística industrial diseñado para el control de materiales de piping en terreno. Esta aplicación permite un seguimiento preciso desde la recepción de materiales hasta su despacho final, optimizando los tiempos de respuesta mediante el uso de códigos QR y automatización de procesos.

## 🚀 Características Principales

### 📋 Gestión de Pedidos e Isométricos
- **Asociación Directa**: Generación de pedidos vinculados estrictamente a códigos isométricos (planos) del proyecto.
- **Flujo de Trabajo Dinámico**: Estados de pedido en tiempo real: `Pendiente`, `Picking`, `Listo` y `Entregado`.
- **Priorización**: Visualización inmediata de pedidos críticos y pendientes del día.

### 🔍 Control de Stock y KPIs
- **Monitoreo en Vivo**: Estadísticas de existencias, productos en tránsito y niveles críticos.
- **Detección de Quiebres**: Identificación automática de demanda insatisfecha (faltantes de stock).
- **Historial Completo**: Registro detallado de cada movimiento (IN/OUT) con trazabilidad de usuario y ubicación.

### 📲 Operaciones con QR
- **ID Digital**: Identificación de operarios mediante tarjetas digitales con código QR.
- **Despacho Ágil**: Escaneo de QR para validación rápida en el "Mesón de Bodega".
- **Ubicaciones Inteligentes**: Sistema de racks, zonas y niveles identificados para un picking eficiente.

### 🛠️ Panel Administrativo Maestro
- **Carga Masiva**: Importación de catálogos de materiales e isométricos desde archivos Excel (XLSX).
- **Mapa de Bodega**: Gestión visual y lógica de la disposición física de la bodega.
- **Auditoría Total**: Exportación de toda la base de datos a Excel para reportes de control y cierre.

## 🛠️ Stack Tecnológico

- **Frontend**: [Next.js 15+](https://nextjs.org) con App Router.
- **Base de Datos & Auth**: [Supabase](https://supabase.com).
- **Estilos**: Tailwind CSS (Dark Mode optimizado).
- **Iconografía**: Lucide React.
- **Utilidades**: 
  - `xlsx` para procesamiento de datos.
  - `html5-qrcode` para lectura de cámaras.
  - `sonner` para notificaciones interactivas.

## 📂 Estructura del Proyecto

- `/src/app/admin`: Herramientas de configuración, usuarios y carga masiva.
- `/src/app/pedidos`: Seguimiento y creación de solicitudes de material.
- `/src/app/recepcion`: Módulo de ingreso de suministros a la bodega.
- `/src/app/meson`: Terminal optimizada para despacho rápido.
- `/src/app/stock`: Consulta de inventario y análisis de KPIs.

## ⚙️ Configuración

### Requisitos Previos
- Node.js 18+ 
- Cuenta en Supabase con las tablas configuradas.

### Variables de Entorno
Crea un archivo `.env.local` con las siguientes claves:
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

### Inicio Rápido
```bash
npm install
npm run dev
```

---
Desarrollado para optimizar la logística de construcción y montaje industrial.

