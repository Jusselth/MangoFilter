# Propuesta Técnica de Proyecto: MangoFilter
**Sistema Distribuidor y Agregador Multicriterio para E-Commerce y Servicios**

* **Autores:** Jusselth Chica, Juan Mora, Santiago Álvarez
* **Institución:** Ingeniería Informática — Universidad de La Sabana
* **Fecha:** 30 de agosto de 2026

---

## Resumen

Este documento presenta la especificación técnica de MangoFilter, un agregador inteligente y comparador de productos y servicios diseñado para mitigar la fragmentación del comercio electrónico y la opacidad en las tarifas de contratación digital. Se detallan la definición formal del problema sustentada en métricas del mercado colombiano, una caracterización de usuarios arquetípicos, una matriz competitiva sistemática, la propuesta arquitectónica federada multicapa y la especificación de accesibilidad universal alineada con la norma WCAG 2.2 (Nivel AA) e ISO/IEC 40500:2012.

---

## 1. Definición del Problema

### 1.1. Contexto y Evidencia del Mercado

El comercio electrónico en Colombia registró 684,6 millones de transacciones por un valor total de $\$145,4$ billones de pesos. El mercado presenta una alta dispersión de la oferta: plataformas dominantes como Mercado Libre (37 millones de visitas mensuales), Falabella (15 millones), AliExpress (14 millones) y Homecenter (11 millones) compiten con cadenas minoristas independientes y agregadores de servicios o entregas a domicilio.

El ticket promedio de compra en línea ha disminuido de forma constante. Este comportamiento evidencia una mayor frecuencia de compra digital para montos menores y una sensibilidad directa del comprador hacia el precio final.

### 1.2. Impacto de la Dispersión

1. **Asimetría de información en el precio total:** El costo final de un producto o servicio depende del costo base, tarifas de envío regional y descuentos aplicables por medios de pago o alianzas digitales. El comprador requiere navegar múltiples plataformas para consolidar esta información.
2. **Ineficiencia temporal:** El proceso manual de comparación requiere consultas independientes en aplicaciones o sitios web sin un estándar de datos unificado.
3. **Opacidad en la agregación de servicios:** En servicios y suscripciones digitales (plataformas de contenido audiovisual, servicios del hogar o conectividad), los proveedores empaquetan beneficios indirectos que el usuario no puede comparar directamente bajo una misma métrica de costo-beneficio.

### 1.3. Caracterización de Usuarios Arquetípicos

* **Perfil 1: Comprador Frecuente Enfocado en Costo Total (B2C)**
  * **Comportamiento:** Realiza entre 3 y 8 compras digitales al mes en categorías como tecnología, vestuario y artículos del hogar. Usa herramientas de pago digital y tarjetas bancarias.
  * **Restricción operativa:** Dispone de tiempo limitado para verificar manualmente precios y condiciones de envío entre plataformas.
  * **Caso de uso:** Requiere adquirir un producto técnico específico al menor precio total disponible, priorizando que el costo combinado de envío y artículo no supere su presupuesto.

* **Perfil 2: Suscriptor y Consumidor de Servicios Empaquetados (B2C)**
  * **Comportamiento:** Contrata servicios digitales o del hogar a través de aplicaciones de terceros o planes combinados.
  * **Restricción operativa:** Desconoce las alianzas vigentes entre proveedores de infraestructura/contenido y servicios adicionales.
  * **Caso de uso:** Busca contratar una plataforma de streaming o servicio del hogar específico y requiere identificar cuál integrador ofrece la tarifa mensual más baja o el paquete con mayores beneficios incluidos.

---

## 2. Análisis Competitivo y Matriz Integrada

### 2.1. Evaluación Sistémica de Soluciones Existentes

| Competidor | Modelo de Dominio | Cobertura de Datos | Mecanismo de Ingestión | Barreras Técnicas y Operativas |
| :--- | :--- | :--- | :--- | :--- |
| **Google Shopping** | Motor generalista horizontal | Alta en productos; nula en servicios locales o alianzas. | Indexación web (crawling) y feeds estructurados comercialmente. | Retraso en actualización de stock; omisión de costos de envío calculados en checkout; sin soporte para bundling de servicios. |
| **PcComponentes / Keepa** | Vertical hiper-específico / Rastreador de precios históricos | Alta en nichos de tecnología/hardware. Exclusiva del ecosistema Amazon. | Web scraping especializado e integraciones cerradas con minoristas de su sector. Polling continuo a la API interna de Amazon. | Arquitectura restringida a su catálogo o nicho; no escalable a bienes de consumo general ni servicios. Cobertura monositio; no captura variaciones de comercio local o integradores regionales. |

