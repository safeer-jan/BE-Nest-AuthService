import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';

describe('RolesController', () => {
  let controller: RolesController;
  let rolesService: Partial<Record<keyof RolesService, jest.Mock>>;
  let permissionsService: Partial<Record<keyof PermissionsService, jest.Mock>>;

  beforeEach(async () => {
    rolesService = {
      findAll: jest.fn().mockResolvedValue([{ id: 'r1', name: 'admin' }]),
      create: jest.fn().mockResolvedValue({ id: 'r2', name: 'editor' }),
      setPermissions: jest.fn().mockResolvedValue({ id: 'r1', name: 'admin', permissions: [] }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    permissionsService = {
      findAll: jest.fn().mockResolvedValue([{ id: 'p1', name: 'users:read' }]),
      create: jest.fn().mockResolvedValue({ id: 'p2', name: 'reports:export' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        { provide: RolesService, useValue: rolesService },
        { provide: PermissionsService, useValue: permissionsService },
      ],
    }).compile();

    controller = module.get(RolesController);
  });

  afterEach(() => jest.clearAllMocks());

  it('lists all roles', async () => {
    await expect(controller.findAll()).resolves.toEqual([{ id: 'r1', name: 'admin' }]);
  });

  it('creates a role', async () => {
    await controller.create({ name: 'editor' });
    expect(rolesService.create).toHaveBeenCalledWith({ name: 'editor' });
  });

  it('replaces a role permission set', async () => {
    await controller.setPermissions('r1', { permissions: ['users:read'] });
    expect(rolesService.setPermissions).toHaveBeenCalledWith('r1', ['users:read']);
  });

  it('deletes a role', async () => {
    await controller.remove('r1');
    expect(rolesService.remove).toHaveBeenCalledWith('r1');
  });

  it('lists all permissions', async () => {
    await expect(controller.findAllPermissions()).resolves.toEqual([{ id: 'p1', name: 'users:read' }]);
  });

  it('creates a permission', async () => {
    await controller.createPermission({ name: 'reports:export' });
    expect(permissionsService.create).toHaveBeenCalledWith({ name: 'reports:export' });
  });
});
