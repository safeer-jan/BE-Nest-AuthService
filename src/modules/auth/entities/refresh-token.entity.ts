import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// Refresh token entity issue fixed
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  // SHA-256 hex digest of the opaque refresh token. The raw token is only ever sent to the client once.
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  tokenHash!: string;

  // Shared by every token descended from the same login; lets us detect refresh-token reuse (theft).
  @Index()
  @Column({ type: 'uuid' })
  family!: string;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress?: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
