import { Injectable } from '@nestjs/common';

export interface StyleTraits {
  formality: number;
  humor: number;
  verbosity: number;
  emoji_frequency: number;
  response_length: 'short' | 'medium' | 'long';
  tone: string;
  vocabulary_richness: number;
  keywords: string[];
  sentence_patterns: string[];
  avg_message_length: number;
  punctuation_style: string;
}

export interface SampleInput {
  content: string;
  platform: string;
}

const DEFAULT_TRAITS: StyleTraits = {
  formality: 0.5,
  humor: 0.5,
  verbosity: 0.5,
  emoji_frequency: 0.5,
  response_length: 'medium',
  tone: 'casual',
  vocabulary_richness: 0.5,
  keywords: [],
  sentence_patterns: [],
  avg_message_length: 20,
  punctuation_style: 'standard',
};

/**
 * Style analysis engine: derives traits from chat samples.
 * Current implementation: rule-based heuristics. Can be replaced with LLM/embedding later.
 */
@Injectable()
export class StyleAnalyzerService {
  /**
   * Analyze samples and return aggregated traits. All queries are logically stateless.
   */
  analyze(samples: SampleInput[]): StyleTraits {
    if (!samples.length) return { ...DEFAULT_TRAITS };

    const contents = samples.map((s) => s.content.trim()).filter(Boolean);
    if (!contents.length) return { ...DEFAULT_TRAITS };

    const lengths = contents.map((c) => c.length);
    const avgLen =
      lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const responseLength: StyleTraits['response_length'] =
      avgLen < 15 ? 'short' : avgLen > 60 ? 'long' : 'medium';

    const allText = contents.join('');
    const emojiCount = (allText.match(/[\u{1F300}-\u{1F9FF}]|[\u2600-\u26FF]|[\u2700-\u27BF]/gu) ?? []).length;
    const emoji_frequency = Math.min(1, (emojiCount / Math.max(1, contents.length)) / 3);

    const formalMarkers = (allText.match(/您|请|谢谢|感谢|您好|此致|敬礼/gu) ?? []).length;
    const casualMarkers = (allText.match(/哈哈|嘿嘿|嗯嗯|哦哦|好的呀|嘛|呢|吧/gu) ?? []).length;
    const totalMarkers = formalMarkers + casualMarkers || 1;
    const formality = Math.round((formalMarkers / totalMarkers) * 100) / 100;
    const humor = Math.min(1, (casualMarkers / Math.max(1, contents.length)) * 0.5 + 0.3);

    const wordCount = contents.reduce((sum, c) => sum + (c.split(/\s+/).length || 1), 0);
    const verbosity = Math.min(1, (wordCount / contents.length) / 30);

    const keywords = this.extractKeywords(contents);
    const sentence_patterns = this.extractSentencePatterns(contents);

    const punctStyles = allText.includes('…') || allText.includes('...') ? 'ellipsis' : 'standard';
    const vocabulary_richness = Math.min(1, (new Set(allText.split('')).size / 500) + 0.3);

    return {
      formality: Number(formality.toFixed(2)),
      humor: Number(humor.toFixed(2)),
      verbosity: Number(verbosity.toFixed(2)),
      emoji_frequency: Number(emoji_frequency.toFixed(2)),
      response_length: responseLength,
      tone: formality > 0.6 ? 'formal' : 'casual',
      vocabulary_richness: Number(vocabulary_richness.toFixed(2)),
      keywords: keywords.slice(0, 20),
      sentence_patterns: sentence_patterns.slice(0, 15),
      avg_message_length: Math.round(avgLen),
      punctuation_style: punctStyles,
    };
  }

  /**
   * Generate a simple embedding-like vector for a text (stub: deterministic from length and hash).
   * In production, replace with real embedding API (e.g. OpenAI, local model).
   */
  embed(text: string, dimension: number): number[] {
    const arr: number[] = [];
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = (h * 31 + text.charCodeAt(i)) >>> 0;
    }
    for (let i = 0; i < dimension; i++) {
      const x = Math.sin(h + i * 0.1) * 10000;
      arr.push(x - Math.floor(x));
    }
    return arr;
  }

  private extractKeywords(contents: string[]): string[] {
    const freq: Record<string, number> = {};
    const stop = new Set(['的', '了', '是', '在', '我', '你', '他', '她', '它', '我们', '他们', '这', '那', '有', '和', '与', '就', '都', '而', '及', '或', '一个', '一下', '不', '吗', '呢', '吧', '啊']);
    for (const line of contents) {
      const words = line.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').split(/\s+/).filter(Boolean);
      for (const w of words) {
        if (w.length >= 2 && !stop.has(w)) freq[w] = (freq[w] ?? 0) + 1;
      }
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([k]) => k);
  }

  private extractSentencePatterns(contents: string[]): string[] {
    const patterns: Record<string, number> = {};
    for (const line of contents) {
      const trimmed = line.trim();
      if (trimmed.length < 2) continue;
      const suffix = trimmed.slice(-2);
      patterns[suffix] = (patterns[suffix] ?? 0) + 1;
    }
    return Object.entries(patterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([k]) => `...${k}`);
  }
}
