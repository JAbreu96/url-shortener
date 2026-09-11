/**
 * Process entry point: builds the app and binds a port.
 * Kept separate from app.ts so tests never trigger a real listen().
 */
import { buildApp } from "./app.js";

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

const app = buildApp({ baseUrl });

app.listen({ port, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`listening on ${address}`);
});
