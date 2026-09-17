import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { Permission } from './entities/permission.entity';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockImplementation((v) => Promise.resolve(v)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionsService, { provide: getRepositoryToken(Permission), useValue: repo }],
    }).compile();

    service = module.get(PermissionsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a permission when the name is not taken', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.create({ name: 'reports:export' });
      expect(repo.save).toHaveBeenCalled();
      expect(result.name).toBe('reports:export');
    });

    it('throws ConflictException when the permission already exists', async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', name: 'reports:export' });
      await expect(service.create({ name: 'reports:export' })).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('returns every permission', async () => {
      repo.find.mockResolvedValue([{ id: 'p1', name: 'users:read' }]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });
  });
});
