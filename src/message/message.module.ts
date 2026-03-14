import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Message } from './entities/message.entity';
import { MessageExportTask } from './entities/message-export-task.entity';
import { ReplyRecord } from '../reply/entities/reply-record.entity';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { MessageStatsService } from './services/message-stats.service';
import { MESSAGE_EXPORT_QUEUE_NAME } from './constants';
import { MessageExportProcessor } from './processors/message-export.processor';
import { ContactModule } from '../contact/contact.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, MessageExportTask, ReplyRecord]),
    BullModule.registerQueue({ name: MESSAGE_EXPORT_QUEUE_NAME }),
    ContactModule,
    StorageModule,
  ],
  controllers: [MessageController],
  providers: [MessageService, MessageStatsService, MessageExportProcessor],
  exports: [MessageService],
})
export class MessageModule {}
