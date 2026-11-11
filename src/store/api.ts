import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

import { searchProducts } from '../data/aggregator';
import { getServiceOffers, listServices, type ServiceSummary } from '../data/servicesRepository';
import type { CityId, SearchResult, Service, ServiceOffer } from '../domain/types';

/**
 * Estado de SERVIDOR con RTK Query: caché por argumentos, deduplicación de
 * peticiones, estados de carga/error y reintento manual (`refetch`).
 * `fakeBaseQuery` permite usar el agregador local como "backend"; al tener un
 * API Gateway real se cambia por `fetchBaseQuery({ baseUrl })`.
 */
type QueryError = { message: string };

const toError = (e: unknown): QueryError => ({ message: e instanceof Error ? e.message : 'Error desconocido' });

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery<QueryError>(),
  keepUnusedDataFor: 5 * 60, // segundos
  endpoints: (build) => ({
    searchProducts: build.query<SearchResult, { q: string; city: CityId }>({
      async queryFn({ q, city }) {
        try {
          return { data: await searchProducts(q, city) };
        } catch (e) {
          return { error: toError(e) };
        }
      },
    }),
    listServices: build.query<ServiceSummary[], void>({
      async queryFn() {
        try {
          return { data: await listServices() };
        } catch (e) {
          return { error: toError(e) };
        }
      },
    }),
    getServiceOffers: build.query<{ service: Service; offers: ServiceOffer[]; catalog: Service[] }, string>({
      async queryFn(id) {
        try {
          return { data: await getServiceOffers(id) };
        } catch (e) {
          return { error: toError(e) };
        }
      },
    }),
  }),
});

export const { useSearchProductsQuery, useListServicesQuery, useGetServiceOffersQuery } = api;
