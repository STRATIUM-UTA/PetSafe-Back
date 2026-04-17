import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

dotenv.config();

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsGlob = join(currentDir, '../../migrations/*{.ts,.js}');
const entitiesGlob = join(currentDir, '../../domain/entities/**/*.entity{.ts,.js}');
const migrationUsername =
  process.env.DB_PROD_USERNAME || process.env.DB_USERNAME || 'safepet_user';
const migrationPassword =
  process.env.DB_PROD_PASSWORD || process.env.DB_PASSWORD || 'safepet_secret';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: migrationUsername,
  password: migrationPassword,
  database: process.env.DB_NAME || 'safepet_db',
  migrations: [migrationsGlob],
  entities: [entitiesGlob],
  migrationsTransactionMode: 'each',
  synchronize: false,
});
