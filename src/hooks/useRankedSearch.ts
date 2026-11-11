import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { rankResults } from '../domain/ranking';
import { useAppSelector } from '../store';
import { useSearchProductsQuery } from '../store/api';

/**
 * Combina estado de servidor (resultados crudos de RTK Query) con estado de
 * cliente (criterio y filtros en Redux). Cambiar un filtro reordena al
 * instante, sin volver a consultar las tiendas.
 */
export function useRankedSearch(query: string | undefined) {
  const city = useAppSelector((s) => s.preferences.city);
  const criterion = useAppSelector((s) => s.preferences.criterion);
  const filters = useAppSelector((s) => s.filters);

  const q = query?.trim();
  const result = useSearchProductsQuery(q ? { q, city } : skipToken);

  const ranked = useMemo(
    () => (result.data ? rankResults(result.data.groups, criterion, filters) : []),
    [result.data, criterion, filters],
  );

  return { ...result, ranked, criterion, city, filters };
}
