import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';

import type {
  AccountData,
  AccountPreferences,
  AccountSavedProduct,
  City,
  HealthResponse,
  RecommendationsResponse,
  SearchResponse,
  StoreRef,
  TopStoresResponse,
  TrendingResponse,
  VerifyResponse,
} from '../api/types';
import { getDeviceId } from '../auth/storage';
import { API_URL } from '../config';
import { signedOut } from './slices/sessionSlice';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${API_URL}/api`,
  timeout: 25_000,
  prepareHeaders: async (headers, { getState }) => {
    // Sesión (si hay) e identificador anónimo del dispositivo (para estadísticas de invitados).
    const token = (getState() as { session: { token: string | null } }).session.token;
    if (token) headers.set('authorization', `Bearer ${token}`);
    headers.set('x-device-id', await getDeviceId());
    return headers;
  },
});

/** Si el servidor dice que la sesión ya no vale (401), se cierra la sesión local. */
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, apiCtx, extra) => {
  const result = await rawBaseQuery(args, apiCtx, extra);
  const hadToken = !!(apiCtx.getState() as { session: { token: string | null } }).session.token;
  if (result.error?.status === 401 && hadToken) apiCtx.dispatch(signedOut());
  return result;
};

/**
 * Estado de SERVIDOR con RTK Query contra el backend de MangoFilter:
 * caché por argumentos, deduplicación, estados de carga/error y `refetch`.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  keepUnusedDataFor: 5 * 60, // segundos
  tagTypes: ['Recommendations', 'Trending', 'TopStores'],
  endpoints: (build) => ({
    /* ------------------------------ Búsqueda ------------------------------ */
    searchProducts: build.query<SearchResponse, { q: string; city: string }>({
      query: ({ q, city }) => ({ url: '/search', params: { q, city } }),
      // Cada búsqueda nueva alimenta las recomendaciones y "lo más buscado".
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(api.util.invalidateTags(['Recommendations', 'Trending']));
        } catch {
          // El error se muestra en la pantalla de resultados.
        }
      },
    }),
    getCities: build.query<City[], void>({
      query: () => '/cities',
      keepUnusedDataFor: 24 * 60 * 60,
    }),
    getStores: build.query<StoreRef[], void>({
      query: () => '/stores',
      keepUnusedDataFor: 60 * 60,
    }),
    getHealth: build.query<HealthResponse, void>({
      query: () => '/health',
      keepUnusedDataFor: 60 * 60,
    }),

    /* ------------------------------- Cuenta ------------------------------- */
    requestCode: build.mutation<{ ok: true; email: string; expiresInMinutes: number }, { email: string }>({
      query: (body) => ({ url: '/auth/code', method: 'POST', body }),
    }),
    verifyCode: build.mutation<VerifyResponse, { email: string; code: string; acceptPrivacy: boolean }>({
      query: (body) => ({ url: '/auth/verify', method: 'POST', body }),
    }),
    logout: build.mutation<{ ok: true }, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
    }),
    getMe: build.query<AccountData, void>({
      query: () => '/me',
      keepUnusedDataFor: 0,
    }),
    syncAccount: build.mutation<AccountData, { preferences?: AccountPreferences; saved: AccountSavedProduct[] }>({
      query: (body) => ({ url: '/me/sync', method: 'POST', body }),
    }),
    putPreferences: build.mutation<{ ok: true }, AccountPreferences>({
      query: (body) => ({ url: '/me/preferences', method: 'PUT', body }),
    }),
    putSaved: build.mutation<{ ok: true }, AccountSavedProduct>({
      query: (body) => ({ url: '/me/saved', method: 'PUT', body }),
      invalidatesTags: ['Recommendations'],
    }),
    deleteSaved: build.mutation<{ ok: true }, string>({
      query: (id) => ({ url: `/me/saved/${encodeURIComponent(id)}`, method: 'DELETE' }),
      invalidatesTags: ['Recommendations'],
    }),
    deleteAccount: build.mutation<{ ok: true }, void>({
      query: () => ({ url: '/me', method: 'DELETE' }),
    }),

    /* ---------------------- Actividad y estadísticas ---------------------- */
    logClick: build.mutation<
      { ok: true; counted: boolean },
      { offerId: string; storeId: string; productName: string; query?: string; city: string }
    >({
      query: (body) => ({ url: '/events/click', method: 'POST', body }),
      invalidatesTags: (result) => (result?.counted ? ['TopStores', 'Recommendations'] : []),
    }),
    clearRemoteHistory: build.mutation<{ ok: true }, void>({
      query: () => ({ url: '/history', method: 'DELETE' }),
      invalidatesTags: ['Recommendations'],
    }),
    getTopStores: build.query<TopStoresResponse, void>({
      query: () => '/stats/top-stores',
      providesTags: ['TopStores'],
    }),
    getTrending: build.query<TrendingResponse, string>({
      query: (city) => ({ url: '/stats/trending', params: { city } }),
      providesTags: ['Trending'],
    }),
    /** `who` (id de usuario o "guest") solo sirve para separar la caché por persona. */
    getRecommendations: build.query<RecommendationsResponse, { city: string; who: string }>({
      query: ({ city }) => ({ url: '/recommendations', params: { city } }),
      providesTags: ['Recommendations'],
      keepUnusedDataFor: 60,
    }),
  }),
});

export const {
  useSearchProductsQuery,
  useGetCitiesQuery,
  useGetStoresQuery,
  useGetHealthQuery,
  useRequestCodeMutation,
  useVerifyCodeMutation,
  useGetTopStoresQuery,
  useGetTrendingQuery,
  useGetRecommendationsQuery,
} = api;

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
