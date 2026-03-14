import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PromptBuilderService, ReplyPromptInput } from './prompt-builder.service';

export interface CandidateReply {
  index: number;
  content: string;
  confidence: number;
}

@Injectable()
export class AiEngineService {
  private readonly client: Anthropic | null = null;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(
    private readonly config: ConfigService,
    private readonly promptBuilder: PromptBuilderService,
  ) {
    const apiKey = this.config.get<string>('ai.anthropicApiKey');
    this.model = this.config.get<string>('ai.defaultModel') ?? 'claude-3-5-sonnet-20241022';
    this.maxTokens = this.config.get<number>('ai.maxTokens') ?? 1024;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  /**
   * Generate N candidate replies using Claude. Returns empty array if API key not configured.
   */
  async generateCandidates(
    input: ReplyPromptInput,
    count: number,
  ): Promise<CandidateReply[]> {
    if (!this.client) {
      return this.getFallbackCandidates(input.incomingMessage, count);
    }
    const systemPrompt = this.promptBuilder.buildSystemPrompt(input);
    const userPrompt = this.promptBuilder.buildUserPrompt(input, count);
    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const textBlock = message.content?.find((b) => b.type === 'text');
      const text =
        textBlock && textBlock.type === 'text' ? textBlock.text : '';
      return this.parseCandidatesResponse(text, count);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      throw new Error(`AI reply generation failed: ${errorMessage}`);
    }
  }

  private parseCandidatesResponse(text: string, count: number): CandidateReply[] {
    const trimmed = text.trim();
    const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : trimmed;
    let arr: Array<{ content?: string; confidence?: number }>;
    try {
      arr = JSON.parse(jsonStr) as Array<{ content?: string; confidence?: number }>;
    } catch {
      return this.getFallbackCandidates(
        trimmed.slice(0, 100) || '（请回复）',
        count,
      );
    }
    if (!Array.isArray(arr) || arr.length === 0) {
      return this.getFallbackCandidates('（请回复）', count);
    }
    return arr.slice(0, count).map((item, i) => ({
      index: i,
      content:
        typeof item.content === 'string' && item.content
          ? item.content.trim().slice(0, 500)
          : `回复选项 ${i + 1}`,
      confidence:
        typeof item.confidence === 'number' &&
        item.confidence >= 0 &&
        item.confidence <= 1
          ? Math.round(item.confidence * 100) / 100
          : 0.8,
    }));
  }

  private getFallbackCandidates(
    incomingMessage: string,
    count: number,
  ): CandidateReply[] {
    const base = incomingMessage.length > 20 ? '好的，收到。' : '嗯嗯';
    return Array.from({ length: Math.min(count, 5) }, (_, i) => ({
      index: i,
      content: i === 0 ? base : `${base}（选项${i + 1}）`,
      confidence: 0.7 - i * 0.05,
    }));
  }
}
