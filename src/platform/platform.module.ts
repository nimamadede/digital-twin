import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformAuth } from './entities/platform-auth.entity';
import { PlatformController } from './platform.controller';
import { WeComCallbackController } from './controllers/wecom-callback.controller';
import { PlatformService } from './platform.service';
import { MessageListenerService } from './services/message-listener.service';
import {
  PLATFORM_CONNECTOR_REGISTRY,
  type ConnectorRegistry,
} from './services/message-listener.service';
import { WechatConnector } from './connectors/wechat.connector';
import { WeComConnector } from './connectors/wecom.connector';
import { DouyinConnector } from './connectors/douyin.connector';

const wecomConnector = new WeComConnector();

function createConnectorRegistry(): ConnectorRegistry {
  const map = new Map();
  map.set('wechat', new WechatConnector());
  map.set('wecom', wecomConnector);
  map.set('douyin', new DouyinConnector());
  return map as ConnectorRegistry;
}

@Module({
  imports: [TypeOrmModule.forFeature([PlatformAuth])],
  controllers: [PlatformController, WeComCallbackController],
  providers: [
    PlatformService,
    MessageListenerService,
    {
      provide: PLATFORM_CONNECTOR_REGISTRY,
      useFactory: createConnectorRegistry,
    },
    {
      provide: WeComConnector,
      useValue: wecomConnector,
    },
  ],
  exports: [PlatformService],
})
export class PlatformModule {}
