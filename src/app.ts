/**
 * Fastify app factory for the URL shortener.
 * No .listen() here on purpose — tests build the app and use
 * app.inject() directly. server.ts is the only place that binds a port.
 */
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { ZodError, z } from "zod";
import { toBase62 } from "./base62.js";
import { Counter, UrlStore, type UrlRecord } from "./store.js";
import { HTML } from "./ui.js";

/** Thrown by route handlers when we want the error handler to reply with a specific status. */
export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const RESERVED_ALIAS = "urls";
const GENERATED_CODE_LENGTH = 7;

const createUrlBody = z
  .object({
    long_url: z.string(),
    custom_alias: z
      .string()
      .regex(/^[0-9A-Za-z]{3,16}$/, "custom_alias must be 3-16 alphanumeric characters")
      .optional(),
    expires_at: z.string().datetime().optional(),
  })
  .superRefine((body, ctx) => {
    // new URL() throws TypeError on malformed input; treat that as a validation issue
    // rather than letting it escape as an unhandled 500.
    try {
      const parsed = new URL(body.long_url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["long_url"],
          message: "long_url must use http or https",
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["long_url"],
        message: "long_url must be a valid URL",
      });
    }

    if (body.custom_alias !== undefined) {
      if (body.custom_alias.length === GENERATED_CODE_LENGTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["custom_alias"],
          message: `custom_alias must not be exactly ${GENERATED_CODE_LENGTH} characters (reserved for generated codes)`,
        });
      }
      if (body.custom_alias === RESERVED_ALIAS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["custom_alias"],
          message: `custom_alias must not be "${RESERVED_ALIAS}" (reserved route word)`,
        });
      }
    }

    if (body.expires_at !== undefined && new Date(body.expires_at).getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expires_at"],
        message: "expires_at must be in the future",
      });
    }
  });

export function buildApp(opts?: { baseUrl?: string }): FastifyInstance {
  const baseUrl = opts?.baseUrl ?? "http://localhost:3000";
  const counter = new Counter();
  const store = new UrlStore();

  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Registered before /:short_code; Fastify treats "/" as a distinct exact
  // route from the "/:short_code" param route, so there's no collision.
  app.get("/", async (_request, reply) => {
    reply.type("text/html");
    return HTML;
  });

  app.post(
    "/urls",
    { schema: { body: createUrlBody } },
    async (request, reply) => {
      const { long_url, custom_alias, expires_at } = request.body;
      const expiresAtDate = expires_at ? new Date(expires_at) : null;
      const createdAt = new Date();

      let code: string;
      if (custom_alias !== undefined) {
        if (store.get(custom_alias) !== undefined) {
          throw new HttpError(409, `alias "${custom_alias}" is already taken`);
        }
        code = custom_alias;
      } else {
        code = toBase62(counter.nextId());
      }

      const record: UrlRecord = {
        short_code: code,
        long_url,
        created_at: createdAt,
        expires_at: expiresAtDate,
      };

      const inserted = store.putIfAbsent(record);
      if (!inserted) {
        // Either the custom alias raced with another request, or (for generated
        // codes) the counter collided with an existing record — both indicate a
        // broken invariant, so fail loudly instead of silently retrying.
        throw new HttpError(
          custom_alias !== undefined ? 409 : 500,
          `short_code "${code}" already exists`,
        );
      }

      reply.code(201);
      return {
        short_url: `${baseUrl}/${code}`,
        short_code: code,
        expires_at: expiresAtDate ? expiresAtDate.toISOString() : null,
      };
    },
  );

  app.get<{ Params: { short_code: string } }>(
    "/:short_code",
    async (request, reply) => {
      const record = store.get(request.params.short_code);
      if (record === undefined) {
        throw new HttpError(404, "short_code not found");
      }
      if (record.expires_at !== null && record.expires_at.getTime() <= Date.now()) {
        throw new HttpError(410, "short_code has expired");
      }
      return reply.redirect(302, record.long_url);
    },
  );

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      reply.code(400).send({ error: "invalid request", issues: error.issues });
      return;
    }
    // fastify-type-provider-zod surfaces schema validation failures with a
    // `validation` array on the FastifyError rather than a bare ZodError.
    const withValidation = error as { validation?: unknown };
    if (withValidation.validation !== undefined) {
      reply.code(400).send({ error: error.message, issues: withValidation.validation });
      return;
    }
    if (error instanceof HttpError) {
      reply.code(error.statusCode).send({ error: error.message });
      return;
    }
    app.log.error(error);
    reply.code(500).send({ error: "internal server error" });
  });

  return app;
}
