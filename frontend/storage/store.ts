import { configureStore  , combineReducers} from "@reduxjs/toolkit";
import { authApi } from "./services/authApi";
import { contactApi } from "./services/contactApi";
import { setupListeners } from "@reduxjs/toolkit/query";

const combinedReducer = combineReducers({
    [authApi.reducerPath]: authApi.reducer,
    [contactApi.reducerPath]: contactApi.reducer,
})
const rootReducer = (state: any, action: any) => {
    if(action.type === "auth/logout"){
        state = undefined;
    }
    return combinedReducer(state, action);
}
export const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware()
        .concat(authApi.middleware)
        .concat(contactApi.middleware)
})

export const resetAllApiState = () => {
    store.dispatch(authApi.util.resetApiState());
}
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch;