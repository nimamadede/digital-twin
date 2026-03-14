import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

export const STYLE_VECTOR_DIMENSION = 384;
const DISTANCE = 'Cosine' as const;

/**
 * Qdrant vector storage for style profile samples.
 * Each profile has its own collection: style_profile_{profileId}.
 * All operations are scoped by collection name (profileId).
 */
@Injectable()
export class VectorStoreService implements OnModuleInit {
  private client: QdrantClient | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('qdrant.url');
    const apiKey = this.config.get<string>('qdrant.apiKey');
    if (url) {
      this.client = new QdrantClient({ url, apiKey: apiKey ?? undefined });
    }
  }

  private getCollectionName(profileId: string): string {
    return `style_profile_${profileId.replace(/-/g, '_')}`;
  }

  /**
   * Ensure collection exists for profile. Idempotent.
   */
  async ensureCollection(profileId: string): Promise<string> {
    if (!this.client) return this.getCollectionName(profileId);
    const name = this.getCollectionName(profileId);
    try {
      const exists = await this.client.collectionExists(name);
      if (!exists) {
        await this.client.createCollection(name, {
          vectors: {
            size: STYLE_VECTOR_DIMENSION,
            distance: DISTANCE,
          },
        });
      }
    } catch (err) {
      // Collection may already exist from concurrent create
      const exists = await this.client.collectionExists(name);
      if (!exists) throw err;
    }
    return name;
  }

  /**
   * Upsert sample vectors for a profile. Creates collection if needed.
   * @param profileId - style profile id
   * @param points - array of { id (sample id), vector, payload? }
   */
  async upsert(
    profileId: string,
    points: Array<{ id: string; vector: number[]; payload?: Record<string, unknown> }>,
  ): Promise<void> {
    if (!this.client || points.length === 0) return;
    await this.ensureCollection(profileId);
    const name = this.getCollectionName(profileId);
    await this.client.upsert(name, {
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload ?? {},
      })),
      wait: true,
    });
  }

  /**
   * Delete collection when profile is deleted (data isolation).
   */
  async deleteCollection(profileId: string): Promise<void> {
    if (!this.client) return;
    const name = this.getCollectionName(profileId);
    try {
      await this.client.deleteCollection(name);
    } catch {
      // Collection may not exist
    }
  }
}
