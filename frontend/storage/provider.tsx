"use client"
import { store } from "./store"
import { Provider } from "react-redux"
import type { ReactNode } from "react"

export function ReduxProvider({ children }: { children: ReactNode }) {
  return <Provider store={store}>{children}</Provider>
}

