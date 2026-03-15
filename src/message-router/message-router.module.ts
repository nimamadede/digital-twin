import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutingLog } from './entities/routing-log.entity';
import { RoutingRule } from './entities/routing-rule.entity';
import { MessageRouterController } from './message-router.controller';
import { MessageRouterService } from './message-router.service';
import { RuleEngineService } from './services/rule-engine.service';
import { RoutingStatsService } from './services/routing-stats.service';
import { RouteExecutorService } from './services/route-executor.service';
import { ContactModule } from '../contact/contact.module';
import { SceneModule } from '../scene/scene.module';
import { MessageModule } from '../message/message.module';
import { ReplyModule } from '../reply/reply.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RoutingLog, RoutingRule]),
    ContactModule,
    SceneModule,
    MessageModule,
    ReplyModule,
  ],
  controllers: [MessageRouterController],
  providers: [
    MessageRouterService,
    RuleEngineService,
    RoutingStatsService,
    RouteExecutorService,
  ],
  exports: [MessageRouterService, RouteExecutorService],
})
export class MessageRouterModule {}
