import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';

describe('RolesService', () => {
  let service: RolesService;
  let rolesRepo: any;
  let permissionsRepo: any;

  beforeEach(async () => {
    rolesRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockImplementation((v) => Promise.resolve(v)),
      remove: jest.fn(),
    };
    permissionsRepo = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useValue: rolesRepo },
        { provide: getRepositoryToken(Permission), useValue: permissionsRepo },
      ],
    }).compile();

    service = module.get(RolesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a role when the name is not taken', async () => {
      rolesRepo.findOne.mockResolvedValue(null);
      const result = await service.create({ name: 'editor', description: 'Editor role' });
      expect(rolesRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('editor');
    });

    it('throws ConflictException when the role name already exists', async () => {
      rolesRepo.findOne.mockResolvedValue({ id: 'r1', name: 'editor' });
      await expect(service.create({ name: 'editor' })).rejects.toThrow(ConflictException);
    });
  });

  describe('findByIdOrFail', () => {
    it('throws NotFoundException when missing', async () => {
      rolesRepo.findOne.mockResolvedValue(null);
      await expect(service.findByIdOrFail('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setPermissions', () => {
    it('replaces the permission set when all names are valid', async () => {
      rolesRepo.findOne.mockResolvedValue({ id: 'r1', name: 'editor', permissions: [] });
      permissionsRepo.find.mockResolvedValue([
        { id: 'p1', name: 'users:read' },
        { id: 'p2', name: 'users:write' },
      ]);

      const result = await service.setPermissions('r1', ['users:read', 'users:write']);
      expect(result.permissions).toHaveLength(2);
    });

    it('throws NotFoundException when a permission name is unknown', async () => {
      rolesRepo.findOne.mockResolvedValue({ id: 'r1', name: 'editor', permissions: [] });
      permissionsRepo.find.mockResolvedValue([{ id: 'p1', name: 'users:read' }]);

      await expect(service.setPermissions('r1', ['users:read', 'bogus:permission'])).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByNames', () => {
    it('returns an empty array without querying when no names are given', async () => {
      const result = await service.findByNames([]);
      expect(result).toEqual([]);
      expect(rolesRepo.find).not.toHaveBeenCalled();
    });
  });
});
