import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SceneMode } from './entities/scene-mode.entity';
import { SceneController } from './scene.controller';
import { SceneService } from './scene.service';
import { SceneSchedulerService } from './services/scene-scheduler.service';

@Module({
  imports: [TypeOrmModule.forFeature([SceneMode])],
  controllers: [SceneController],
  providers: [SceneService, SceneSchedulerService],
  exports: [SceneService, SceneSchedulerService],
})
export class SceneModule {}
