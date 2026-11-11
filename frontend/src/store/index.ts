import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { FLUSH, PAUSE, PERSIST, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE } from 'redux-persist';

import { api } from './api';
import filters from './slices/filtersSlice';
import history from './slices/historySlice';
import preferences from './slices/preferencesSlice';
import saved from './slices/savedSlice';

const rootReducer = combineReducers({
  preferences,
  filters,
  saved,
  history,
  [api.reducerPath]: api.reducer,
});

/**
 * Solo se persisten preferencias, guardados e historial (clave v2: la v1 tenía
 * datos de demostración y se descarta). Los filtros son de
 * la sesión y la caché de RTK Query se reconstruye al consultar.
 */
const persistedReducer = persistReducer(
  { key: 'mangofilter-v2', version: 2, storage: AsyncStorage, whitelist: ['preferences', 'saved', 'history'] },
  rootReducer,
);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
    }).concat(api.middleware),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
