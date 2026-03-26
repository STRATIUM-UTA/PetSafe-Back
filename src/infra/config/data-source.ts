import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'safepet_user',
  password: process.env.DB_PASSWORD || 'safepet_secret',
  database: process.env.DB_NAME || 'safepet_db',
  migrations: ['src/migrations/*.ts'],
  entities: ['src/**/*.entity.ts'],
  synchronize: false,
});
