import { Controller, Get, Patch, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AssignUserRolesDto } from '../rbac/dto/assign-user-roles.dto';

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
