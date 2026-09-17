"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
/** A client-only form must not submit natively before its handlers are ready. */
export function useHydrated() { return useSyncExternalStore(subscribe, () => true, () => false); }
