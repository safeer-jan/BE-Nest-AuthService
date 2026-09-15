import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { RolesService } from '../rbac/roles.service';

type MockRepo = Partial<Record<keyof Repository<User>, jest.Mock>>;

const createMockRepo = (): MockRepo => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  find: jest.fn(),
});

const mockUserRole = { id: 'role-1', name: 'user', permissions: [] };

describe('UsersService', () => {
  let service: UsersService;
  let repo: MockRepo;
  let rolesService: Partial<Record<keyof RolesService, jest.Mock>>;

  beforeEach(async () => {
    rolesService = {
      findByNames: jest.fn().mockResolvedValue([mockUserRole]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: createMockRepo() },
        { provide: RolesService, useValue: rolesService },
      ],
    }).compile();

    service = module.get(UsersService);
    repo = module.get(getRepositoryToken(User));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates and saves a new user when email is not taken', async () => {
      repo.findOne!.mockResolvedValue(null);
      repo.create!.mockReturnValue({ email: 'a@b.com' });
      repo.save!.mockResolvedValue({ id: '1', email: 'a@b.com' });

      const result = await service.create(
        { email: 'a@b.com', password: 'x', firstName: 'A' } as any,
        'hashed',
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@b.com', passwordHash: 'hashed', roles: [mockUserRole] }),
      );
      expect(result).toEqual({ id: '1', email: 'a@b.com' });
    });

    it('throws ConflictException when email already exists', async () => {
      repo.findOne!.mockResolvedValue({ id: '1', email: 'a@b.com' });

      await expect(
        service.create({ email: 'a@b.com', password: 'x' } as any, 'hashed'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findByIdOrFail', () => {
    it('returns the user when found', async () => {
      repo.findOne!.mockResolvedValue({ id: '1' });
      await expect(service.findByIdOrFail('1')).resolves.toEqual({ id: '1' });
    });

    it('throws NotFoundException when missing', async () => {
      repo.findOne!.mockResolvedValue(null);
      await expect(service.findByIdOrFail('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('merges dto into existing user and saves', async () => {
      repo.findOne!.mockResolvedValue({ id: '1', firstName: 'Old' });
      repo.save!.mockImplementation((u) => Promise.resolve(u));

      const result = await service.update('1', { firstName: 'New' });
      expect(result.firstName).toBe('New');
    });
  });
});
