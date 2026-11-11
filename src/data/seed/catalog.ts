import type { Category, StoreId } from '../../domain/types';

/**
 * Catálogo de DEMOSTRACIÓN. Simula lo que cada tienda publicaría para el
 * mismo producto: títulos escritos distinto, precios distintos y, en el caso
 * de AliExpress, precios en USD. Los adaptadores transforman estos registros
 * en la forma "cruda" de la API de cada tienda, y el motor de normalización
 * los lleva al esquema canónico. Los precios NO son reales.
 *
 * Formato de cada publicación: [título, precio, precioAntesDeDescuento?]
 * (COP en todas las tiendas, USD en AliExpress).
 */
export type Listing = [title: string, price: number, listPrice?: number];

export interface SeedProduct {
  category: Category;
  bulky?: boolean;
  listings: Partial<Record<StoreId, Listing>>;
}

export const SEED_CATALOG: SeedProduct[] = [
  {
    category: 'tecnologia',
    listings: {
      mercadolibre: ['Audífonos Inalámbricos Sony WH-1000XM5 Cancelación De Ruido Negro', 1_349_900, 1_699_900],
      falabella: ['SONY AUDIFONOS BLUETOOTH WH-1000XM5 NEGRO', 1_399_990],
      aliexpress: ['Sony WH-1000XM5 Wireless Noise Cancelling Headphones', 289.99, 349.99],
      alkosto: ['Audífonos de Diadema SONY Inalámbricos Bluetooth WH-1000XM5 Negro', 1_379_900],
    },
  },
  {
    category: 'tecnologia',
    listings: {
      mercadolibre: ['Audífonos Sony WH-1000XM4 Noise Cancelling Negro', 999_900],
      falabella: ['SONY AUDIFONOS WH-1000XM4 NEGRO', 1_049_990, 1_299_990],
      alkosto: ['Audífonos SONY Inalámbricos WH-1000XM4 Negro', 1_019_900],
    },
  },
  {
    category: 'tecnologia',
    listings: {
      mercadolibre: ['Samsung Galaxy A55 5G 256 GB 8 GB RAM Azul', 1_649_900, 1_899_900],
      falabella: ['Celular Samsung Galaxy A55 256GB Azul', 1_699_990],
      alkosto: ['Celular SAMSUNG Galaxy A55 5G 256GB Azul Oscuro', 1_629_900],
    },
  },
  {
    category: 'tecnologia',
    listings: {
      mercadolibre: ['Samsung Galaxy A35 5G 128 GB 6 GB RAM Negro', 1_149_900],
      falabella: ['Celular Samsung Galaxy A35 128GB Negro', 1_199_990],
      alkosto: ['Celular SAMSUNG Galaxy A35 5G 128GB Negro', 1_129_900, 1_299_900],
    },
  },
  {
    category: 'tecnologia',
    listings: {
      mercadolibre: ['Apple iPhone 15 (128 GB) - Negro', 3_599_900],
      falabella: ['iPhone 15 128GB Negro', 3_699_990, 4_199_990],
      alkosto: ['iPhone 15 128GB Negro Apple', 3_649_900],
    },
  },
  {
    category: 'tecnologia',
    listings: {
      mercadolibre: ['Apple iPhone 15 (256 GB) - Azul', 4_199_900],
      falabella: ['iPhone 15 256GB Azul', 4_299_990],
    },
  },
  {
    category: 'tecnologia',
    listings: {
      mercadolibre: ['Xiaomi Redmi Note 13 Pro 256gb 8gb Ram Negro', 1_199_900],
      falabella: ['Xiaomi Redmi Note 13 Pro 256GB 8GB RAM Negro', 1_229_990],
      aliexpress: ['Xiaomi Redmi Note 13 Pro 4G Global Version 8GB 256GB', 239.0, 289.0],
      alkosto: ['Celular XIAOMI Redmi Note 13 Pro 256GB Negro', 1_249_900],
    },
  },
  {
    category: 'tecnologia',
    listings: {
      mercadolibre: ['Apple AirPods Pro (2da Generación) Con Estuche MagSafe USB-C', 1_099_900],
      falabella: ['AirPods Pro 2 USB-C Apple', 1_149_990],
      alkosto: ['Apple AirPods Pro 2da generación USB-C', 1_129_900, 1_249_900],
    },
  },
  {
    category: 'tecnologia',
    listings: {
      mercadolibre: ['Parlante JBL Flip 6 Portátil Bluetooth Negro', 469_900],
      falabella: ['JBL Parlante Flip 6 Negro', 499_990],
      aliexpress: ['JBL Flip 6 Portable Bluetooth Speaker Waterproof', 99.95],
      homecenter: ['Parlante Bluetooth Flip 6 JBL Negro', 489_900],
      alkosto: ['Parlante JBL Flip 6 Bluetooth Negro', 459_900, 529_900],
    },
  },
  {
    category: 'tecnologia',
    listings: {
      mercadolibre: ['Parlante JBL Charge 5 Bluetooth Azul', 699_900],
      alkosto: ['Parlante JBL Charge 5 Azul', 689_900],
    },
  },
  {
    category: 'tecnologia',
    listings: {
      mercadolibre: ['Portátil Lenovo IdeaPad Slim 3 Ryzen 7 7730U 16GB RAM 512GB SSD 15.6 Pulgadas', 2_599_900],
      falabella: ['LENOVO PORTATIL IDEAPAD SLIM 3 AMD RYZEN 7 16GB 512GB 15.6"', 2_649_990, 2_999_990],
      alkosto: ['Portátil LENOVO IdeaPad Slim 3 15.6" AMD Ryzen 7 RAM 16GB Disco SSD 512GB', 2_549_900],
    },
  },
  {
    category: 'tecnologia',
    listings: {
      mercadolibre: ['Portátil Asus Vivobook 15 Intel Core i5 8GB 512GB SSD', 2_099_900],
      falabella: ['ASUS PORTATIL VIVOBOOK 15 CORE I5 8GB 512GB', 2_149_990],
      alkosto: ['Portátil ASUS Vivobook 15 15.6" Intel Core i5 8GB 512GB', 2_079_900],
    },
  },
  {
    category: 'tecnologia',
    bulky: true,
    listings: {
      mercadolibre: ['Televisor Samsung 55 Pulgadas Crystal UHD 4K DU7000 Smart TV', 1_899_900],
      falabella: ['TV SAMSUNG 55" CRYSTAL UHD 4K DU7000 SMART TV', 1_949_990, 2_399_990],
      homecenter: ['Televisor Samsung 55 pulgadas 4K UHD Smart TV DU7000', 1_929_900],
      alkosto: ['TV SAMSUNG 55" Pulgadas 139 cm DU7000 4K-UHD Smart TV', 1_869_900],
    },
  },
  {
    category: 'tecnologia',
    bulky: true,
    listings: {
      mercadolibre: ['Televisor LG 50 Pulgadas 4K UHD Smart TV 50UR8750', 1_599_900],
      alkosto: ['TV LG 50" 4K UHD Smart TV 50UR8750', 1_549_900],
    },
  },
  {
    category: 'tecnologia',
    listings: {
      mercadolibre: ['Mouse Logitech MX Master 3S Inalámbrico Grafito', 449_900],
      falabella: ['LOGITECH MOUSE MX MASTER 3S GRAFITO', 469_990],
      aliexpress: ['Logitech MX Master 3S Wireless Mouse', 79.99, 99.99],
      alkosto: ['Mouse LOGITECH Inalámbrico MX Master 3S Grafito', 439_900],
    },
  },
  {
    category: 'tecnologia',
    listings: {
      mercadolibre: ['Consola Nintendo Switch OLED 64GB Blanca', 1_499_900],
      falabella: ['NINTENDO SWITCH OLED BLANCO', 1_549_990],
      alkosto: ['Consola NINTENDO Switch OLED 64GB Blanco', 1_479_900],
    },
  },
  {
    category: 'tecnologia',
    listings: {
      mercadolibre: ['Consola Sony PlayStation 5 Slim 1TB Digital', 2_299_900],
      falabella: ['PS5 Slim Digital 1TB', 2_399_990, 2_699_990],
      alkosto: ['Consola PlayStation 5 Slim Digital 1TB', 2_249_900],
    },
  },
  {
    category: 'deporte',
    listings: {
      mercadolibre: ['Reloj Garmin Forerunner 265 Negro', 1_799_900],
      falabella: ['GARMIN SMARTWATCH FORERUNNER 265', 1_849_990],
      aliexpress: ['Garmin Forerunner 265 GPS Running Smartwatch', 349.0],
    },
  },
  {
    category: 'hogar',
    listings: {
      mercadolibre: ['Freidora De Aire Oster 4 Litros Digital Negra', 289_900, 349_900],
      falabella: ['OSTER FREIDORA DE AIRE DIGITAL 4L', 309_990],
      homecenter: ['Freidora de aire Oster digital 4 litros negra', 279_900],
      alkosto: ['Freidora de Aire OSTER 4 Litros Digital', 284_900],
    },
  },
  {
    category: 'hogar',
    listings: {
      mercadolibre: ['Cafetera Nespresso Vertuo Pop Negra', 449_900],
      falabella: ['NESPRESSO CAFETERA VERTUO POP NEGRO', 469_990],
      homecenter: ['Cafetera Nespresso Vertuo Pop Negra', 429_900, 499_900],
      alkosto: ['Cafetera NESPRESSO Vertuo Pop Negro', 439_900],
    },
  },
  {
    category: 'hogar',
    listings: {
      mercadolibre: ['Robot Aspiradora Xiaomi Robot Vacuum S10 Blanco', 799_900],
      aliexpress: ['Xiaomi Robot Vacuum S10 Mi Robot Vacuum Cleaner', 159.0],
      homecenter: ['Aspiradora robot Xiaomi S10', 829_900],
      alkosto: ['Robot Aspirador XIAOMI Vacuum S10 Blanco', 819_900, 899_900],
    },
  },
  {
    category: 'hogar',
    listings: {
      mercadolibre: ['Taladro Percutor Dewalt Dcd7781d2 20v Con 2 Baterías', 719_900],
      aliexpress: ['DEWALT DCD7781D2 20V MAX Brushless Hammer Drill Kit', 189.0],
      homecenter: ['Taladro Percutor Inalámbrico DeWalt 20V 1/2" DCD7781D2', 749_900, 829_900],
    },
  },
  {
    category: 'deporte',
    listings: {
      mercadolibre: ['Tenis Nike Air Zoom Pegasus 41 Hombre Running Negro', 649_900],
      falabella: ['NIKE TENIS PEGASUS 41 HOMBRE', 679_990, 749_990],
    },
  },
  {
    category: 'vestuario',
    listings: {
      mercadolibre: ['Tenis Adidas Ultraboost Light Running Hombre', 799_900],
      falabella: ['ADIDAS TENIS ULTRABOOST LIGHT HOMBRE BLANCO', 849_990],
    },
  },
  {
    category: 'deporte',
    bulky: true,
    listings: {
      mercadolibre: ['Bicicleta Mtb GW Zeus Rin 29 9 Velocidades', 1_299_900],
      homecenter: ['Bicicleta GW Zeus Rin 29 9 Vel', 1_249_900],
      alkosto: ['Bicicleta GW Zeus Rin 29 9 Velocidades Negra', 1_319_900],
    },
  },
];

/** Búsquedas sugeridas en la pantalla de inicio. */
export const SUGGESTED_QUERIES = ['audífonos sony', 'iphone 15', 'freidora de aire', 'parlante jbl', 'portátil lenovo', 'ps5'];