*Tabla 1: Matriz de Análisis Competitivo Sistémico*

### 2.2. Brechas del Mercado y Estrategia de Resolución de MangoFilter

* **Integración heterogénea:** Los competidores actuales separan la búsqueda de bienes físicos de la contratación de servicios. MangoFilter unifica ambos dominios en una sola tubería de procesamiento de datos.
* **Transparencia en el costo final:** MangoFilter calcula el costo final sumando el precio base y la tarifa logística específica según la ubicación del usuario, superando la muestra de precios base parciales que generan los motores de búsqueda tradicionales.

---

## 3. Estado del Arte y Arquitectura de Innovación

### 3.1. Estado del Arte Técnico

La agregación de datos distribuidos en comercio electrónico enfrenta problemas de latencia en la actualización de precios, disparidad en la estructura de los datos de entrada y bloqueos por mecanismos anti-bot en scraping directo. Las aproximaciones modernas resuelven esto mediante arquitecturas federadas de consulta, normalización esquemática dinámica y sistemas de caché multicapa.

### 3.2. Propuesta Arquitectónica de MangoFilter

```
                      +-----------------------+
                      |    Cliente Web/App    |
                      +-----------------------+
                                  |
                                  v
                      +-----------------------+
                      |    API Gateway (Go)   |
                      +-----------------------+
                                  |
               +------------------+------------------+
               |                                     |
               v                                     v
      +-----------------------+             +-----------------------+
      |  Módulo de Productos  |             |  Módulo de Servicios  |
      +-----------------------+             +-----------------------+
                  |                                     |
                  v                                     v
      +-----------------------+             +-----------------------+
      | Adaptadores REST/gRPC |             | Adaptadores Alianzas  |
      +-----------------------+             +-----------------------+
          |       |       |                             |
          v       v       v                             v
      [API A]  [API B] [API C]              [API Partner Serv.]
          |       |       |                             |
          +-------+-------+                             |
                  |                                     |
                  +------------------+------------------+
                                     |
                                     v
                      +-------------------------------+
                      |    Motor de Normalización     |
                      |  y Coincidencia (Enrichment)  |
                      +-------------------------------+
                                     |
                                     v
                      +-------------------------------+
                      |       Caché Redis L1/L2       |
                      +-------------------------------+
```

#### 1. Ingestión Híbrida Adaptativa:
* **Conexión Directa:** Integración mediante endpoints REST/gRPC autenticados con plataformas asociadas para obtener respuestas en formato JSON/Protocol Buffers.
* **Scraping Headless Resiliente:** Para proveedores sin API pública, se utilizan instancias automatizadas que extraen los selectores de datos (DOM) en entornos controlados, reduciendo la latencia de procesamiento.

#### 2. Algoritmo de Normalización Federada y Matching de Entidades:
* **Estandarización:** Los datos sin estructura común se transforman a un esquema canónico global que define: `ID_Interno`, `Nombre Normalizado`, `Precio Base`, `Costo Envio`, `Tiempo Entrega`, `Proveedor` y `Metadatos Servicio`.
* **Emparejamiento (Entity Resolution):** Se implementa un cálculo de similitud de cadenas sobre los títulos de los productos utilizando la distancia de Jaro-Winkler combinada con embeddings de texto locales para asociar el mismo producto vendido en diferentes tiendas bajo un identificador único.

#### 3. Caché Distribuida Multicapa:
* **Caché L1 (Redis In-Memory):** Almacena precios de alta rotación con un tiempo de vida (TTL) dinámico basado en la frecuencia histórica de actualización de cada tienda.
* **Caché L2 (Base de Datos Orientada a Documentos):** Guarda el historial de variaciones de precios para permitir análisis de tendencias sin saturar las APIs de los comercios afiliados.

#### 4. Motor de Filtrado Multicriterio:
El sistema procesa los resultados mediante un algoritmo de ordenamiento que permite al usuario ponderar dos variables principales:

$$\text{Costo Total} = \text{Precio\_Base} + \text{Costo\_Envio} \quad (1)$$

junto con el parámetro de $\text{Tiempo\_Estimado\_Entrega}$.

