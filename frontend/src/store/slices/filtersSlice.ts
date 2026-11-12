import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { DEFAULT_FILTERS, type OfferFilters } from '../../domain/ranking';

/**
 * Filtros de la sesión actual (no se persisten: cada vez que se abre la app
 * se empieza "limpio", pero se mantienen al ir y volver entre pantallas).
 */
const filtersSlice = createSlice({
  name: 'filters',
  initialState: DEFAULT_FILTERS as OfferFilters,
  reducers: {
    setMaxBudget(state, action: PayloadAction<number | null>) {
      state.maxBudget = action.payload;
    },
    setMaxDeliveryDays(state, action: PayloadAction<number | null>) {
      state.maxDeliveryDays = action.payload;
    },
    setFreeShippingOnly(state, action: PayloadAction<boolean>) {
      state.freeShippingOnly = action.payload;
    },
    setHideUndeliverable(state, action: PayloadAction<boolean>) {
      state.hideUndeliverable = action.payload;
    },
    toggleStore(state, action: PayloadAction<string>) {
      const i = state.stores.indexOf(action.payload);
      if (i >= 0) state.stores.splice(i, 1);
      else state.stores.push(action.payload);
    },
    resetFilters() {
      return DEFAULT_FILTERS;
    },
  },
});

export const { setMaxBudget, setMaxDeliveryDays, setFreeShippingOnly, setHideUndeliverable, toggleStore, resetFilters } = filtersSlice.actions;
export default filtersSlice.reducer;
