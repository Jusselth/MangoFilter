# MangoFilter

Comparador de precios **reales** entre tiendas colombianas (Olímpica, Jumbo, Carulla, Pepe Ganga y Panamericana; Mercado Libre es opcional). Muestra el costo total con el envío cotizado a tu ciudad, el tiempo de entrega y el enlace directo a cada tienda.

```bash
npm run install:all   # una vez
npm run backend       # terminal 1: API en http://localhost:3000
npm run frontend      # terminal 2: escanea el QR con Expo Go (misma red Wi-Fi)
npm test              # pruebas de ambos proyectos
```

| Carpeta | Contenido |
|---|---|
| [`backend/`](backend) | API Node + TypeScript + Fastify: adaptadores de tiendas, matching y envíos |
| [`frontend/`](frontend) | App Expo (React Native) con Redux Toolkit, RTK Query y React Context |

- [documentacion.md](documentacion.md): cómo ejecutar, funcionalidades, decisiones y registro de cambios.
- [arquitectura.md](arquitectura.md): fuentes de datos, API, algoritmo de matching y diseño.
- [propuesta_t_cnica_mangofilter.md](propuesta_t_cnica_mangofilter.md): propuesta técnica original.
