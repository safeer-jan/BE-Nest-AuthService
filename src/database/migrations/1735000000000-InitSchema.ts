import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1735000000000 implements MigrationInterface {
  name = 'InitSchema1735000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // --- Core user table (no "roles" column -- roles live in the RBAC tables below) ---
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar(255) NOT NULL,
        "passwordHash" varchar(255) NOT NULL,
        "firstName" varchar(100),
        "lastName" varchar(100),
        "avatarUrl" varchar(500),
        "isEmailVerified" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "tokenHash" varchar(64) NOT NULL,
        "family" uuid NOT NULL,
        "revoked" boolean NOT NULL DEFAULT false,
        "userAgent" varchar(255),
        "ipAddress" varchar(64),
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_userId" ON "refresh_tokens" ("userId");`);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_family" ON "refresh_tokens" ("family");`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_refresh_tokens_tokenHash" ON "refresh_tokens" ("tokenHash");`);

    await queryRunner.query(`CREATE TYPE "auth_token_type_enum" AS ENUM ('password_reset', 'email_verification');`);
    await queryRunner.query(`
      CREATE TABLE "auth_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "tokenHash" varchar(64) NOT NULL,
        "type" "auth_token_type_enum" NOT NULL,
        "used" boolean NOT NULL DEFAULT false,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_auth_tokens_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_auth_tokens_userId_type" ON "auth_tokens" ("userId", "type");`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_auth_tokens_tokenHash" ON "auth_tokens" ("tokenHash");`);

    // --- RBAC: roles, permissions, and their join tables ---
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(100) NOT NULL,
        "description" varchar(255),
        CONSTRAINT "PK_permissions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_permissions_name" UNIQUE ("name")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(50) NOT NULL,
        "description" varchar(255),
        CONSTRAINT "PK_roles_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_roles_name" UNIQUE ("name")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "role_id" uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("role_id", "permission_id"),
        CONSTRAINT "FK_role_permissions_role" FOREIGN KEY ("role_id")
          REFERENCES "roles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_role_permissions_permission" FOREIGN KEY ("permission_id")
          REFERENCES "permissions"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "user_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        CONSTRAINT "PK_user_roles" PRIMARY KEY ("user_id", "role_id"),
        CONSTRAINT "FK_user_roles_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_roles_role" FOREIGN KEY ("role_id")
          REFERENCES "roles"("id") ON DELETE CASCADE
      );
    `);

    // Seed a baseline permission set.
    await queryRunner.query(`
      INSERT INTO "permissions" ("name", "description") VALUES
        ('users:read', 'List and view other users'),
        ('users:manage-roles', 'Assign roles to a user'),
        ('roles:read', 'List roles and permissions'),
        ('roles:manage', 'Create/delete roles and edit their permissions');
    `);

    // Seed baseline roles.
    await queryRunner.query(`
      INSERT INTO "roles" ("name", "description") VALUES
        ('admin', 'Full administrative access'),
        ('user', 'Standard authenticated user');
    `);

    // admin gets every permission seeded above.
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id FROM "roles" r CROSS JOIN "permissions" p WHERE r.name = 'admin';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_roles";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auth_tokens";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "auth_token_type_enum";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
  }
}
