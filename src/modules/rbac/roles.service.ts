import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionsRepo: Repository<Permission>,
  ) {}

  findAll(): Promise<Role[]> {
    return this.rolesRepo.find();
  }

  async findByIdOrFail(id: string): Promise<Role> {
    const role = await this.rolesRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  findByNames(names: string[]): Promise<Role[]> {
    if (names.length === 0) return Promise.resolve([]);
    return this.rolesRepo.find({ where: { name: In(names) } });
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    const existing = await this.rolesRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Role "${dto.name}" already exists`);

    const role = this.rolesRepo.create({ name: dto.name, description: dto.description, permissions: [] });
    return this.rolesRepo.save(role);
  }

  async remove(id: string): Promise<void> {
    const role = await this.findByIdOrFail(id);
    await this.rolesRepo.remove(role);
  }

  /** Full replacement of a role's permission set, by permission name. Unknown names are rejected. */
  async setPermissions(id: string, permissionNames: string[]): Promise<Role> {
    const role = await this.findByIdOrFail(id);

    const permissions = await this.permissionsRepo.find({ where: { name: In(permissionNames) } });
    const foundNames = new Set(permissions.map((p) => p.name));
    const missing = permissionNames.filter((n) => !foundNames.has(n));
    if (missing.length > 0) {
      throw new NotFoundException(`Unknown permission(s): ${missing.join(', ')}`);
    }

    role.permissions = permissions;
    return this.rolesRepo.save(role);
  }
}
