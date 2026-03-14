import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PlatformService } from './platform.service';
import { MessageListenerService } from './services/message-listener.service';
import { AuthorizePlatformDto } from './dto/authorize-platform.dto';
import { UpdatePlatformDto } from './dto/update-platform.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('platforms')
@ApiBearerAuth()
@Controller('platforms')
export class PlatformController {
  constructor(
    private readonly platformService: PlatformService,
    private readonly messageListenerService: MessageListenerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get connected platforms list' })
  @ApiResponse({ status: 200, description: 'List of connected platforms' })
  async list(@CurrentUser('sub') userId: string) {
    return this.platformService.list(userId);
  }

  @Post('authorize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start platform authorization' })
  @ApiResponse({ status: 200, description: 'Auth session with qrcode URL or token' })
  async authorize(
    @CurrentUser('sub') userId: string,
    @Body() dto: AuthorizePlatformDto,
  ) {
    return this.platformService.authorize(userId, dto.platform, dto.authType);
  }

  @Get('authorize/:authId/status')
  @ApiOperation({ summary: 'Poll authorization status' })
  @ApiResponse({ status: 200, description: 'Auth status; platformAuthId when confirmed' })
  async getAuthStatus(
    @CurrentUser('sub') userId: string,
    @Param('authId') authId: string,
  ) {
    return this.platformService.getAuthStatus(userId, authId);
  }

  @Delete(':platformAuthId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect platform' })
  @ApiResponse({ status: 204, description: 'Disconnected' })
  @ApiResponse({ status: 404, description: 'Platform auth not found' })
  async disconnect(
    @CurrentUser('sub') userId: string,
    @Param('platformAuthId', ParseUUIDPipe) platformAuthId: string,
  ) {
    await this.platformService.disconnect(userId, platformAuthId);
  }

  @Put(':platformAuthId')
  @ApiOperation({ summary: 'Update platform config' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 404, description: 'Platform auth not found' })
  async updateConfig(
    @CurrentUser('sub') userId: string,
    @Param('platformAuthId', ParseUUIDPipe) platformAuthId: string,
    @Body() dto: UpdatePlatformDto,
  ) {
    await this.platformService.updateConfig(userId, platformAuthId, dto);
  }

  @Get(':platformAuthId/listener')
  @ApiOperation({ summary: 'Get message listener state' })
  @ApiResponse({ status: 200, description: 'Listener state' })
  @ApiResponse({ status: 404, description: 'Platform auth not found' })
  async getListenerState(
    @CurrentUser('sub') userId: string,
    @Param('platformAuthId', ParseUUIDPipe) platformAuthId: string,
  ) {
    return this.messageListenerService.getState(userId, platformAuthId);
  }

  @Post(':platformAuthId/listener/start')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Start message listener' })
  @ApiResponse({ status: 204, description: 'Started' })
  @ApiResponse({ status: 404, description: 'Platform auth not found' })
  async startListener(
    @CurrentUser('sub') userId: string,
    @Param('platformAuthId', ParseUUIDPipe) platformAuthId: string,
  ) {
    await this.messageListenerService.start(userId, platformAuthId);
  }

  @Post(':platformAuthId/listener/stop')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Stop message listener' })
  @ApiResponse({ status: 204, description: 'Stopped' })
  @ApiResponse({ status: 404, description: 'Platform auth not found' })
  async stopListener(
    @CurrentUser('sub') userId: string,
    @Param('platformAuthId', ParseUUIDPipe) platformAuthId: string,
  ) {
    await this.messageListenerService.stop(userId, platformAuthId);
  }
}
