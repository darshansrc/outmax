import { createBedrockMantle } from "@ai-sdk/amazon-bedrock/mantle";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { APICallError, RetryError } from "ai";

export const MODEL = "openai.gpt-6.1-sol";
export const SEARCH_MODEL = "gemini-4-argon";

const bedrockMantle = createBedrockMantle({
  region: "us-east-1",
  baseURL: "https://bedrock-mantle.us-east-1.api.aws/openai/v1",
  apiKey: process.env.BEDROCK_API_KEY,
});

/** The language model every route and agent uses, except onboarding web research. */
export const model = bedrockMantle.responses(MODEL);

export const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY });

/** Onboarding web research: Gemini with Google Search grounding. */
export const searchModel = google(SEARCH_MODEL);

/** True when the provider says the model doesn't exist or this key can't use it. */
export function modelUnavailable(error: unknown) {
  if (RetryError.isInstance(error)) error = error.lastError;
  return APICallError.isInstance(error) && (error.statusCode === 404 || error.statusCode === 403);
}
