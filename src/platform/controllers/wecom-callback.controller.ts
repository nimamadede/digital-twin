import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
  Req,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { WeComConnector } from '../connectors/wecom.connector';

@ApiTags('wecom-callback')
@Controller('wecom/callback')
export class WeComCallbackController {
  private readonly logger = new Logger(WeComCallbackController.name);

  constructor(private readonly wecomConnector: WeComConnector) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'WeCom callback URL verification' })
  verifyUrl(
    @Query('msg_signature') msgSignature: string,
    @Query('timestamp') timestamp: string,
    @Query('nonce') nonce: string,
    @Query('echostr') echostr: string,
  ): string {
    return this.wecomConnector.verifyCallback(
      msgSignature,
      timestamp,
      nonce,
      echostr,
    );
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async receiveMessage(
    @Query('msg_signature') msgSignature: string,
    @Query('timestamp') timestamp: string,
    @Query('nonce') nonce: string,
    @Body() body: string,
  ): Promise<string> {
    const parsed = await this.wecomConnector.handleMessageCallback(
      msgSignature,
      timestamp,
      nonce,
      typeof body === 'string' ? body : JSON.stringify(body),
    );
    if (parsed) {
      this.logger.log(
        `WeCom message: type=${parsed.msgType} from=${parsed.fromUser}`,
      );
    }
    return 'success';
  }
}
