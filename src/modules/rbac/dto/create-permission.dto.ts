import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'reports:export', description: 'Format: "<resource>:<action>"' })
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9_-]+:[a-z0-9_-]+$/, {
    message: 'name must follow the "<resource>:<action>" format, e.g. "users:read"',
  })
  name!: string;

  @ApiPropertyOptional({ example: 'Export report data as CSV' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
