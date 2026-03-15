import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const PLATFORM_VALUES = ['wechat', 'wecom', 'douyin'] as const;
const AUTH_TYPE_VALUES = ['qrcode', 'token'] as const;

export class AuthorizePlatformDto {
  @ApiProperty({ enum: PLATFORM_VALUES, description: 'Platform identifier' })
  @IsString()
  @IsIn(PLATFORM_VALUES)
  platform!: (typeof PLATFORM_VALUES)[number];

  @ApiProperty({ enum: AUTH_TYPE_VALUES, description: 'Auth method' })
  @IsString()
  @IsIn(AUTH_TYPE_VALUES)
  authType!: (typeof AUTH_TYPE_VALUES)[number];
}
