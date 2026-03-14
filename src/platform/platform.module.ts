import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformAuth } from './entities/platform-auth.entity';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { MessageListenerService } from './services/message-listener.service';
import {
  PLATFORM_CONNECTOR_REGISTRY,
  type ConnectorRegistry,
} from './services/message-listener.service';
import { WechatConnector } from './connectors/wechat.connector';
import { DouyinConnector } from './connectors/douyin.connector';

function createConnectorRegistry(): ConnectorRegistry {
  const map = new Map();
  map.set('wechat', new WechatConnector());
  map.set('douyin', new DouyinConnector());
  return map as ConnectorRegistry;
}

@Module({
  imports: [TypeOrmModule.forFeature([PlatformAuth])],
  controllers: [PlatformController],
  providers: [
    PlatformService,
    MessageListenerService,
    {
      provide: PLATFORM_CONNECTOR_REGISTRY,
      useFactory: createConnectorRegistry,
    },
  ],
  exports: [PlatformService],
})
export class PlatformModule {}
