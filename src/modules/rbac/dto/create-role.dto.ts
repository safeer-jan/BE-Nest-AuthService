import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'editor', description: 'Lowercase, alphanumeric + hyphen/underscore only' })
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'name must be lowercase alphanumeric with optional hyphens/underscores',
  })
  name!: string;

  @ApiPropertyOptional({ example: 'Can edit content but not manage users' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
