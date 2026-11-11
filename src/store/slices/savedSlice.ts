import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { Category } from '../../domain/types';

/** Producto guardado con una "foto" del precio para detectar variaciones. */
export interface SavedProduct {
  /** ID del grupo (ID_Interno de una de sus ofertas). */
  id: string;
  name: string;
  /** Búsqueda con la que se encontró: permite volver a consultar las tiendas. */
  query: string;
  category: Category;
  bestTotalAtSave: number;
  savedAt: number;
}

interface SavedState {
  items: SavedProduct[];
}

const initialState: SavedState = { items: [] };

const savedSlice = createSlice({
  name: 'saved',
  initialState,
  reducers: {
    toggleSaved(state, action: PayloadAction<SavedProduct>) {
      const i = state.items.findIndex((p) => p.id === action.payload.id);
      if (i >= 0) state.items.splice(i, 1);
      else state.items.unshift(action.payload);
    },
    removeSaved(state, action: PayloadAction<string>) {
      state.items = state.items.filter((p) => p.id !== action.payload);
    },
  },
});

export const { toggleSaved, removeSaved } = savedSlice.actions;
export default savedSlice.reducer;
