import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';

import { AppModule } from '../src/app.module';

function randomEmail(prefix: string) {
  return `${prefix}.${randomUUID()}@example.com`.toLowerCase();
}

async function ensureRole(dataSource: DataSource, roleName: string) {
  const existing = await dataSource.query(
    `SELECT id FROM roles WHERE nombre = $1 AND deleted_at IS NULL LIMIT 1`,
    [roleName],
  );
  if (existing?.length) return existing[0].id as number;

  const inserted = await dataSource.query(
    `INSERT INTO roles (nombre, activo) VALUES ($1, true) RETURNING id`,
    [roleName],
  );
  return inserted[0].id as number;
}

describe('Clientes + Me (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);

    // Ensure roles exist
    const adminRoleId = await ensureRole(dataSource, 'ADMIN');
    await ensureRole(dataSource, 'CLIENTE_APP');

    // Seed an admin user for listing endpoints
    const adminEmail = randomEmail('admin');

    const personaInserted = await dataSource.query(
      `INSERT INTO personas (tipo_persona, nombres, apellidos, activo)
       VALUES ('EMPLEADO', 'Admin', 'Test', true)
       RETURNING id`,
    );
    const personaId = personaInserted[0].id as number;

    const usuarioInserted = await dataSource.query(
      `INSERT INTO usuarios (persona_id, correo, password_hash, activo)
       VALUES ($1, $2, 'x', true)
       RETURNING id, uuid`,
      [personaId, adminEmail],
    );
    const usuarioId = usuarioInserted[0].id as number;
    const usuarioUuid = usuarioInserted[0].uuid as string;

    await dataSource.query(
      `INSERT INTO usuarios_roles (usuario_id, rol_id)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id, rol_id) DO NOTHING`,
      [usuarioId, adminRoleId],
    );

    // JWT sub is the external UUID in the refactored code.
    adminToken = jwtService.sign({ sub: usuarioUuid, correo: adminEmail });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('CLIENTE_APP: /me/profile y /me/update funcionan', async () => {
    const correo = randomEmail('cliente');
    const password = 'Passw0rd!123';

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        correo,
        password,
        nombres: 'Juan',
        apellidos: 'Pérez',
      })
      .expect(201);

    const token = registerRes.body.access_token as string;
    expect(typeof token).toBe('string');

    const profileRes = await request(app.getHttpServer())
      .get('/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profileRes.body).toHaveProperty('id');
    expect(profileRes.body).toHaveProperty('correo');
    expect(profileRes.body.persona.nombres).toBe('Juan');

    const newCorreo = randomEmail('cliente.updated');
    await request(app.getHttpServer())
      .patch('/me/update')
      .set('Authorization', `Bearer ${token}`)
      .send({
        correo: newCorreo,
        telefono: '555-0001',
      })
      .expect(200);

    const profileRes2 = await request(app.getHttpServer())
      .get('/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profileRes2.body.correo).toBe(newCorreo);
    expect(profileRes2.body.persona.telefono).toBe('555-0001');
  });

  it('Ownership: CLIENTE_APP no puede leer otro cliente', async () => {
    const mkClient = async (name: string) => {
      const correo = randomEmail(`cliente.${name}`);
      const password = 'Passw0rd!123';

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ correo, password, nombres: name, apellidos: 'Test' })
        .expect(201);

      const token = res.body.access_token as string;
      const profile = await request(app.getHttpServer())
        .get('/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      return { token, clienteId: profile.body.id as string };
    };

    const a = await mkClient('A');
    const b = await mkClient('B');

    await request(app.getHttpServer())
      .get(`/clientes/${b.clienteId}`)
      .set('Authorization', `Bearer ${a.token}`)
      .expect(403);

    const listRes = await request(app.getHttpServer())
      .get('/clientes?page=1&limit=10')
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);

    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].id).toBe(a.clienteId);
  });

  it('ADMIN: listado paginado incluye meta y permite filtro por correo', async () => {
    const correo = randomEmail('cliente.for.list');
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        correo,
        password: 'Passw0rd!123',
        nombres: 'List',
        apellidos: 'User',
      })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/clientes?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(listRes.body).toHaveProperty('data');
    expect(listRes.body).toHaveProperty('meta');
    expect(listRes.body.meta).toHaveProperty('totalItems');

    const filterRes = await request(app.getHttpServer())
      .get(`/clientes?page=1&limit=10&correo=${encodeURIComponent(correo)}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(filterRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(filterRes.body.data[0].correo).toBe(correo);
  });
});
