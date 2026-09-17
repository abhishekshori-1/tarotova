import type { ApiError } from "./api";

export function journeyErrorMessage(error: ApiError): string {
  if (error.body?.error === "conversation_closed") return "This conversation has closed. Your saved support response is shown here.";
  if (error.status === 429) return error.retryAfterSeconds
    ? `Please wait ${error.retryAfterSeconds} seconds before trying again. Your saved place is unchanged.`
    : "Please wait a little before trying again. Your saved place is unchanged.";
  if (error.status === 409 || error.body?.error === "invalid_stage") return "This journey changed in another tab. Your saved place is shown here.";
  if (error.body?.error === "reading_not_ready") return "Finish loading the reading, then try this step again.";
  return "We couldn't confirm that step. Your saved place is shown here; please try again.";
}
