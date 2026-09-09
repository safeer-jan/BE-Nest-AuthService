import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class AssignUserRolesDto {
  @ApiProperty({
    example: ['admin', 'user'],
    description: 'Full replacement list of role names for this user',
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  roles!: string[];
}
