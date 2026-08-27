import 'reflect-metadata';
import * as argon2 from 'argon2';
import { AppDataSource } from '../data-source';

// Creates a demo admin user with the 'admin' role. Run with: npm run db:seed
async function seed() {
  const ds = await AppDataSource.initialize();

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const existing = await ds.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length > 0) {
    console.log(`Seed user ${email} already exists, skipping.`);
    await ds.destroy();
    return;
  }

  const adminRole = await ds.query(`SELECT id FROM roles WHERE name = 'admin'`);
  if (adminRole.length === 0) {
    throw new Error('"admin" role not found -- run migrations first (npm run migration:run)');
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const inserted = await ds.query(
    `INSERT INTO users (email, "passwordHash", "firstName", "lastName", "isEmailVerified")
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [email, passwordHash, 'Admin', 'User', true],
  );
  const userId = inserted[0].id;

  await ds.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [userId, adminRole[0].id]);

  console.log(`✅ Seeded admin user: ${email} / ${password}`);
  await ds.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
