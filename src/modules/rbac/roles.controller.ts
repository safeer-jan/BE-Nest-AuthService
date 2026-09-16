import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('rbac')
@ApiBearerAuth('access-token')
@Controller({ path: 'roles', version: '1' })
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @Permissions('roles:read')
  @ApiOperation({ summary: '[admin] List all roles with their permissions' })
  findAll() {
    return this.rolesService.findAll();
  }

  @Post()
  @Permissions('roles:manage')
  @ApiOperation({ summary: '[admin] Create a new role' })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Put(':id/permissions')
  @Permissions('roles:manage')
  @ApiOperation({ summary: "[admin] Replace a role's permission set" })
  setPermissions(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRolePermissionsDto) {
    return this.rolesService.setPermissions(id, dto.permissions);
  }

  @Delete(':id')
  @Permissions('roles:manage')
  @ApiOperation({ summary: '[admin] Delete a role' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.remove(id);
  }

  @Get('permissions/all')
  @Permissions('roles:read')
  @ApiOperation({ summary: '[admin] List every permission in the system' })
  findAllPermissions() {
    return this.permissionsService.findAll();
  }

  @Post('permissions')
  @Permissions('roles:manage')
  @ApiOperation({ summary: '[admin] Create a new permission' })
  createPermission(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.create(dto);
  }
}
