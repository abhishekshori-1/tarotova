import type { NextResponse } from "next/server";
import { z } from "zod";
import { randomId } from "./ids";
import { handleServiceError, privateJson } from "./http";

export interface Trace {
  /** Record the phase a request is in so a failure log names where it stopped. */
  stage(name: string): void;
  subject(id: string): void;
}

/**
 * Wraps a route handler with a request id, stage tracking and one
 * structured start/finish log line, so a production failure can be tied
 * to the browser's `X-Request-Id` and the step it died in. Never logs
 * bodies, addresses or codes.
 */
export async function tracedRequest(label: string, run: (trace: Trace) => Promise<NextResponse>): Promise<NextResponse> {
  const requestId = randomId();
  const startedAt = Date.now();
  let stage = "start";
  let subjectId: string | undefined;
  const context = { requestId, region: process.env.VERCEL_REGION ?? "local" };
  console.info(label, { ...context, event: "started" });

  const trace: Trace = {
    stage: (name) => { stage = name; },
    subject: (id) => { subjectId = id; },
  };

  let response: NextResponse;
  try {
    response = await run(trace);
  } catch (err) {
    response = err instanceof z.ZodError || err instanceof SyntaxError
      ? privateJson({ error: "invalid_request" }, { status: 400 })
      : handleServiceError(err);
  }
  response.headers.set("X-Request-Id", requestId);
  console.info(label, {
    ...context, subjectId, event: "finished", stage, status: response.status,
    retryAfter: response.headers.get("Retry-After"), durationMs: Date.now() - startedAt,
  });
  return response;
}
