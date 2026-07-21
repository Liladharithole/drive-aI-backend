import { Test, TestingModule } from '@nestjs/testing';
import { VectorSearchService } from './vector-search.service';

describe('VectorSearchService', () => {
  let service: VectorSearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VectorSearchService],
    }).compile();

    service = module.get<VectorSearchService>(VectorSearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 2, 3];
      const similarity = service.cosineSimilarity(vec, vec);
      expect(similarity).toBeCloseTo(1.0);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vecA = [1, 0];
      const vecB = [0, 1];
      const similarity = service.cosineSimilarity(vecA, vecB);
      expect(similarity).toBeCloseTo(0.0);
    });

    it('should return -1 for opposite vectors', () => {
      const vecA = [1, 1];
      const vecB = [-1, -1];
      const similarity = service.cosineSimilarity(vecA, vecB);
      expect(similarity).toBeCloseTo(-1.0);
    });
  });

  describe('findTopKMatches', () => {
    it('should rank candidates by highest similarity score', () => {
      const query = [1, 0, 0];
      const candidates = [
        {
          uuid: '1',
          chunkIndex: 0,
          content: 'orthogonal',
          embedding: [0, 1, 0],
        },
        {
          uuid: '2',
          chunkIndex: 1,
          content: 'exact match',
          embedding: [1, 0, 0],
        },
        {
          uuid: '3',
          chunkIndex: 2,
          content: 'close match',
          embedding: [0.9, 0.1, 0],
        },
      ];

      const topMatches = service.findTopKMatches(query, candidates, 2);

      expect(topMatches.length).toBe(2);
      expect(topMatches[0].uuid).toBe('2'); // highest score
      expect(topMatches[1].uuid).toBe('3');
    });
  });
});
