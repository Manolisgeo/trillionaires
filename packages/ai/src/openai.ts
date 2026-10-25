import type { AnalysisProvider, CompletionRequest, CompletionResult } from "@kimma/types";
import OpenAI from "openai";

export class OpenAiAnalysisProvider implements AnalysisProvider {
  readonly name = "openai";

  constructor(
    private readonly client: OpenAI,
    private readonly defaultModel: string,
  ) {}

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const started = Date.now();
    const model = request.model ?? this.defaultModel;

    const response = await this.client.chat.completions.create({
      model,
      temperature: request.temperature ?? 0.2,
      messages: request.messages,
      response_format: request.jsonSchema
        ? { type: "json_object" }
        : { type: "text" },
    });

    const choice = response.choices[0]?.message?.content ?? "";
    return {
      text: choice,
      model: response.model,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
  }
}

export class OpenAiEmbeddingProvider {
  readonly name = "openai";

  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return response.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}

export function createOpenAiClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

/** Rough USD estimate for gpt-4.1-class chat + embeddings. Recalibrate per model. */
export function estimateChatCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * 2 + (outputTokens / 1_000_000) * 8;
}
