import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ReplyRecord } from './entities/reply-record.entity';
import { UserSettings } from '../user/entities/user-settings.entity';
import { ReplyController } from './reply.controller';
import { ReplyService } from './reply.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { AiEngineService } from './services/ai-engine.service';
import { ReplyGenerationProcessor, REPLY_QUEUE_NAME } from './processors/reply-generation.processor';
import { ContactModule } from '../contact/contact.module';
import { StyleModule } from '../style/style.module';
import { SceneModule } from '../scene/scene.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReplyRecord, UserSettings]),
    BullModule.registerQueue({ name: REPLY_QUEUE_NAME }),
    ContactModule,
    StyleModule,
    SceneModule,
  ],
  controllers: [ReplyController],
  providers: [
    ReplyService,
    PromptBuilderService,
    AiEngineService,
    ReplyGenerationProcessor,
  ],
  exports: [ReplyService],
})
export class ReplyModule {}
