import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestPerfContext {
  requestId: string;
  method: string;
  url: string;
  startTime: number;
  dbQueryCount: number;
  dbExecutionTimeMs: number;
  queries: { model?: string; operation?: string; durationMs: number }[];
}

export const perfStorage = new AsyncLocalStorage<RequestPerfContext>();

export const recordDbQuery = (model?: string, operation?: string, durationMs: number = 0) => {
  const store = perfStorage.getStore();
  if (store) {
    store.dbQueryCount += 1;
    store.dbExecutionTimeMs += durationMs;
    store.queries.push({ model, operation, durationMs: Math.round(durationMs * 100) / 100 });
  }
};
