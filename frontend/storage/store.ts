import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { authApi } from "./services/authApi";
import { contactApi } from "./services/contactApi";
import { catalogApi } from "./services/catalogApi";
import { paperaiApi } from "./services/paperaiApi";
import { paymentApi } from "./services/paymentApi";
import { setupListeners } from "@reduxjs/toolkit/query";

const combinedReducer = combineReducers({
  [authApi.reducerPath]: authApi.reducer,
  [contactApi.reducerPath]: contactApi.reducer,
  [catalogApi.reducerPath]: catalogApi.reducer,
  [paperaiApi.reducerPath]: paperaiApi.reducer,
  [paymentApi.reducerPath]: paymentApi.reducer,
});

const rootReducer = (state: ReturnType<typeof combinedReducer> | undefined, action: { type: string }) => {
  if (action.type === "auth/logout") {
    state = undefined;
  }
  return combinedReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(authApi.middleware)
      .concat(contactApi.middleware)
      .concat(catalogApi.middleware)
      .concat(paperaiApi.middleware)
      .concat(paymentApi.middleware),
});

export const resetAllApiState = () => {
  store.dispatch(authApi.util.resetApiState());
  store.dispatch(contactApi.util.resetApiState());
  store.dispatch(catalogApi.util.resetApiState());
  store.dispatch(paperaiApi.util.resetApiState());
  store.dispatch(paymentApi.util.resetApiState());
};

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
