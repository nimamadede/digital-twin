import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SceneService } from './scene.service';
import { CreateSceneDto } from './dto/create-scene.dto';
import { UpdateSceneDto } from './dto/update-scene.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('scenes')
@ApiBearerAuth()
@Controller('scenes')
export class SceneController {
  constructor(private readonly sceneService: SceneService) {}

  @Get()
  @ApiOperation({ summary: 'Get scene list' })
  @ApiResponse({ status: 200, description: 'List of scenes' })
  async list(@CurrentUser('sub') userId: string) {
    return this.sceneService.findAll(userId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get current active scene' })
  @ApiResponse({ status: 200, description: 'Active scene or null' })
  async getActive(@CurrentUser('sub') userId: string) {
    return this.sceneService.findActive(userId);
  }

  @Get(':sceneId')
  @ApiOperation({ summary: 'Get scene detail' })
  @ApiResponse({ status: 200, description: 'Scene detail' })
  @ApiResponse({ status: 404, description: 'Scene not found' })
  async getOne(
    @CurrentUser('sub') userId: string,
    @Param('sceneId', ParseUUIDPipe) sceneId: string,
  ) {
    const scene = await this.sceneService.findOneOrFail(userId, sceneId);
    return {
      id: scene.id,
      name: scene.name,
      description: scene.description,
      replyStyle: scene.replyStyle,
      autoReply: scene.autoReply,
      isActive: scene.isActive,
      rules: scene.rules ?? {},
      profileId: scene.profileId,
      sortOrder: scene.sortOrder,
      createdAt: scene.createdAt.toISOString(),
      updatedAt: scene.updatedAt.toISOString(),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create scene' })
  @ApiResponse({ status: 201, description: 'Created scene' })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSceneDto,
  ) {
    return this.sceneService.create(userId, dto);
  }

  @Put(':sceneId')
  @ApiOperation({ summary: 'Update scene' })
  @ApiResponse({ status: 200, description: 'Updated scene' })
  @ApiResponse({ status: 404, description: 'Scene not found' })
  async update(
    @CurrentUser('sub') userId: string,
    @Param('sceneId', ParseUUIDPipe) sceneId: string,
    @Body() dto: UpdateSceneDto,
  ) {
    return this.sceneService.update(userId, sceneId, dto);
  }

  @Delete(':sceneId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete scene' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Scene not found' })
  async remove(
    @CurrentUser('sub') userId: string,
    @Param('sceneId', ParseUUIDPipe) sceneId: string,
  ) {
    await this.sceneService.remove(userId, sceneId);
  }

  @Post(':sceneId/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate scene (deactivates previous active)' })
  @ApiResponse({
    status: 200,
    description: 'Activated; returns activatedScene and deactivatedScene',
  })
  @ApiResponse({ status: 404, description: 'Scene not found' })
  async activate(
    @CurrentUser('sub') userId: string,
    @Param('sceneId', ParseUUIDPipe) sceneId: string,
  ) {
    const data = await this.sceneService.activate(userId, sceneId);
    return { message: '场景已激活', data };
  }

  @Post(':sceneId/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate scene' })
  @ApiResponse({ status: 200, description: 'Deactivated' })
  @ApiResponse({ status: 404, description: 'Scene not found' })
  async deactivate(
    @CurrentUser('sub') userId: string,
    @Param('sceneId', ParseUUIDPipe) sceneId: string,
  ) {
    return this.sceneService.deactivate(userId, sceneId);
  }
}
