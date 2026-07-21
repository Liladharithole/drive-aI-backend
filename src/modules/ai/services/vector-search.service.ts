import { Injectable } from '@nestjs/common';

export interface VectorCandidate {
  uuid: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
}

export interface VectorSearchResult extends VectorCandidate {
  similarityScore: number;
}

@Injectable()
export class VectorSearchService {
  /**
   * Calculate Cosine Similarity between two N-dimensional numerical vectors.
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Perform in-memory Cosine Similarity search over a candidate set of vectors.
   */
  findTopKMatches(
    queryVector: number[],
    candidates: VectorCandidate[],
    topK = 3,
  ): VectorSearchResult[] {
    const scoredCandidates: VectorSearchResult[] = candidates.map(
      (candidate) => ({
        ...candidate,
        similarityScore: this.cosineSimilarity(
          queryVector,
          candidate.embedding,
        ),
      }),
    );

    // Sort by highest similarity score descending
    scoredCandidates.sort((a, b) => b.similarityScore - a.similarityScore);

    return scoredCandidates.slice(0, topK);
  }
}
