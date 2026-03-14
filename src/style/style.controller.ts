import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { StyleService } from './style.service';
import { UploadChatDto } from './dto/upload-chat.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileQueryDto } from './dto/profile-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('styles')
@ApiBearerAuth()
@Controller('styles')
export class StyleController {
  constructor(private readonly styleService: StyleService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload chat file and create style analysis task' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'platform'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Chat file (.txt, .csv, .json, max 50MB)' },
        platform: { type: 'string', enum: ['wechat', 'douyin', 'other'] },
        description: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded, analysis task created' })
  @ApiResponse({ status: 400, description: 'Validation or file type error' })
  async upload(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadChatDto,
  ) {
    const data = await this.styleService.upload(
      userId,
      file,
      dto.platform,
      dto.description,
    );
    return {
      code: 201,
      message: '文件上传成功，分析任务已创建',
      data,
    };
  }

  @Get('tasks/:taskId')
  @ApiOperation({ summary: 'Get style analysis task status' })
  @ApiResponse({ status: 200, description: 'Task status (pending/processing/completed/failed)' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async getTaskStatus(
    @CurrentUser('sub') userId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    const data = await this.styleService.getTaskStatus(userId, taskId);
    return { code: 200, data };
  }

  @Get('profiles')
  @ApiOperation({ summary: 'List style profiles (paginated, user_id isolated)' })
  @ApiResponse({ status: 200, description: 'Paginated profile list' })
  async listProfiles(
    @CurrentUser('sub') userId: string,
    @Query() query: ProfileQueryDto,
  ) {
    const data = await this.styleService.listProfiles(userId, query);
    return { code: 200, data };
  }

  @Get('profiles/:profileId')
  @ApiOperation({ summary: 'Get style profile detail with samples' })
  @ApiResponse({ status: 200, description: 'Profile detail' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getProfileDetail(
    @CurrentUser('sub') userId: string,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    const data = await this.styleService.getProfileDetail(userId, profileId);
    return { code: 200, data };
  }

  @Put('profiles/:profileId')
  @ApiOperation({ summary: 'Update style profile' })
  @ApiResponse({ status: 200, description: 'Updated profile' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    await this.styleService.updateProfile(userId, profileId, dto);
    const data = await this.styleService.getProfileDetail(userId, profileId);
    return { code: 200, data };
  }

  @Delete('profiles/:profileId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete style profile and Qdrant collection' })
  @ApiResponse({ status: 200, description: 'Profile deleted' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async deleteProfile(
    @CurrentUser('sub') userId: string,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    await this.styleService.deleteProfile(userId, profileId);
    return { code: 200, message: '风格画像已删除' };
  }

  @Post('profiles/:profileId/reanalyze')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Reanalyze style from existing samples' })
  @ApiResponse({ status: 202, description: 'Reanalyze task created' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async reanalyze(
    @CurrentUser('sub') userId: string,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    const data = await this.styleService.reanalyze(userId, profileId);
    return {
      code: 202,
      message: '重新分析任务已创建',
      data,
    };
  }
}
