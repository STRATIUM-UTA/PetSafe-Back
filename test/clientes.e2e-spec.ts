import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module.js';

function randomEmail(prefix: string) {
  return `${prefix}.${randomUUID()}@example.com`.toLowerCase();
}

function randomDocumentId() {
  const digits = randomUUID().replace(/\D/g, '');
  return digits.padEnd(10, '0').slice(0, 10);
}

async function getRoleId(dataSource: DataSource, roleName: string): Promise<number> {
  const rows = (await dataSource.query(
    `SELECT id FROM roles WHERE name = $1 AND deleted_at IS NULL LIMIT 1`,
    [roleName],
  )) as Array<{ id: number }>;

  if (!rows.length) {
    throw new Error(`Role not found: ${roleName}`);
  }

  return rows[0].id;
}

async function seedUser(
  dataSource: DataSource,
  {
    roleName,
    personType,
    firstName,
    lastName,
    documentId = randomDocumentId(),
    email,
    password,
    createClient = false,
  }: {
    roleName: 'ADMIN' | 'CLIENTE_APP';
    personType: 'EMPLEADO' | 'CLIENTE';
    firstName: string;
    lastName: string;
    documentId?: string;
    email: string;
    password: string;
    createClient?: boolean;
  },
) {
  const passwordHash = await bcrypt.hash(password, 10);
  const roleId = await getRoleId(dataSource, roleName);

  const personRows = (await dataSource.query(
    `INSERT INTO persons (person_type, first_name, last_name, document_id, phone, address, gender, birth_date, is_active)
     VALUES ($1, $2, $3, $4, NULL, NULL, NULL, NULL, true)
     RETURNING id`,
    [personType, firstName, lastName, documentId],
  )) as Array<{ id: number }>;

  const personId = personRows[0].id;

  const userRows = (await dataSource.query(
    `INSERT INTO users (person_id, email, password_hash, is_active)
     VALUES ($1, $2, $3, true)
     RETURNING id`,
    [personId, email, passwordHash],
  )) as Array<{ id: number }>;

  const userId = userRows[0].id;

  await dataSource.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [userId, roleId],
  );

  let clientId: number | null = null;

  if (createClient) {
    const clientRows = (await dataSource.query(
      `INSERT INTO clients (person_id, notes, is_active)
       VALUES ($1, NULL, true)
       RETURNING id`,
      [personId],
    )) as Array<{ id: number }>;

    clientId = clientRows[0].id;
  }

  return { userId, personId, clientId, email, password };
}

async function login(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(201);

  expect(typeof response.body.accessToken).toBe('string');
  return response.body.accessToken as string;
}

describe('Clients + Users (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('CLIENTE_APP puede consultar y actualizar /users/me', async () => {
    const seededUser = await seedUser(dataSource, {
      roleName: 'CLIENTE_APP',
      personType: 'CLIENTE',
      firstName: 'Juan',
      lastName: 'Perez',
      email: randomEmail('cliente.profile'),
      password: 'Passw0rd!123',
      createClient: true,
    });

    const token = await login(app, seededUser.email, seededUser.password);

    const profileResponse = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profileResponse.body.email).toBe(seededUser.email);
    expect(profileResponse.body.person.firstName).toBe('Juan');

    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        phone: '555-0001',
      })
      .expect(200);

    const updatedProfileResponse = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(updatedProfileResponse.body.person.phone).toBe('555-0001');
  });

  it('CLIENTE_APP no puede acceder al listado de /clients', async () => {
    const seededUser = await seedUser(dataSource, {
      roleName: 'CLIENTE_APP',
      personType: 'CLIENTE',
      firstName: 'Ana',
      lastName: 'Cliente',
      email: randomEmail('cliente.forbidden'),
      password: 'Passw0rd!123',
      createClient: true,
    });

    const token = await login(app, seededUser.email, seededUser.password);

    await request(app.getHttpServer())
      .get('/clients?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('ADMIN puede listar clientes con paginacion y filtro por email', async () => {
    const adminUser = await seedUser(dataSource, {
      roleName: 'ADMIN',
      personType: 'EMPLEADO',
      firstName: 'Admin',
      lastName: 'Test',
      email: randomEmail('admin'),
      password: 'Admin123!Pass',
    });

    const listedClient = await seedUser(dataSource, {
      roleName: 'CLIENTE_APP',
      personType: 'CLIENTE',
      firstName: 'List',
      lastName: 'User',
      email: randomEmail('cliente.list'),
      password: 'Passw0rd!123',
      createClient: true,
    });

    const adminToken = await login(app, adminUser.email, adminUser.password);

    const listResponse = await request(app.getHttpServer())
      .get('/clients?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(listResponse.body.data)).toBe(true);
    expect(listResponse.body.meta).toHaveProperty('totalItems');

    const filterResponse = await request(app.getHttpServer())
      .get(`/clients?page=1&limit=10&email=${encodeURIComponent(listedClient.email)}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(filterResponse.body.data.length).toBeGreaterThanOrEqual(1);
    expect(filterResponse.body.data[0].email).toBe(listedClient.email);
  });
});
