import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ReplyService } from '../reply.service';

export const REPLY_QUEUE_NAME = 'reply-generation';

export interface ReplyGenerationJobPayload {
  userId: string;
  incomingMessage: string;
  contactId: string;
  profileId?: string;
  sceneId?: string;
  context?: Array<{ role: 'contact' | 'user'; content: string; timestamp: string }>;
  count?: number;
}

/**
 * Async worker for AI reply generation. Enqueue jobs when generation should be deferred.
 * For manual trigger, use ReplyService.generate() directly.
 */
@Processor(REPLY_QUEUE_NAME)
export class ReplyGenerationProcessor extends WorkerHost {
  constructor(private readonly replyService: ReplyService) {
    super();
  }

  async process(job: Job<ReplyGenerationJobPayload>): Promise<unknown> {
    const { userId, incomingMessage, contactId, profileId, sceneId, context, count } =
      job.data;
    return this.replyService.generate(userId, {
      incomingMessage,
      contactId,
      profileId,
      sceneId,
      context,
      count: count ?? 3,
    });
  }
}
