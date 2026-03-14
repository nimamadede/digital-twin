import { Injectable } from '@nestjs/common';

export interface ContextItem {
  role: 'contact' | 'user';
  content: string;
  timestamp: string;
}

export interface ReplyPromptInput {
  incomingMessage: string;
  context?: ContextItem[];
  profileTraits?: Record<string, unknown>;
  sceneName?: string;
  sceneReplyStyle?: string;
  contactNickname?: string;
}

/**
 * Builds system and user prompts for AI reply generation.
 */
@Injectable()
export class PromptBuilderService {
  buildSystemPrompt(input: ReplyPromptInput): string {
    const parts: string[] = [
      'You are a helpful assistant that generates short, natural Chinese chat replies.',
      'Output exactly the number of candidate replies requested, each as a brief sentence suitable for WeChat/instant messaging.',
      'Keep each reply concise (under 50 characters when possible), friendly and context-appropriate.',
    ];
    if (input.profileTraits && Object.keys(input.profileTraits).length > 0) {
      parts.push(
        `Style traits to follow: ${JSON.stringify(input.profileTraits)}`,
      );
    }
    if (input.sceneReplyStyle) {
      parts.push(`Reply style for current scene: ${input.sceneReplyStyle}.`);
    }
    if (input.sceneName) {
      parts.push(`Current scene: ${input.sceneName}.`);
    }
    return parts.join('\n');
  }

  buildUserPrompt(input: ReplyPromptInput, count: number): string {
    const lines: string[] = [];
    if (input.contactNickname) {
      lines.push(`Contact: ${input.contactNickname}`);
    }
    if (input.context && input.context.length > 0) {
      lines.push('Recent conversation:');
      for (const item of input.context) {
        const who = item.role === 'contact' ? 'Contact' : 'User';
        lines.push(`- ${who}: ${item.content}`);
      }
    }
    lines.push(`Incoming message: "${input.incomingMessage}"`);
    lines.push(
      `Generate exactly ${count} candidate replies. Respond with a JSON array only, no other text. Each item: { "content": "reply text", "confidence": number between 0 and 1 }. Example: [{"content":"好呀，几点？","confidence":0.9}]`,
    );
    return lines.join('\n');
  }
}
