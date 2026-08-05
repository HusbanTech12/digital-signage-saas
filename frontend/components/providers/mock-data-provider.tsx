"use client";

import { useSyncExternalStore } from "react";
import {
  getMockStoreServerSnapshot,
  getMockStoreSnapshot,
  subscribeMockStore,
} from "@/lib/mock-api/store";

export function useMockStore() {
  return useSyncExternalStore(
    subscribeMockStore,
    getMockStoreSnapshot,
    getMockStoreServerSnapshot,
  );
}
