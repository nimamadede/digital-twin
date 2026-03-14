import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { StorageModule } from '../storage/storage.module';
import { StyleProfile } from './entities/style-profile.entity';
import { StyleSample } from './entities/style-sample.entity';
import { StyleTask } from './entities/style-task.entity';
import { StyleController } from './style.controller';
import { StyleService, STYLE_QUEUE_NAME } from './style.service';
import { StyleAnalysisProcessor } from './processors/style-analysis.processor';
import { StyleAnalyzerService } from './services/style-analyzer.service';
import { VectorStoreService } from './services/vector-store.service';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

@Module({
  imports: [
    TypeOrmModule.forFeature([StyleProfile, StyleSample, StyleTask]),
    BullModule.registerQueue({ name: STYLE_QUEUE_NAME }),
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
    StorageModule,
  ],
  controllers: [StyleController],
  providers: [
    StyleService,
    StyleAnalyzerService,
    VectorStoreService,
    StyleAnalysisProcessor,
  ],
  exports: [StyleService],
})
export class StyleModule {}
