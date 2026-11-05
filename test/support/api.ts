import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Response, Test } from 'supertest';

export const PASSWORD = 'Passw0rd!test';

export type ProjectRole = 'ADMIN' | 'MANAGER' | 'MEMBER';

export interface TestUser {
  id: string;
  email: string;
  fullName: string;
  password: string;
  token: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Body = any;

export interface AuthedRequester {
  get(url: string): Test;
  post(url: string): Test;
  put(url: string): Test;
  patch(url: string): Test;
  delete(url: string): Test;
}

let counter = 0;
const nextId = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Kutilgan status kodi bo'lmasa - javob tanasi bilan birga tushunarli xato tashlaydi. */
export function must(res: Response, status: number | number[], what = 'so\'rov'): Response {
  const expected = Array.isArray(status) ? status : [status];
  if (!expected.includes(res.status)) {
    throw new Error(
      `${what}: ${expected.join('/')} kutilgan edi, ${res.status} qaytdi. Javob: ${JSON.stringify(res.body)}`,
    );
  }
  return res;
}

/**
 * HTTP orqali sahna tayyorlash yordamchilari. Hech qachon DB ga to'g'ridan-to'g'ri yozmaydi:
 * testlar faqat jamoat API shartnomasiga tayanadi.
 */
export class Api {
  constructor(public readonly app: INestApplication) {}

  /** Autentifikatsiyasiz so'rovlar */
  get anon(): AuthedRequester {
    return this.requester();
  }

  /** `Authorization: Bearer <token>` bilan so'rovlar */
  as(user: Pick<TestUser, 'token'>): AuthedRequester {
    return this.requester(`Bearer ${user.token}`);
  }

  asToken(token: string): AuthedRequester {
    return this.requester(`Bearer ${token}`);
  }

  private requester(authorization?: string): AuthedRequester {
    const server = this.app.getHttpServer();
    const wrap = (t: Test) => (authorization ? t.set('Authorization', authorization) : t);
    return {
      get: (url) => wrap(request(server).get(url)),
      post: (url) => wrap(request(server).post(url)),
      put: (url) => wrap(request(server).put(url)),
      patch: (url) => wrap(request(server).patch(url)),
      delete: (url) => wrap(request(server).delete(url)),
    };
  }

  /* ----------------------------- foydalanuvchilar ----------------------------- */

  async createUser(overrides: Partial<{ email: string; fullName: string; password: string }> = {}): Promise<TestUser> {
    const id = nextId();
    const email = overrides.email ?? `user-${id}@example.test`;
    const fullName = overrides.fullName ?? `Test User ${id}`;
    const password = overrides.password ?? PASSWORD;

    const reg = must(await this.anon.post('/auth/register').send({ email, password, fullName }), 201, 'register');
    const login = must(await this.anon.post('/auth/login').send({ email, password }), 200, 'login');
    return { id: reg.body.id, email: reg.body.email, fullName, password, token: login.body.accessToken };
  }

  /** ADMIN_EMAIL bilan ro'yxatdan o'tgan foydalanuvchi global ADMIN bo'ladi. */
  async createGlobalAdmin(): Promise<TestUser> {
    return this.createUser({ email: process.env.ADMIN_EMAIL, fullName: 'Global Admin' });
  }

  /* -------------------------------- loyihalar -------------------------------- */

  async createProject(actor: TestUser, body: Body = {}): Promise<Body> {
    const payload = { name: `Project ${nextId()}`, description: 'Test project', ...body };
    return must(await this.as(actor).post('/projects').send(payload), 201, 'createProject').body;
  }

  async addMember(actor: TestUser, projectId: string, target: Pick<TestUser, 'email'>, role: ProjectRole): Promise<Body> {
    return must(
      await this.as(actor).post(`/projects/${projectId}/members`).send({ email: target.email, role }),
      201,
      'addMember',
    ).body;
  }

  /* ---------------------------------- vazifalar ---------------------------------- */

  async createTask(actor: TestUser, projectId: string, body: Body = {}): Promise<Body> {
    const payload = { title: `Task ${nextId()}`, ...body };
    return must(await this.as(actor).post(`/projects/${projectId}/tasks`).send(payload), 201, 'createTask').body;
  }

  async assignTask(actor: TestUser, taskId: string, assigneeId: string | null): Promise<Body> {
    return must(await this.as(actor).put(`/tasks/${taskId}/assignee`).send({ assigneeId }), 200, 'assignTask').body;
  }

  async setTaskStatus(actor: TestUser, taskId: string, status: string): Promise<Body> {
    return must(await this.as(actor).patch(`/tasks/${taskId}/status`).send({ status }), 200, 'setTaskStatus').body;
  }

  /* --------------------------------- biriktirmalar --------------------------------- */

  uploadTo(actor: TestUser, url: string, file: { buffer: Buffer; filename: string; contentType?: string }): Test {
    return this.as(actor)
      .post(url)
      .attach('file', file.buffer, { filename: file.filename, contentType: file.contentType });
  }

  async uploadToProject(
    actor: TestUser,
    projectId: string,
    file: { buffer: Buffer; filename: string; contentType?: string },
  ): Promise<Body> {
    return must(await this.uploadTo(actor, `/projects/${projectId}/attachments`, file), 201, 'uploadToProject').body;
  }

  async uploadToTask(
    actor: TestUser,
    taskId: string,
    file: { buffer: Buffer; filename: string; contentType?: string },
  ): Promise<Body> {
    return must(await this.uploadTo(actor, `/tasks/${taskId}/attachments`, file), 201, 'uploadToTask').body;
  }

  /* ------------------------------------ jamoa ------------------------------------ */

  /**
   * Standart sahna:
   *  - globalAdmin: global ADMIN (loyiha a'zosi emas)
   *  - owner: loyiha egasi (loyiha roli ADMIN)
   *  - manager: loyihada MANAGER
   *  - member, member2: loyihada MEMBER
   *  - outsider: oddiy foydalanuvchi, loyihaga a'zo emas
   *  - project: owner yaratgan faol loyiha
   */
  async createTeam() {
    const [globalAdmin, owner, manager, member, member2, outsider] = await Promise.all([
      this.createGlobalAdmin(),
      this.createUser({ fullName: 'Owner User' }),
      this.createUser({ fullName: 'Manager User' }),
      this.createUser({ fullName: 'Member One' }),
      this.createUser({ fullName: 'Member Two' }),
      this.createUser({ fullName: 'Outsider User' }),
    ]);
    const project = await this.createProject(owner);
    await this.addMember(owner, project.id, manager, 'MANAGER');
    await this.addMember(owner, project.id, member, 'MEMBER');
    await this.addMember(owner, project.id, member2, 'MEMBER');
    return { globalAdmin, owner, manager, member, member2, outsider, project };
  }
}

/* ------------------------------ umumiy tekshiruvlar ------------------------------ */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const BCRYPT_RE = /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/;
export const ARGON_RE = /\$argon2(id|i|d)\$/;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