---

## 4. Especificación de Accesibilidad Universal y Diseño Inclusivo

Para garantizar el acceso equitativo a la plataforma, MangoFilter implementa un marco de arquitectura de software y diseño de interfaz alineado con el estándar WCAG 2.2 (Nivel AA), la norma ISO/IEC 40500:2012 y el estándar EN 301 549. La plataforma aborda cuatro dimensiones principales de accesibilidad:

### 4.1. Accesibilidad Visual

* **Ceguera total:** Implementación de HTML5 semántico (`<main>`, `<nav>`, `<article>`, `<section>`) y etiquetado con propiedades ARIA (`aria-live`, `aria-label`, `aria-expanded`). Esto permite que los lectores de pantalla (NVDA, JAWS, Voice Over, TalkBack) interpreten dinámicamente las variaciones de precios y resultados del filtrado sin perder el contexto.
* **Baja visión y sensibilidad al brillo:** Implementación de layout fluido en unidades relativas ($\text{rem}/\text{em}$) con soporte para ampliación de texto hasta 200% sin pérdida de contenido ni desplazamiento horizontal involuntario (WCAG 2.2 Reflow 1.4.10). Adicionalmente, la interfaz soporta temas de alto contraste y un modo oscuro nativo con control de luminancia para mitigar la fatiga visual por fotofobia.
* **Daltonismo:** El diseño no transmite información clave (como variaciones de oferta o disponibilidad de inventario) basada únicamente en el color. Toda métrica combinada de costo o tiempo incluye símbolos, indicadores tipográficos y etiquetas explícitas. Se habilitan filtros de color para protanopía, deuteranopía y tritanopía.

### 4.2. Accesibilidad Auditiva

* **Procesamiento auditivo, hipoacusia y sordera total:** Aunque MangoFilter es predominantemente visual, todos los componentes interactivos, tutoriales, alertas o notificaciones que incluyan señales de audio cuentan con un equivalente visual directo mediante transcripciones de texto (formatos WebVTT), notificaciones tipo banner de alta visibilidad y subtítulos cerrados (CC).

### 4.3. Accesibilidad Motriz

* **Navegación por teclado e interfaces adaptativas (Switch Users):** Soporte completo para navegación por secuencia de tabulación lógica sin depender del puntero del ratón. Los elementos enfocados cuentan con un indicador visual directo (`:focus-visible`) que cumple con un contraste mínimo de 3:1 frente al fondo.
* **Limitaciones motrices (Temblor, Parkinson y Movilidad Reducida):**
  * **Dimensión de objetivos táctiles:** Los botones y controles interactivos tienen una superficie mínima de toque de $44 \times 44$ píxeles (WCAG 2.2 Target Size 2.5.8) para prevenir pulsaciones accidentales.
  * **Interacciones complejas:** Se eliminan los gestos de arrastre (*drag and drop*) como único medio para aplicar filtros de precio; toda acción dispone de controles alternativos basados en botones directos o campos numéricos.
  * **Tiempos de espera configurables:** No se aplican temporizadores de sesión rígidos que cierren la búsqueda sin advertencia previa.

### 4.4. Accesibilidad Cognitiva

* **Dislexia:** La plataforma utiliza tipografías sin serifa de alta legibilidad con caracteres bien diferenciados (ej. Atkinson Hyperlegible o Inter), manteniendo un interlineado estándar de $1.5\times$ y espacio entre párrafos configurable.
* **TDAH y Ansiedad:**
  * Reducción de carga de estímulos mediante la ausencia estricta de patrones oscuros (*dark patterns*), como contadores regresivos falsos de ofertas.
  * Eliminación de ventanas emergentes (*pop-ups*) no solicitadas o banners parpadeantes. La interfaz prioriza un diseño limpio enfocado en la tarea principal de comparación.
* **Memoria de Trabajo:** Uso de indicadores de flujo claro (*breadcrumbs*), persistencia del estado de las búsquedas en la sesión actual y resúmenes tabulares simplificados que reducen la necesidad de recordar precios vistos en pantallas anteriores.

---

## 5. Identificación del Entregable

* **Nombre del Proyecto:** MangoFilter
* **Categoría:** Sistemas Distribuidos / Agregación de Datos en E-Commerce
* **Integrantes:** Jusselth Chica, Juan Mora, Santiago Álvarez
* **Institución:** Universidad de La Sabana — Ingeniería Informática