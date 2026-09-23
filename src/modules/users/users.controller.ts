import { Controller, Get, Patch, Post, Body, Param, ParseUUIDPipe, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AssignUserRolesDto } from '../rbac/dto/assign-user-roles.dto';
import { avatarMulterOptions } from './multer-avatar.config';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    const full = await this.usersService.findByIdOrFail(user.id);
    return full;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the currently authenticated user profile' })
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.id, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar', avatarMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { avatar: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({ summary: 'Upload/replace the current user\'s profile picture (JPEG/PNG/WebP, max 2MB)' })
  async uploadAvatar(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.usersService.updateAvatar(user.id, file.filename);
  }

  @Get()
  @Permissions('users:read')
  @ApiOperation({ summary: '[admin] List all users' })
  findAll() {
    return this.usersService.findAll();
  }

  @Patch(':id/roles')
  @Permissions('users:manage-roles')
  @ApiOperation({ summary: "[admin] Replace a user's role assignments" })
  assignRoles(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignUserRolesDto) {
    return this.usersService.assignRoles(id, dto.roles);
  }
}
