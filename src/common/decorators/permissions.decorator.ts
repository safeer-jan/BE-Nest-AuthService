import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Marks a route as requiring ALL of the given permissions (fine-grained RBAC).
 * Prefer this over @Roles() for new endpoints -- it decouples authorization
 * from role names, so permissions can be reassigned between roles without touching code.
 */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
