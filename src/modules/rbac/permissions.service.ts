import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionsRepo: Repository<Permission>,
  ) {}

  findAll(): Promise<Permission[]> {
    return this.permissionsRepo.find();
  }

  async create(dto: CreatePermissionDto): Promise<Permission> {
    const existing = await this.permissionsRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Permission "${dto.name}" already exists`);

    const permission = this.permissionsRepo.create(dto);
    return this.permissionsRepo.save(permission);
  }
}
