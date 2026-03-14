import {
  Controller,
  Get,
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
import { StorageService } from './storage.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileQueryDto } from './dto/file-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('storage')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload file to MinIO and create file record' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'purpose'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'File to upload' },
        purpose: { type: 'string', enum: ['style_analysis', 'export'] },
        expiresIn: { type: 'number', nullable: true, description: 'Optional expiry in seconds (60-604800)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Validation or file error' })
  async upload(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ) {
    const result = await this.storageService.upload(
      userId,
      file,
      dto.purpose,
      dto.expiresIn,
    );
    return { message: '文件上传成功', data: result };
  }

  @Get('files')
  @ApiOperation({ summary: 'List uploaded files with pagination (user_id isolated)' })
  @ApiResponse({ status: 200, description: 'Paginated file list' })
  async list(
    @CurrentUser('sub') userId: string,
    @Query() query: FileQueryDto,
  ) {
    return this.storageService.findAll(userId, query);
  }

  @Get('files/:fileId')
  @ApiOperation({ summary: 'Get file metadata by id (user_id isolated)' })
  @ApiResponse({ status: 200, description: 'File metadata' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getOne(
    @CurrentUser('sub') userId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    const file = await this.storageService.findOneOrFail(userId, fileId);
    return {
      id: file.id,
      fileName: file.fileName,
      fileSize: Number(file.fileSize),
      mimeType: file.mimeType,
      purpose: file.purpose,
      status: file.status,
      expiresAt: file.expiresAt?.toISOString() ?? null,
      createdAt: file.createdAt.toISOString(),
    };
  }

  @Get('files/:fileId/download')
  @ApiOperation({ summary: 'Get presigned download URL (user_id isolated)' })
  @ApiResponse({ status: 200, description: 'Presigned URL' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getDownloadUrl(
    @CurrentUser('sub') userId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query('expiry') expirySeconds?: number,
  ) {
    const url = await this.storageService.getPresignedDownloadUrl(
      userId,
      fileId,
      expirySeconds && expirySeconds >= 60 && expirySeconds <= 86400
        ? expirySeconds
        : 3600,
    );
    return { data: { downloadUrl: url, expiresIn: 3600 } };
  }

  @Delete('files/:fileId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete file and remove from MinIO (user_id isolated)' })
  @ApiResponse({ status: 200, description: 'File deleted' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async remove(
    @CurrentUser('sub') userId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    await this.storageService.remove(userId, fileId);
    return { message: '已删除' };
  }
}
