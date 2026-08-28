import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RolesService } from '../rbac/roles.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly rolesService: RolesService,
  ) {}

  async create(dto: CreateUserDto, passwordHash: string): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    const defaultRoles = await this.rolesService.findByNames(['user']);
    const user = this.usersRepository.create({
      email: dto.email.toLowerCase().trim(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      roles: defaultRoles,
    });
    return this.usersRepository.save(user);
  }

  /** Full replacement of a user's role set, by role name. Used by the admin roles-management endpoint. */
  async assignRoles(id: string, roleNames: string[]): Promise<User> {
    const user = await this.findByIdOrFail(id);
    const roles = await this.rolesService.findByNames(roleNames);
    const foundNames = new Set(roles.map((r) => r.name));
    const missing = roleNames.filter((n) => !foundNames.has(n));
    if (missing.length > 0) {
      throw new NotFoundException(`Unknown role(s): ${missing.join(', ')}`);
    }
    user.roles = roles;
    return this.usersRepository.save(user);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email: email.toLowerCase().trim() } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findByIdOrFail(id);
    Object.assign(user, dto);
    return this.usersRepository.save(user);
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.usersRepository.update(id, { isEmailVerified: true });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.usersRepository.update(id, { passwordHash });
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }
}
