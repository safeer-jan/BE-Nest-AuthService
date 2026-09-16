import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, Index } from 'typeorm';
import { Role } from './role.entity';

/**
 * A single grantable action, namespaced as "<resource>:<action>" (e.g. "users:read").
 * Permissions are attached to roles, never directly to users -- keep authorization
 * logic centered on roles so it stays auditable and easy to reason about.
 */
@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles!: Role[];
}
