/**
 * OTel-экспорт трейсов в SigNoz. Без OTEL_EXPORTER_OTLP_ENDPOINT молчит —
 * локальная разработка и тесты работают как раньше.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;

  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { getNodeAutoInstrumentations } = await import(
    "@opentelemetry/auto-instrumentations-node"
  );
  const { OTLPTraceExporter } = await import(
    "@opentelemetry/exporter-trace-otlp-http"
  );
  const { resourceFromAttributes } = await import("@opentelemetry/resources");
  const { ATTR_SERVICE_NAME } = await import(
    "@opentelemetry/semantic-conventions"
  );

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.SIGNOZ_SERVICE_NAME ?? "deckbook",
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
      headers: process.env.SIGNOZ_INGESTION_KEY
        ? { "signoz-ingestion-key": process.env.SIGNOZ_INGESTION_KEY }
        : {},
    }),
    instrumentations: [
      // ponytail: pg-инструментация из набора уже даёт спаны запросов
      // Prisma-адаптера — отдельный @prisma/instrumentation не нужен
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-http": {
          requestHook(span, req) {
            if ("url" in req && req.url && "method" in req && req.method) {
              span.updateName(`${req.method} ${spanPath(req.url)}`);
            }
          },
        },
      }),
    ],
  });

  sdk.start();
}

/**
 * Схлопывает cuid-подобные сегменты в :id: иначе имя спана уникально для каждой
 * задачи и кардинальность в SigNoz растёт без предела.
 */
export function spanPath(url: string): string {
  return url.split("?")[0].replace(/\/[a-z0-9]{20,}(?=\/|$)/gi, "/:id");
}
