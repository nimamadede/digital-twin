import { Test, TestingModule } from '@nestjs/testing';
import { StyleAnalyzerService } from './style-analyzer.service';
import { STYLE_VECTOR_DIMENSION } from './vector-store.service';

describe('StyleAnalyzerService', () => {
  let service: StyleAnalyzerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StyleAnalyzerService],
    }).compile();
    service = module.get<StyleAnalyzerService>(StyleAnalyzerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyze', () => {
    it('should return default traits for empty samples', () => {
      const result = service.analyze([]);
      expect(result.formality).toBe(0.5);
      expect(result.response_length).toBe('medium');
      expect(result.tone).toBe('casual');
    });

    it('should return traits with keywords and sentence_patterns for non-empty samples', () => {
      const samples = [
        { content: '哈哈好的，那我们明天见吧', platform: 'wechat' },
        { content: '嗯嗯，可以的呀', platform: 'wechat' },
      ];
      const result = service.analyze(samples);
      expect(result).toHaveProperty('keywords');
      expect(result).toHaveProperty('sentence_patterns');
      expect(result.avg_message_length).toBeGreaterThan(0);
      expect([0, 1]).toContain(result.formality);
      expect(['short', 'medium', 'long']).toContain(result.response_length);
    });
  });

  describe('embed', () => {
    it('should return vector of given dimension', () => {
      const v = service.embed('hello', STYLE_VECTOR_DIMENSION);
      expect(v).toHaveLength(STYLE_VECTOR_DIMENSION);
      expect(v.every((x) => typeof x === 'number')).toBe(true);
    });

    it('should be deterministic for same input', () => {
      const a = service.embed('same text', 32);
      const b = service.embed('same text', 32);
      expect(a).toEqual(b);
    });
  });
});
