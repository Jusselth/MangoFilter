import { createApi, fetchBaseQuery, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';

import type { City, SearchResponse, StoreRef } from '../api/types';
import { API_URL } from '../config';

/**
 * Estado de SERVIDOR con RTK Query contra el backend de MangoFilter:
 * caché por argumentos, deduplicación, estados de carga/error y `refetch`.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: `${API_URL}/api`, timeout: 25_000 }),
  keepUnusedDataFor: 5 * 60, // segundos
  endpoints: (build) => ({
    searchProducts: build.query<SearchResponse, { q: string; city: string }>({
      query: ({ q, city }) => ({ url: '/search', params: { q, city } }),
    }),
    getCities: build.query<City[], void>({
      query: () => '/cities',
      keepUnusedDataFor: 24 * 60 * 60,
    }),
    getStores: build.query<StoreRef[], void>({
      query: () => '/stores',
      keepUnusedDataFor: 60 * 60,
    }),
  }),
});

export const { useSearchProductsQuery, useGetCitiesQuery, useGetStoresQuery } = api;

/** Mensaje legible para el usuario a partir de un error de RTK Query. */
export function describeApiError(error: unknown): string {
  const e = error as FetchBaseQueryError | undefined;
  if (!e) return 'Ocurrió un error inesperado.';
  if (e.status === 'FETCH_ERROR' || e.status === 'TIMEOUT_ERROR') {
    return `No pudimos conectar con el servidor de MangoFilter (${API_URL}). Verifica que el backend esté encendido y que el celular esté en la misma red.`;
  }
  const data = e.data as { error?: string } | undefined;
  return data?.error ?? `El servidor respondió con un error (${String(e.status)}).`;
}
