import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { MessageExportTask } from '../entities/message-export-task.entity';
import { MessageService } from '../message.service';
import { StorageService } from '../../storage/storage.service';
import { MESSAGE_EXPORT_QUEUE_NAME } from '../constants';

export { MESSAGE_EXPORT_QUEUE_NAME };

export interface MessageExportJobPayload {
  taskId: string;
  userId: string;
  contactId?: string;
  startDate?: string;
  endDate?: string;
  format: 'csv' | 'json';
}

const EXPORT_FILE_EXPIRY_SECONDS = 86400 * 7; // 7 days

@Processor(MESSAGE_EXPORT_QUEUE_NAME, { concurrency: 2 })
export class MessageExportProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageExportProcessor.name);

  constructor(
    @InjectRepository(MessageExportTask)
    private readonly exportTaskRepo: Repository<MessageExportTask>,
    private readonly messageService: MessageService,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(job: Job<MessageExportJobPayload>): Promise<void> {
    const { taskId, userId, contactId, startDate, endDate, format } = job.data;

    const task = await this.exportTaskRepo.findOne({
      where: { id: taskId, userId },
    });
    if (!task || task.status !== 'pending') {
      this.logger.warn(`Export task ${taskId} not found or not pending, skip`);
      return;
    }

    await this.exportTaskRepo.update(
      { id: taskId, userId },
      { status: 'processing' },
    );

    try {
      const messages = await this.messageService.findMessagesForExport(
        userId,
        { contactId, startDate, endDate },
      );

      const buffer =
        format === 'csv'
          ? this.buildCsv(messages)
          : Buffer.from(JSON.stringify(this.buildJson(messages)), 'utf-8');
      const fileName = `messages-export-${taskId.slice(0, 8)}.${format}`;
      const mimeType =
        format === 'csv' ? 'text/csv' : 'application/json';

      const uploaded = await this.storageService.uploadFromBuffer(
        userId,
        buffer,
        fileName,
        mimeType,
        'export',
        EXPORT_FILE_EXPIRY_SECONDS,
      );

      const expiresAt = new Date(
        Date.now() + EXPORT_FILE_EXPIRY_SECONDS * 1000,
      );
      await this.exportTaskRepo.update(
        { id: taskId, userId },
        {
          status: 'completed',
          fileUploadId: uploaded.id,
          errorMessage: null,
          expiresAt,
        },
      );
      this.logger.log(`Export task ${taskId} completed, file ${uploaded.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Export task ${taskId} failed: ${message}`);
      await this.exportTaskRepo.update(
        { id: taskId, userId },
        { status: 'failed', errorMessage: message },
      );
    }
  }

  private buildCsv(messages: Message[]): Buffer {
    const header =
      'id,contactId,direction,content,msgType,platform,isAiGenerated,replyRecordId,createdAt\n';
    const rows = messages.map(
      (m) =>
        `${escapeCsv(m.id)},${escapeCsv(m.contactId)},${escapeCsv(m.direction)},${escapeCsv(m.content)},${escapeCsv(m.msgType)},${escapeCsv(m.platform)},${m.isAiGenerated},${m.replyRecordId ?? ''},${m.createdAt.toISOString()}`,
    );
    return Buffer.from(header + rows.join('\n'), 'utf-8');
  }

  private buildJson(messages: Message[]): unknown[] {
    return messages.map((m) => ({
      id: m.id,
      contactId: m.contactId,
      direction: m.direction,
      content: m.content,
      msgType: m.msgType,
      platform: m.platform,
      isAiGenerated: m.isAiGenerated,
      replyRecordId: m.replyRecordId,
      createdAt: m.createdAt.toISOString(),
    }));
  }
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
