import { Request, Response, NextFunction } from "express";
import { perfStorage, RequestPerfContext } from "../lib/perfStorage.js";

export const perfLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = performance.now();
  const requestId = Math.random().toString(36).substring(2, 9);

  const context: RequestPerfContext = {
    requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    startTime,
    dbQueryCount: 0,
    dbExecutionTimeMs: 0,
    queries: [],
  };

  // Intercept headers before sending to client
  const originalSend = res.send;
  res.send = function (body?: any): Response {
    const totalTime = Math.round((performance.now() - startTime) * 100) / 100;
    const dbTime = Math.round(context.dbExecutionTimeMs * 100) / 100;

    res.setHeader("X-Response-Time", `${totalTime}ms`);
    res.setHeader("X-DB-Time", `${dbTime}ms`);
    res.setHeader("X-DB-Queries", String(context.dbQueryCount));

    return originalSend.call(this, body);
  };

  res.on("finish", () => {
    const totalTime = Math.round((performance.now() - startTime) * 100) / 100;
    const dbTime = Math.round(context.dbExecutionTimeMs * 100) / 100;
    const serverTime = Math.max(0, Math.round((totalTime - dbTime) * 100) / 100);
    const contentLength = res.getHeader("content-length") || "chunked";
    const status = res.statusCode;

    const slowQueryIndicator = totalTime > 1000 ? "⚠️ [SLOW]" : "[PERF]";
    console.log(
      `${slowQueryIndicator} ${req.method} ${context.url} - ${status} | Total: ${totalTime}ms | DB: ${dbTime}ms (${context.dbQueryCount} queries) | Server: ${serverTime}ms | Size: ${contentLength}b`
    );

    if (context.queries.length > 5) {
      console.warn(`  ↳ ⚠️ High query count (${context.queries.length} queries) on ${context.url}!`);
    }
  });

  perfStorage.run(context, () => {
    next();
  });
};
