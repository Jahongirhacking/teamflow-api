# TeamFlow API — Advanced+ topshiriq

> **Daraja:** Advanced+ · **Yondashuv:** Test-First (avval testlar, keyin kod) · **Stack:** Node.js 24, NestJS 11, TypeScript, PostgreSQL, TypeORM, Passport + JWT, Multer, Vitest, Supertest

Siz oldingi yetti topshiriqda o'rgangan hamma narsani (modul/DI/DTO, validatsiya va filterlar, TypeORM, autentifikatsiya, RBAC, interceptor/middleware/pipe, fayl yuklash) **bitta yaxlit, production'ga yaqin backend** ichida birlashtirasiz.

Bu repozitoriyda **tayyor bo'lgan narsa — faqat testlar va test infratuzilmasi**. Ilovaning o'zini (modul, controller, service, entity, guard, interceptor, middleware, migratsiya, storage) **siz noldan yozasiz**. Boshlang'ich holatda barcha testlar yiqiladi — bu normal. Maqsad: testlarni birin-ketin yashil qilish.

---

## Mundarija

1. [Loyiha haqida umumiy ma'lumot](#1-loyiha-haqida-umumiy-malumot)
2. [Real hayotiy muammo](#2-real-hayotiy-muammo)
3. [Maqsadlar](#3-maqsadlar)
4. [Funksional talablar](#4-funksional-talablar)
5. [Nofunksional talablar](#5-nofunksional-talablar)
6. [Rollar va ruxsatlar matritsasi](#6-rollar-va-ruxsatlar-matritsasi)
7. [API shartnomasi (endpointlar)](#7-api-shartnomasi)
8. [So'rov / javob misollari](#8-sorov--javob-misollari)
9. [HTTP status kodlari](#9-http-status-kodlari)
10. [Ma'lumotlar bazasi: biznes talablari](#10-malumotlar-bazasi-biznes-talablari)
11. [Entity munosabatlari (oddiy tilda)](#11-entity-munosabatlari-oddiy-tilda)
12. [Autentifikatsiya oqimi](#12-autentifikatsiya-oqimi)
13. [Avtorizatsiya oqimi](#13-avtorizatsiya-oqimi)
14. [Fayl yuklash oqimi](#14-fayl-yuklash-oqimi)
15. [So'rovni qayta ishlash oqimi](#15-sorovni-qayta-ishlash-oqimi)
16. [Validatsiya va xatolarni qayta ishlash](#16-validatsiya-va-xatolarni-qayta-ishlash)
17. [Test shartnomasi: fayllar va funksiyalar](#17-test-shartnomasi-fayllar-va-funksiyalar)
18. [Test ko'rsatmalari](#18-test-korsatmalari)
19. [Muhit o'zgaruvchilari](#19-muhit-ozgaruvchilari)
20. [Ilovani ishga tushirish buyruqlari](#20-ilovani-ishga-tushirish-buyruqlari)
21. [Testlarni ishga tushirish buyruqlari](#21-testlarni-ishga-tushirish-buyruqlari)
22. [Definition of Done](#22-definition-of-done)

---

## 1. Loyiha haqida umumiy ma'lumot

**TeamFlow API** — ko'p foydalanuvchili loyiha va vazifalarni boshqarish tizimining backend qismi (Jira/Trello'ning soddalashtirilgan analogi).

Foydalanuvchilar:

- ro'yxatdan o'tadi va tizimga kiradi;
- loyiha yaratadi va jamoa a'zolarini taklif qiladi;
- vazifa yaratib, a'zolarga tayinlaydi, holatini boshqaradi;
- loyiha va vazifalarga fayl biriktiradi;
- har bir amalni **roliga qarab** bajara oladi yoki bajara olmaydi.

Frontend yo'q. Siz faqat REST API yozasiz. Frontend cheklovlariga **hech qachon** tayanmang: har bir himoyalangan amal backend'da tekshiriladi.

## 2. Real hayotiy muammo

Kichik IT-kompaniya loyihalarini Telegram guruhlari va Excel jadvallarida yuritadi. Natija:

- kim nima uchun javobgar ekani noaniq;
- maxfiy hujjatlar (shartnoma, texnik topshiriq) tasodifan begona odamga ko'rinib qoladi;
- stajyor tasodifan boshqa jamoaning vazifasini o'chirib yuboradi;
- biror narsa buzilganda kim, qachon, nima qilgani aniqlanmaydi (log yo'q, so'rovlarni bog'lash imkoni yo'q).

TeamFlow bu muammolarni hal qiladi: aniq rollar, loyiha darajasidagi ruxsatlar, xavfsiz fayl saqlash va kuzatiladigan (traceable) so'rovlar.

## 3. Maqsadlar

Topshiriq oxirida siz quyidagilarni isbotlaysiz:

1. NestJS'da **modulli arxitektura** qura olasiz (ortiqcha bog'liqliksiz, ichki qatlamlari aniq).
2. **Autentifikatsiya va avtorizatsiyani** (global + resurs darajasida) to'g'ri ajrata olasiz.
3. **Migratsiyalar orqali** ishonchli sxema loyihalay olasiz (`synchronize` ishlatmasdan).
4. **Fayl yuklashni xavfsiz** amalga oshira olasiz (kontent tekshiruvi, path traversal himoyasi, izchillik).
5. **Kuzatuvchanlik** (request ID, log, timing) va **xavfsiz loglash** (redaction) ni yoza olasiz.
6. **Testlar bilan ishlay olasiz**: test talab qilgan xatti-harakatni o'qib, uni amalga oshirasiz.
7. Arxitektura qarorlaringizni **asoslab bera olasiz**.

## 4. Funksional talablar

### 4.1. Autentifikatsiya va identifikatsiya
- Ro'yxatdan o'tish (`email`, `password`, `fullName`).
- Email + parol bilan login; JWT `accessToken` qaytadi.
- Parol **faqat xesh** ko'rinishida saqlanadi (bcrypt yoki argon2). Ochiq parol hech qayerda: bazada, logda, javobda bo'lmaydi.
- Himoyalangan endpointlar JWT talab qiladi. Joriy foydalanuvchi: `GET /auth/me`.
- Noto'g'ri login ma'lumotlari uchun xabar **bir xil** bo'lishi kerak (email mavjudligi sezdirilmaydi).
- Email takrorlanishi mumkin emas (harf registri farq qilmaydi: `A@x.com` = `a@x.com`).

### 4.2. Foydalanuvchilarni boshqarish
- Profilni olish, `fullName` ni yangilash.
- Foydalanuvchilar ro'yxati — faqat global `ADMIN`.
- Global `ADMIN` foydalanuvchini faolsizlantiradi/faollashtiradi.
- Faolsiz foydalanuvchi **login qila olmaydi** va **mavjud tokeni ham ishlamaydi**.
- Hech kim `email`, `globalRole`, `isActive`, parolni oddiy profil yangilash orqali o'zgartira olmaydi.

### 4.3. Loyihalar
- Yaratish, o'qish, yangilash, arxivlash/tiklash, o'chirish, ro'yxat (sahifalash + `status` filtri + saralash).
- Loyihani yaratgan foydalanuvchi **egasi (owner)** va avtomatik ravishda loyihaning `ADMIN` a'zosi bo'ladi.
- Arxivlangan loyihada yozish amallari (tahrirlash, vazifa yaratish/o'zgartirish, a'zo qo'shish, fayl yuklash) bloklanadi (`409`), o'qish ishlayveradi.

### 4.4. Loyiha a'zoligi va RBAC
- Loyiha rollari: `ADMIN`, `MANAGER`, `MEMBER`.
- A'zolik **global identifikatsiyadan ajratilgan**: bir foydalanuvchi bir nechta loyihada turli rolda bo'lishi mumkin.
- A'zo qo'shish (email bo'yicha), rolni o'zgartirish, a'zoni chiqarish, a'zolar ro'yxati.
- Loyiha egasini chiqarib ham, uning rolini pasaytirib ham bo'lmaydi.
- A'zo bo'lmagan foydalanuvchi uchun loyiha **mavjud emasdek** ko'rinadi (`404`).

### 4.5. Vazifalar
- Vazifa loyihaga tegishli. Yaratish, o'qish, yangilash, o'chirish.
- Holatlar: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `CANCELLED`. Ustuvorliklar: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- Faqat **loyiha a'zosini** tayinlash mumkin.
- Holat o'tishlari qat'iy qoidaga bo'ysunadi (6.4-bo'lim).
- Ro'yxat: `status`, `priority`, `assigneeId` bo'yicha filtr, saralash, sahifalash.

### 4.6. Fayl biriktirmalari
- Loyihaga yoki vazifaga fayl yuklash (`multipart/form-data`).
- Hajm, kengaytma, MIME va **haqiqiy kontent** tekshiruvi.
- Xavfsiz, noyob saqlash nomi; foydalanuvchi bergan nom hech qachon fayl yo'li bo'lmaydi.
- Metadata PostgreSQL'da; fayl abstrakt `StorageProvider` orqali saqlanadi.
- Faqat ruxsati bor loyiha a'zolari ko'radi/yuklab oladi/o'chiradi.

### 4.7. So'rovni qayta ishlash
- Har bir javobda `X-Request-Id`; har bir so'rov loglanadi; `X-Response-Time` o'lchanadi; maxfiy ma'lumotlar loglardan chiqarib tashlanadi.

### 4.8. Global validatsiya va xatolar
- Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`), yagona xato formati, to'g'ri status kodlar, ichki ma'lumotlar sizib chiqmasligi.

## 5. Nofunksional talablar

| Talab | Tavsif |
|---|---|
| Runtime | Node.js `>=24 <25` (`package.json` → `engines`) |
| Ma'lumotlar bazasi | PostgreSQL 16, **faqat migratsiyalar** orqali; `synchronize: true` **taqiqlangan** |
| Xavfsizlik | Parol xeshi, JWT imzosi/muddati, IDOR yo'q, path traversal yo'q, kontent tekshiruvi, stack trace sizmaydi |
| Izchillik | Fayl va DB yozuvi doim mos; yarim yozuvlar (orphan) qolmaydi; bir vaqtdagi so'rovlarda `500` emas, to'g'ri `409` |
| Arxitektura | Modulli; ingichka controller'lar; biznes mantiq service'larda; qayta ishlatiladigan avtorizatsiya mantiqi; DTO chegaralari; storage uchun dependency inversion |
| Kuzatuvchanlik | Request ID, log (stdout), timing; log'da sirlar yo'q |
| Test qilinuvchanlik | Barcha konfiguratsiya `process.env` dan **ilova ko'tarilayotganda** o'qiladi (modul import qilinganda emas) |

**Arxitektura qarorlarini asoslang.** Repozitoriy ildizida qisqa `ARCHITECTURE.md` yozing (1–2 sahifa). Unda kamida shularga javob bering:

1. Modullarni qanday ajratdingiz va nega? Qaysi modul qaysi modulga bog'liq?
2. Avtorizatsiya mantiqi qayerda yashaydi (guard / service / alohida policy)? Nega aynan u yerda?
3. `StorageProvider` nega abstrakt klass? Uni qanday ro'yxatdan o'tkazdingiz (custom provider)?
4. Qaysi amallarni tranzaksiyaga oldingiz va nega?
5. Jadvallarni qanday loyihaladingiz (normalizatsiya, indekslar, `ON DELETE` strategiyasi)?
6. Request ID/log/timing uchun nega middleware yoki interceptor tanladingiz?

## 6. Rollar va ruxsatlar matritsasi

### 6.1. Ikki daraja

**Global rol** (foydalanuvchida): `USER` yoki `ADMIN`.
- `ADMIN_EMAIL` muhit o'zgaruvchisiga **teng email** bilan ro'yxatdan o'tgan foydalanuvchi `ADMIN` bo'ladi. Qolganlar `USER`. (Bu bootstrap soddalashtirishi; real tizimda email tasdiqlash kerak bo'lardi.)
- Global `ADMIN`: foydalanuvchilarni boshqaradi **va** barcha loyihalarda a'zo bo'lmasa ham loyiha `ADMIN`'i huquqlariga ega. U a'zolar ro'yxatida **ko'rinmaydi**.

**Loyiha roli** (a'zolikda): `ADMIN`, `MANAGER`, `MEMBER`. Faqat shu loyiha doirasida amal qiladi.

### 6.2. Loyiha ruxsatlari

Quyidagi ruxsat nomlari **aynan shunday** ishlatiladi (unit testlar shularni tekshiradi, 17-bo'lim):

| Ruxsat | ADMIN | MANAGER | MEMBER | A'zo emas |
|---|:-:|:-:|:-:|:-:|
| `project:read` | ✅ | ✅ | ✅ | ❌ |
| `project:update` | ✅ | ✅ | ❌ | ❌ |
| `project:archive` (arxivlash/tiklash) | ✅ | ❌ | ❌ | ❌ |
| `project:delete` | ✅ | ❌ | ❌ | ❌ |
| `member:list` | ✅ | ✅ | ✅ | ❌ |
| `member:add` | ✅ | ✅* | ❌ | ❌ |
| `member:remove` | ✅ | ✅* | ❌** | ❌ |
| `member:change-role` | ✅ | ❌ | ❌ | ❌ |
| `task:read` | ✅ | ✅ | ✅ | ❌ |
| `task:create` | ✅ | ✅ | ✅ | ❌ |
| `task:update` (har qanday vazifa) | ✅ | ✅ | ❌ | ❌ |
| `task:update-own` | ✅ | ✅ | ✅ | ❌ |
| `task:change-status` (har qanday vazifa) | ✅ | ✅ | ❌ | ❌ |
| `task:change-status-own` | ✅ | ✅ | ✅ | ❌ |
| `task:assign` | ✅ | ✅ | ❌ | ❌ |
| `task:delete` | ✅ | ✅ | ❌ | ❌ |
| `attachment:read` | ✅ | ✅ | ✅ | ❌ |
| `attachment:upload` | ✅ | ✅ | ✅ | ❌ |
| `attachment:delete` (har qanday fayl) | ✅ | ✅ | ❌ | ❌ |
| `attachment:delete-own` | ✅ | ✅ | ✅ | ❌ |

**Resurs darajasidagi qo'shimcha qoidalar** (ruxsat matritsasi bilan birga tekshiriladi):

- `*` `MANAGER` **faqat `MEMBER`** rolidagi odamni qo'sha/chiqara oladi. `MANAGER` yoki `ADMIN` rolida qo'shishga/`MANAGER`/`ADMIN`/egasini chiqarishga urinsa — `403`.
- `**` `MEMBER` boshqani chiqara olmaydi, lekin **o'zi** loyihadan chiqib keta oladi (`DELETE /projects/:id/members/<o'z id'si>`).
- **Loyiha egasi** hech kim tomonidan (o'zi tomonidan ham) chiqarilmaydi va roli pasaytirilmaydi → `409`.
- `task:update-own` — vazifani **o'zi yaratgan yoki unga tayinlangan** `MEMBER` uchun.
- `task:change-status-own` — faqat **unga tayinlangan** `MEMBER` uchun (vazifani faqat yaratgan bo'lsa — yetarli emas).
- `attachment:delete-own` — faqat **o'zi yuklagan** fayl uchun.
- Global `ADMIN` — barcha loyiha ruxsatlariga ega (a'zo bo'lmasa ham).
- Noma'lum ruxsat nomi yoki noma'lum rol uchun natija doim `false` (*deny by default*).

### 6.3. Global ruxsatlar

| Amal | USER | ADMIN |
|---|:-:|:-:|
| Loyiha yaratish | ✅ | ✅ |
| O'z profilini ko'rish/yangilash | ✅ | ✅ |
| Boshqa foydalanuvchi profilini ko'rish/yangilash | ❌ (`403`) | ✅ |
| `GET /users` ro'yxati | ❌ (`403`) | ✅ |
| Foydalanuvchi statusini o'zgartirish | ❌ (`403`) | ✅ (o'zini emas — `409`) |

### 6.4. Vazifa holati o'tishlari

| Joriy holat | Ruxsat etilgan keyingi holatlar |
|---|---|
| `TODO` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `TODO`, `IN_REVIEW`, `CANCELLED` |
| `IN_REVIEW` | `IN_PROGRESS`, `DONE`, `CANCELLED` |
| `DONE` | `IN_PROGRESS` (qayta ochish) |
| `CANCELLED` | `TODO` (qayta ochish) |

Boshqa barcha o'tishlar (jumladan, bir xil holatga o'tish) → `422`.

### 6.5. `404` va `403` qoidasi

- Foydalanuvchi loyihaga **a'zo emas** → loyiha va unga tegishli barcha resurslar (vazifa, biriktirma, a'zolar) uchun **`404`** (mavjudligi sir saqlanadi).
- Foydalanuvchi **a'zo, lekin ruxsati yo'q** → **`403`**.
- Tokensiz yoki yaroqsiz token → **`401`**.

## 7. API shartnomasi

Barcha so'rov/javob tanalari JSON (fayl yuklash va yuklab olishdan tashqari). Barcha `id` lar **UUID**. Vaqtlar ISO 8601 (`2030-05-20T10:00:00.000Z`). Qo'shimcha (noma'lum) maydonlar `400` bilan rad etiladi.

`Auth` ustunida 🔓 — ommaviy, 🔒 — `Authorization: Bearer <token>` shart.

### 7.1. Auth

| Metod | Yo'l | Auth | Tana | Muvaffaqiyat |
|---|---|:-:|---|---|
| POST | `/auth/register` | 🔓 | `{ email, password, fullName }` | `201` + `User` |
| POST | `/auth/login` | 🔓 | `{ email, password }` | `200` + `{ accessToken, user }` |
| GET | `/auth/me` | 🔒 | — | `200` + `User` |

Qoidalar:
- `email` — to'g'ri email, kichik harfga keltirib saqlanadi.
- `password` — 8..72 belgi, kamida bitta harf va bitta raqam.
- `fullName` — trim'dan keyin 1..100 belgi.
- JWT payload'ida `sub` = foydalanuvchi `id`, `exp` (muddat) bo'lishi shart. Payload'ga parol/xesh qo'ymang.
- `ADMIN_EMAIL` bilan ro'yxatdan o'tgan foydalanuvchi `globalRole: "ADMIN"`.

### 7.2. Users

| Metod | Yo'l | Kim | Tana / Query | Muvaffaqiyat |
|---|---|---|---|---|
| GET | `/users` | global ADMIN | `page`, `limit`, `isActive` | `200` + sahifalangan `User[]` |
| GET | `/users/:id` | o'zi yoki ADMIN | — | `200` + `User` |
| PATCH | `/users/:id` | o'zi yoki ADMIN | `{ fullName }` | `200` + `User` |
| PATCH | `/users/:id/status` | global ADMIN | `{ isActive: boolean }` | `200` + `User` |

- Ruxsatsiz → `403`. ADMIN uchun mavjud bo'lmagan `id` → `404`. UUID emas → `400`.
- ADMIN o'zini faolsizlantirsa → `409`.
- `PATCH /users/:id` da `fullName` dan boshqa har qanday maydon → `400`.

### 7.3. Projects

| Metod | Yo'l | Ruxsat | Tana / Query | Muvaffaqiyat |
|---|---|---|---|---|
| POST | `/projects` | har kim | `{ name, description? }` | `201` + `Project` |
| GET | `/projects` | har kim | `page`, `limit`, `status`, `sortBy`, `order` | `200` + sahifalangan `Project[]` |
| GET | `/projects/:id` | `project:read` | — | `200` + `Project` |
| PATCH | `/projects/:id` | `project:update` | `{ name?, description? }` (kamida bittasi) | `200` + `Project` |
| POST | `/projects/:id/archive` | `project:archive` | — | `200` + `Project` |
| POST | `/projects/:id/restore` | `project:archive` | — | `200` + `Project` |
| DELETE | `/projects/:id` | `project:delete` | — | `204` |

- `name`: trim'dan keyin 1..100; `description`: 0..1000, `null` bo'lishi mumkin (PATCH'da `null` tavsifni tozalaydi).
- `GET /projects`: foydalanuvchi **a'zo bo'lgan** loyihalar; global ADMIN — hammasi. `status`: `ACTIVE | ARCHIVED`. `sortBy`: `createdAt` (standart) | `name` | `updatedAt`. `order`: `ASC | DESC` (standart `DESC`).
- Arxivlangan loyihani yana arxivlash yoki faol loyihani tiklash → `409`. Arxivlangan loyihani `PATCH` qilish → `409`.
- `DELETE` — butunlay o'chiradi: a'zoliklar, vazifalar, biriktirma yozuvlari **va jismoniy fayllar** ham o'chadi.

### 7.4. Members

| Metod | Yo'l | Ruxsat | Tana | Muvaffaqiyat |
|---|---|---|---|---|
| GET | `/projects/:projectId/members` | `member:list` | `page`, `limit` | `200` + sahifalangan `Member[]` |
| POST | `/projects/:projectId/members` | `member:add` | `{ email, role }` | `201` + `Member` |
| PATCH | `/projects/:projectId/members/:userId` | `member:change-role` | `{ role }` | `200` + `Member` |
| DELETE | `/projects/:projectId/members/:userId` | `member:remove` yoki o'zi | — | `204` |

- Ro'yxat tartibi: qo'shilish vaqti bo'yicha o'sish (egasi birinchi).
- Allaqachon a'zo → `409`. Email bo'yicha foydalanuvchi topilmasa → `404`. Foydalanuvchi faolsiz → `422`.
- A'zo bo'lmagan `userId` (PATCH/DELETE) → `404`.
- A'zo chiqarilganda unga tayinlangan vazifalar **o'chmaydi** — `assignee` `null` bo'ladi.

### 7.5. Tasks

| Metod | Yo'l | Ruxsat | Tana / Query | Muvaffaqiyat |
|---|---|---|---|---|
| POST | `/projects/:projectId/tasks` | `task:create` | `{ title, description?, priority?, dueDate?, assigneeId? }` | `201` + `Task` |
| GET | `/projects/:projectId/tasks` | `task:read` | `page`, `limit`, `status`, `priority`, `assigneeId`, `sortBy`, `order` | `200` + sahifalangan `Task[]` |
| GET | `/tasks/:id` | `task:read` | — | `200` + `Task` |
| PATCH | `/tasks/:id` | `task:update` / `task:update-own` | `{ title?, description?, priority?, dueDate? }` (kamida bittasi) | `200` + `Task` |
| PATCH | `/tasks/:id/status` | `task:change-status` / `-own` | `{ status }` | `200` + `Task` |
| PUT | `/tasks/:id/assignee` | `task:assign` | `{ assigneeId: uuid \| null }` | `200` + `Task` |
| DELETE | `/tasks/:id` | `task:delete` | — | `204` |

- `title`: trim'dan keyin 1..200; `description`: 0..5000 yoki `null`; `priority` standart `MEDIUM`; `dueDate`: ISO 8601 yoki `null`.
- Yangi vazifa doim `status: "TODO"`. `status`, `createdBy`, `projectId`, `id` ni mijoz yubora olmaydi (`400`).
- `assigneeId` bilan yaratish uchun `task:assign` kerak (`MEMBER` → `403`). Tayinlanuvchi shu loyihaning a'zosi bo'lmasa (yoki foydalanuvchi mavjud bo'lmasa) → `422` va hech narsa yaratilmaydi.
- `PUT /tasks/:id/assignee` idempotent. `null` — tayinlashni bekor qiladi.
- Vazifani boshqa loyihaga ko'chirib bo'lmaydi.
- **Ro'yxat tartibi:** standart `createdAt DESC`. `sortBy`: `createdAt | updatedAt | dueDate | priority | title`.
  - `priority` bo'yicha saralash **ma'no bo'yicha**: `LOW < MEDIUM < HIGH < URGENT` (alifbo bo'yicha emas!).
  - `dueDate` bo'yicha saralashda `dueDate` si yo'q vazifalar **har ikki yo'nalishda ham oxirida** turadi.
- Filtrlar bir-biri bilan **VA** (AND) bog'lanadi. `meta.total` filtrlangan jami sonni bildiradi.
- Noma'lum query parametr → `400`.
- Vazifa o'chirilganda uning biriktirmalari va jismoniy fayllari ham o'chadi.

### 7.6. Attachments

| Metod | Yo'l | Ruxsat | Tana / Query | Muvaffaqiyat |
|---|---|---|---|---|
| POST | `/projects/:projectId/attachments` | `attachment:upload` | `multipart/form-data`, maydon **`file`** | `201` + `Attachment` |
| POST | `/tasks/:taskId/attachments` | `attachment:upload` | `multipart/form-data`, maydon **`file`** | `201` + `Attachment` |
| GET | `/projects/:projectId/attachments` | `attachment:read` | `page`, `limit` | `200` + sahifalangan `Attachment[]` (faqat to'g'ridan-to'g'ri loyihaga biriktirilganlar) |
| GET | `/tasks/:taskId/attachments` | `attachment:read` | `page`, `limit` | `200` + sahifalangan `Attachment[]` |
| GET | `/attachments/:id` | `attachment:read` | — | `200` + `Attachment` |
| GET | `/attachments/:id/download` | `attachment:read` | — | `200` + fayl baytlari |
| DELETE | `/attachments/:id` | `attachment:delete` / `-own` | — | `204` |

- Ro'yxatlar: yangisi birinchi (`createdAt DESC`).
- Yuklab olish javobi sarlavhalari: `Content-Type` = saqlangan `mimeType`; `Content-Disposition: attachment; filename=...` (nom xavfsiz kodlangan); `X-Content-Type-Options: nosniff`.
- Fayl turlari, hajm va tekshiruv qoidalari — [14-bo'lim](#14-fayl-yuklash-oqimi).

### 7.7. Javob obyektlari (shakllar)

Javob obyektlarida **aynan shu maydonlar** bo'ladi (ortiqcha maydon yo'q — TypeORM entity'larini to'g'ridan-to'g'ri qaytarmang):

```jsonc
// User
{ "id": "uuid", "email": "ali@example.com", "fullName": "Ali Valiyev",
  "globalRole": "USER" /* | "ADMIN" */, "isActive": true,
  "createdAt": "ISO", "updatedAt": "ISO" }

// Project
{ "id": "uuid", "name": "Website", "description": "..." /* | null */,
  "status": "ACTIVE" /* | "ARCHIVED" */,
  "owner": { "id": "uuid", "fullName": "Ali Valiyev" },
  "createdAt": "ISO", "updatedAt": "ISO" }

// Member
{ "userId": "uuid", "email": "...", "fullName": "...",
  "role": "ADMIN" /* | "MANAGER" | "MEMBER" */, "joinedAt": "ISO" }

// Task
{ "id": "uuid", "title": "...", "description": null, "status": "TODO",
  "priority": "MEDIUM", "dueDate": null /* | ISO */, "projectId": "uuid",
  "assignee": null /* | { "id": "uuid", "fullName": "..." } */,
  "createdBy": { "id": "uuid", "fullName": "..." },
  "createdAt": "ISO", "updatedAt": "ISO" }

// Attachment
{ "id": "uuid", "originalName": "logo.png", "mimeType": "image/png", "size": 68,
  "projectId": "uuid", "taskId": null /* | "uuid" */,
  "uploadedBy": { "id": "uuid", "fullName": "..." }, "createdAt": "ISO" }
```

Attachment javobida **hech qachon** saqlash kaliti, fayl tizimi yo'li yoki papka nomi bo'lmaydi.

### 7.8. Sahifalangan ro'yxat formati

```json
{
  "data": [ /* ... */ ],
  "meta": { "page": 1, "limit": 10, "total": 37, "totalPages": 4 }
}
```

- `page` (standart `1`, ≥ 1, butun son), `limit` (standart `10`, 1..100). Noto'g'ri qiymat → `400`.
- `totalPages = ceil(total / limit)` (`total = 0` bo'lsa `0`).
- Query parametrlari **son** sifatida qaytadi (`ValidationPipe` `transform`).

## 8. So'rov / javob misollari

**Ro'yxatdan o'tish**

```http
POST /auth/register
Content-Type: application/json

{ "email": "Ali@Example.com", "password": "Secret123", "fullName": "Ali Valiyev" }
```
```http
HTTP/1.1 201 Created
X-Request-Id: 7c1f2a3e-5b84-4c1d-9a2e-0d6f1b3c4a55
X-Response-Time: 42.31ms

{ "id": "9b2d...", "email": "ali@example.com", "fullName": "Ali Valiyev",
  "globalRole": "USER", "isActive": true,
  "createdAt": "2030-05-20T10:00:00.000Z", "updatedAt": "2030-05-20T10:00:00.000Z" }
```

**Login**

```http
POST /auth/login
{ "email": "ali@example.com", "password": "Secret123" }
```
```json
{ "accessToken": "eyJhbGciOi...", "user": { "id": "9b2d...", "email": "ali@example.com", "...": "..." } }
```

**Xato (yagona format)**

```http
POST /auth/register
{ "email": "bad", "password": "x", "fullName": "" }
```
```http
HTTP/1.1 400 Bad Request
X-Request-Id: 1e5c...

{
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "email must be an email",
    "password must be longer than or equal to 8 characters",
    "fullName should not be empty"
  ],
  "path": "/auth/register",
  "timestamp": "2030-05-20T10:00:00.000Z",
  "requestId": "1e5c..."
}
```

**Vazifa yaratish**

```http
POST /projects/3f9d.../tasks
Authorization: Bearer eyJ...

{ "title": "Landing sahifa", "priority": "HIGH", "dueDate": "2030-06-01T00:00:00.000Z", "assigneeId": "a1b2..." }
```
```json
{
  "id": "c0de...", "title": "Landing sahifa", "description": null,
  "status": "TODO", "priority": "HIGH", "dueDate": "2030-06-01T00:00:00.000Z",
  "projectId": "3f9d...",
  "assignee": { "id": "a1b2...", "fullName": "Vali Aliyev" },
  "createdBy": { "id": "9b2d...", "fullName": "Ali Valiyev" },
  "createdAt": "...", "updatedAt": "..."
}
```

**Tayinlash (loyiha a'zosi bo'lmagan odam)**

```http
PUT /tasks/c0de.../assignee
{ "assigneeId": "<loyihada a'zo bo'lmagan foydalanuvchi>" }
```
→ `422 Unprocessable Entity` (yagona xato formatida).

**Fayl yuklash**

```bash
curl -X POST http://localhost:3000/tasks/c0de.../attachments \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./spec.pdf;type=application/pdf"
```
```json
{ "id": "f00d...", "originalName": "spec.pdf", "mimeType": "application/pdf", "size": 48213,
  "projectId": "3f9d...", "taskId": "c0de...",
  "uploadedBy": { "id": "9b2d...", "fullName": "Ali Valiyev" }, "createdAt": "..." }
```

## 9. HTTP status kodlari

| Kod | Qachon |
|---|---|
| `200` | Muvaffaqiyatli o'qish/yangilash/amal (arxivlash, tayinlash, status) |
| `201` | Resurs yaratildi (register, loyiha, a'zo, vazifa, biriktirma) |
| `204` | Muvaffaqiyatli o'chirish / a'zoni chiqarish (tana bo'sh) |
| `400` | Validatsiya xatosi; noto'g'ri UUID/query; bo'sh/yo'q fayl; buzilgan JSON; noma'lum maydon |
| `401` | Token yo'q/yaroqsiz/muddati o'tgan; noto'g'ri login; faolsiz foydalanuvchi |
| `403` | Foydalanuvchi **a'zo**, lekin ruxsati yo'q (yoki global ruxsat yo'q) |
| `404` | Resurs yo'q **yoki** foydalanuvchi loyihaga a'zo emas; email bo'yicha foydalanuvchi topilmadi; marshrut yo'q |
| `409` | Takroriy email/a'zolik; arxivlangan loyihada yozish; egani chiqarish/pasaytirish; ADMIN o'zini bloklashi; allaqachon arxivlangan |
| `413` | Fayl yoki JSON tana ruxsat etilgan hajmdan katta |
| `415` | Fayl turi (kengaytma/MIME) ruxsat etilmagan yoki kontent e'lon qilingan turga mos emas |
| `422` | Biznes qoidasi buzildi: a'zo bo'lmagan odamni tayinlash, ruxsat etilmagan status o'tishi, faolsiz foydalanuvchini a'zo qilish |
| `500` | Kutilmagan xato (xabar doim `"Internal server error"`, hech qanday tafsilotsiz) |

Bir so'rovda bir nechta xato bo'lsa tavsiya etilgan tartib: `401 → 400 → 404 → 403 → 409/422`. Testlar bu xatolarni **aralashtirmaydi**, lekin izchil bo'ling.

## 10. Ma'lumotlar bazasi: biznes talablari

Jadvallarni **o'zingiz loyihalaysiz** (nomlar, ustunlar, indekslar — sizning qaroringiz). Quyidagilar majburiy:

1. **Migratsiyalar.** Sxema faqat `src/database/migrations/` dagi TypeORM migratsiyalari orqali yaratiladi. `synchronize: true` hech qayerda bo'lmasligi shart (test shuni tekshiradi). Migratsiya `up` va `down` ga ega bo'lsin.
2. **Primary key'lar — UUID.** Bitta ustunli PK'lar `uuid` turida.
3. **Vaqt belgilari.** Har bir asosiy jadvalda `createdAt` / `updatedAt`, tur: `timestamptz`.
4. **Kamida 5 ta jadval:** foydalanuvchilar, loyihalar, loyiha a'zoligi, vazifalar, biriktirmalar.
5. **Foreign key'lar** (kamida 8 ta): har bir bog'lanish DB darajasida cheklanishi shart.
6. **Unique cheklovlar:**
   - `email` ustida UNIQUE (registrga sezgir bo'lmagan: masalan, saqlashdan oldin kichik harfga keltirish yoki `lower(email)` indeksi);
   - (loyiha, foydalanuvchi) juftligi a'zolikda UNIQUE.
   Bir vaqtdagi ikki so'rov ham dublikat yarata olmasligi kerak — to'g'ri xato `409`, `500` emas.
7. **`ON DELETE` strategiyasi** (qaror sizniki, lekin xatti-harakat shunday bo'lishi kerak):
   - loyiha o'chirilsa → a'zoliklar, vazifalar, biriktirma yozuvlari ham o'chadi (kamida bitta FK `CASCADE`);
   - vazifa o'chirilsa → uning biriktirmalari o'chadi;
   - a'zo chiqarilsa → unga tayinlangan vazifalar `assignee = null` bo'ladi, vazifalar saqlanadi;
   - foydalanuvchining o'zi bu API orqali hech qachon o'chirilmaydi.
8. **Majburiy maydonlar** `NOT NULL` bo'lsin (`email`, `passwordHash`, `title`, `name`, rollar, statuslar...).
9. **Enum qiymatlari** (rol, status, priority) DB darajasida ham cheklansin (`enum` yoki `CHECK`).
10. **Tranzaksiyalar.** Bir nechta yozuvni birga o'zgartiradigan amallar atomik bo'lsin (masalan, loyiha + egasining a'zoligi). Bir vaqtda ko'p loyiha yaratilganda har birida aynan bitta `ADMIN` a'zo bo'lishi kerak.
11. **Izchillik.** Rad etilgan amal (`4xx`) bazada hech narsa qoldirmaydi. Fayl saqlash muvaffaqiyatsiz bo'lsa — DB'da yozuv yo'q; DB yozuvi muvaffaqiyatsiz bo'lsa — yetim fayl diskda qolmaydi.
12. **Xeshlar** hech qayerda javob/log'ga tushmaydi; xeshni qaytarmaslik uchun DTO/serialization chegarasi aniq bo'lsin.

## 11. Entity munosabatlari (oddiy tilda)

- **Foydalanuvchi** tizimdagi shaxs. Uning global roli va faolligi bor. Foydalanuvchi bir nechta loyihada qatnashadi.
- **Loyiha** bitta **egaga** (foydalanuvchi) ega. Ega — loyihaning birinchi `ADMIN` a'zosi.
- **Loyiha a'zoligi** — "foydalanuvchi X loyiha Y da Z roli bilan qatnashadi" degan bog'lanish. Bir juftlik faqat bir marta uchraydi. Rol **a'zolikda** saqlanadi, foydalanuvchida emas.
- **Vazifa** aynan bitta loyihaga tegishli; uni **yaratgan** foydalanuvchi bor; **ijrochi** (assignee) bo'lishi ham, bo'lmasligi ham mumkin. Ijrochi shu loyihaning a'zosi bo'lishi shart (bu qoida DB'ning o'zi bilan emas, ilova mantiqi bilan ta'minlanadi — nega? `ARCHITECTURE.md` da muhokama qiling).
- **Biriktirma** doim bitta loyihaga tegishli; ixtiyoriy ravishda aniq bir vazifaga ham. Uni **yuklagan** foydalanuvchi saqlanadi. Biriktirma yozuvi fayl **metadatasi**; fayl o'zi storage'da turadi.

## 12. Autentifikatsiya oqimi

```
Register ──► validatsiya ─► email band emas? ─► parol xeshlanadi ─► foydalanuvchi saqlanadi ─► 201 (xeshsiz)
Login    ──► validatsiya ─► foydalanuvchi bor va faol? ─► xesh solishtiriladi ─► JWT imzolanadi ─► 200
Himoyalangan so'rov ──► Authorization: Bearer ─► JWT tekshiriladi (imzo, muddat, algoritm)
                    ──► `sub` bo'yicha foydalanuvchi bazadan olinadi ─► faol emas/yo'q ─► 401
                    ──► request.user = joriy foydalanuvchi
```

Qoidalar:
- Muvaffaqiyatsiz login uchun xabar bir xil (noto'g'ri parol ham, mavjud bo'lmagan email ham).
- `alg: none`, boshqa sir bilan imzolangan, muddati o'tgan, payload'i o'zgartirilgan tokenlar → `401`.
- Faolsizlantirilgan foydalanuvchining **eski tokeni ham** darhol `401` beradi (shuning uchun har so'rovda foydalanuvchi holati tekshiriladi).
- Ommaviy endpointlar **faqat** `POST /auth/register` va `POST /auth/login`. Qolgan hamma narsa standart bo'yicha himoyalangan (*secure by default*).

## 13. Avtorizatsiya oqimi

```
1. Autentifikatsiya        → kim? (401)
2. Global rol tekshiruvi   → /users/* uchun ADMIN kerakmi? (403)
3. Resursni topish         → loyiha / vazifa / biriktirma → yo'q: 404
4. A'zolikni aniqlash      → foydalanuvchi shu loyihada qaysi rolda? A'zo emas (va global ADMIN emas): 404
5. Ruxsatni tekshirish     → rol + ruxsat nomi (6.2-jadval): yo'q: 403
6. Resurs qoidalari        → "o'zi yaratgan/tayinlangan", "egasi", "MANAGER faqat MEMBER'ni..." : 403/409
7. Biznes qoidalari        → status o'tishi, tayinlanuvchi a'zomi, arxivlanganmi: 409/422
```

Talablar:
- Ruxsat qarori **bitta joyda** (qayta ishlatiladigan mantiq) qabul qilinadi, controller'larda `if (role === ...)` tarqatib yuborilmaydi.
- Boshqa loyihaning resursiga `id` orqali murojaat qilish (IDOR) hech qachon ishlamaydi: vazifa/biriktirma `id` si berilganda, avval uning loyihasi aniqlanadi, so'ng a'zolik tekshiriladi.
- Rol o'zgarishi **keyingi so'rovdanoq** kuchga kiradi (rolni tokenga qo'shmang yoki har so'rovda bazadan o'qing).

## 14. Fayl yuklash oqimi

```
Client ── multipart (maydon "file") ──► Auth ─► Ruxsat (a'zomi? attachment:upload?)
        ─► Multer (xotirada, hajm chegarasi) ─► Validatsiya (bo'sh? hajm? kengaytma? MIME? kontent?)
        ─► Nomni tozalash ─► StorageProvider.save() ─► DB'ga metadata (tranzaksiyada)
        ─► (DB xatosi bo'lsa: saqlangan faylni o'chirish) ─► 201 + Attachment
```

**Ruxsat etilgan turlar** (kengaytma **va** MIME **va** haqiqiy kontent uchchalasi mos kelishi shart):

| Kengaytma | MIME | Kontent tekshiruvi |
|---|---|---|
| `.png` | `image/png` | imzo `89 50 4E 47 0D 0A 1A 0A` |
| `.jpg`, `.jpeg` | `image/jpeg` | imzo `FF D8 FF` |
| `.pdf` | `application/pdf` | boshlanishi `%PDF-` |
| `.txt` | `text/plain` | NUL (`0x00`) baytlar yo'q, to'g'ri UTF-8 |

**Qoidalar:**

- Maksimal hajm: `MAX_UPLOAD_SIZE_BYTES` (standart **5 MiB = 5 242 880** bayt). Aynan limit hajmidagi fayl qabul qilinadi, 1 bayt ortiq → `413`.
- Bo'sh fayl → `400`. Fayl yuborilmasa / maydon nomi `file` emas / bir nechta fayl / multipart bo'lmagan so'rov → `400`.
- Kengaytma, MIME yoki kontent mos kelmasa → `415`. Tekshiruv tartibi: bo'sh → hajm → kengaytma → MIME → kontent. Kengaytma **oxirgi nuqtadan keyin** olinadi (`rasm.png.exe` → `.exe` → rad). `.svg`, `.html`, `.js`, `.php`, `.exe`, `.zip`, kengaytmasiz fayllar rad etiladi. `application/octet-stream` rad etiladi.
- **Mijoz MIME'iga ishonmang.** `.exe` faylga `image/png` deb yozib yuborish ishlamasligi kerak.
- **Asl nom saqlash yo'li emas.** Diskdagi nom: tasodifiy, noyob (masalan, UUID), foydalanuvchi nomidan hech qanday qismsiz. Asl nom faqat metadata (`originalName`) sifatida, **tozalangan** holda saqlanadi: yo'l qismlari (`../`, `/`, `\`), boshqaruv belgilari/NUL olib tashlanadi, uzunlik ≤ 255 (kengaytma saqlanadi), bo'sh qolsa zaxira nom beriladi.
- Qabul qilinmagan so'rov **hech narsa qoldirmaydi**: diskda fayl ham, DB'da yozuv ham.
- Ruxsatsiz (a'zo bo'lmagan) foydalanuvchining yuklash urinishi diskka hech narsa yozmaydi.
- Saqlash (storage) xatosi → `500` (yagona format, xabar `"Internal server error"`, yo'l/xato kodi sizmaydi), DB'da yozuv qolmaydi, ilova ishlashda davom etadi.
- O'chirishda: yozuv ham, jismoniy fayl ham o'chadi. Jismoniy fayl allaqachon yo'qolgan bo'lsa ham yozuv o'chiriladi (`204`).
- Yuklab olish faqat `attachment:read` ruxsati bilan. A'zo emas → `404` (fayl mazmuni hech qachon oshkor bo'lmaydi).
- Fayl nomi `Content-Disposition` ga xavfsiz kodlanadi (sarlavha in'ektsiyasi yo'q).

**Storage abstraksiyasi.** `StorageProvider` — abstrakt klass (DI token vazifasini ham bajaradi). Hozircha bitta implementatsiya — `LocalStorageProvider` (17-bo'lim). Servislaringiz faqat abstraksiyaga bog'liq bo'lsin; keyinroq S3 ga o'tish servislarni o'zgartirmasligi kerak.

## 15. So'rovni qayta ishlash oqimi

```
So'rov ─► [Middleware] Request ID ─► [Middleware] Logging (javob tugagach yozadi)
       ─► Guard'lar ─► [Interceptor] Timing ─► Pipe'lar (validatsiya) ─► Controller ─► Service
       ◄─ [Exception Filter] (yagona xato formati) ◄─ xatolar
```

### 15.1. Request ID (middleware)
- Har bir javobda `X-Request-Id` (jumladan `401`, `404`, `400`, marshrut topilmagan holatlarda).
- Mijoz `X-Request-Id` yuborsa va u **xavfsiz** bo'lsa (`^[A-Za-z0-9._-]{1,128}$`), aynan o'sha ishlatiladi; aks holda yangi UUID yaratiladi.
- Xato javobining `requestId` maydoni shu qiymatga teng.

### 15.2. Logging (middleware)
- Har bir so'rov uchun javob tugagach **bitta log qatori** (stdout/stderr orqali; Nest `Logger` yoki `console`): `requestId`, HTTP metod, yo'l, status kodi va davomiylik (`12.5ms` kabi `<son>ms`) shu qatorda.
- **Hech qachon loglanmaydi:** parollar, parol xeshlari, `Authorization` sarlavhasi, JWT tokenlar, `Cookie`/`Set-Cookie`, sirlar (`JWT_SECRET`), yuklangan fayl mazmuni.
- Redaction mantiqi alohida, sof funksiya (`redactSensitive`) bo'lsin — uni unit-test qilinadi (17-bo'lim).
- Fayl-deskriptorga to'g'ridan-to'g'ri yozadigan kutubxonalar (masalan, `pino` default) testlarda ko'rinmaydi: loglar `process.stdout`/`process.stderr`/`console` orqali chiqsin.

### 15.3. Timing (interceptor)
- Controller'ga yetib borgan har bir so'rov uchun `X-Response-Time: <son>ms` sarlavhasi (masalan, `42.31ms`).
- Handler xato tashlasa ham sarlavha o'rnatiladi (xato o'zgarishsiz uzatiladi).
- Interceptor holat saqlamaydi, konstruktorsiz (`new TimingInterceptor()`) yaratiladi.

### 15.4. Yagona xato filteri
- Barcha xatolar (`HttpException`, validatsiya, Multer, JSON parser, kutilmagan `Error`, DB cheklov xatolari) **bitta formatga** keltiriladi (16-bo'lim).
- DB unique-violation (`23505`) → `409`; foreign-key violation (`23503`) → `409` yoki `422`; kutilmagan xatolar → `500`.

## 16. Validatsiya va xatolarni qayta ishlash

**Global `ValidationPipe`:** `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. Noma'lum maydon → `400` (xabarda maydon nomi bor).

**Yagona xato formati:**

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Project not found",
  "path": "/projects/3f9d...",
  "timestamp": "2030-05-20T10:00:00.000Z",
  "requestId": "7c1f..."
}
```

- `error` — HTTP status matni (`Bad Request`, `Unauthorized`, `Forbidden`, `Not Found`, `Conflict`, `Payload Too Large`, `Unsupported Media Type`, `Unprocessable Entity`, `Internal Server Error`).
- `message` — `string`; validatsiya xatolarida — `string[]`.
- `requestId` — `X-Request-Id` sarlavhasi bilan bir xil.
- Xato tanasida **hech qachon**: stack trace, fayl yo'llari, SQL, `QueryFailedError`, ichki kutubxona nomlari, sirlar bo'lmaydi. `500` uchun `message` doim `"Internal server error"`.
- Ichki xatolar (stack bilan) **faqat serverda** loglanadi (sirlarsiz).
- Express'ning `X-Powered-By` sarlavhasi o'chirilgan.
- `Content-Type` JSON bo'lmagan tana validatsiyadan o'tmaydi → `400`.
- Buzilgan JSON → `400`; juda katta JSON tana → `413` — ikkalasi ham yagona formatda.

## 17. Test shartnomasi: fayllar va funksiyalar

Testlar sizning kodingizni quyidagi **nom va yo'llar** bo'yicha topadi. Boshqa joylarni (controller nomlari, entity nomlari, jadval nomlari) o'zingiz hal qilasiz.

### 17.1. Ilova kirish nuqtalari (E2E)

| Fayl | Eksport | Vazifa |
|---|---|---|
| `src/app.module.ts` | `AppModule` | Ildiz modul. Middleware'lar (`configure()`), TypeORM, barcha modullar shu yerda ulanadi. |
| `src/app.setup.ts` | `configureApp(app: INestApplication): void \| Promise<void>` | Global pipe/filter/interceptor, `x-powered-by` ni o'chirish. **`main.ts` ham, testlar ham shuni chaqiradi** — shunda test va production bir xil sozlanadi. |
| `src/database/data-source.ts` | `export default new DataSource({...})` | TypeORM CLI uchun. `process.env` dan `DB_*` ni o'qiydi, `synchronize: false`, `migrations: ['src/database/migrations/*.ts']`, entity'lar `src/**/*.entity.ts`. `.env` ni `dotenv` bilan **override qilmasdan** yuklashi mumkin. |
| `src/database/migrations/*.ts` | — | Migratsiyalar. Test infratuzilmasi ularni `typeorm migration:run` bilan ishga tushiradi. |

E2E test infratuzilmasi nima qiladi (siz yozmaysiz):
1. `.env.test` (yo'q bo'lsa `.env.test.example`) ni yuklaydi, `DB_NAME` `_test` bilan tugashini tekshiradi.
2. Test bazasini yaratadi (agar yo'q bo'lsa) va `public` schema'ni tozalaydi.
3. **Sizning migratsiyalaringizni** ishga tushiradi.
4. Har bir test faylida `AppModule` + `configureApp` bilan ilovani ko'taradi, `UPLOAD_DIR` ni vaqtinchalik papkaga yo'naltiradi.
5. Har bir testdan oldin barcha jadvallarni `TRUNCATE` qiladi (migratsiya jadvalidan tashqari).

> `ConfigService`/`process.env` ni ilova ko'tarilganda o'qing. Modul fayli import qilinishi paytida `process.env.UPLOAD_DIR` ni o'qib `const` ga saqlab qo'ysangiz, testdagi vaqtinchalik papka ishlamaydi.

### 17.2. Unit-testlar uchun modullar

Quyidagi 6 ta modul **aynan shu yo'l va eksport nomlari bilan** bo'lishi kerak. Ular sof (yoki deyarli sof) mantiq, shuning uchun alohida test qilinadi.

**1) `src/authorization/permissions.ts`**
```ts
hasProjectPermission(role: string | null | undefined, permission: string): boolean
isAllowed(subject: { globalRole: string; projectRole: string | null }, permission: string): boolean
```
6.2-bo'limdagi matritsani amalga oshiradi. Noma'lum rol/ruxsat → `false`. `isAllowed`: global `ADMIN` → ruxsat nomi *tanilgan* bo'lsa `true`; aks holda `hasProjectPermission(projectRole, ...)`.
Taniqli ruxsat nomlari: `project:read|update|archive|delete`, `member:list|add|remove|change-role`, `task:read|create|update|update-own|change-status|change-status-own|assign|delete`, `attachment:read|upload|delete|delete-own`.

**2) `src/tasks/task-status-transitions.ts`**
```ts
canTransition(from: string, to: string): boolean
getAllowedTransitions(from: string): string[]   // har safar yangi massiv; noma'lum holat → []
```
6.4-jadval. Noma'lum qiymatlar uchun xato tashlamasdan `false` / `[]`.

**3) `src/uploads/file-validation.ts`**
```ts
validateUploadedFile(
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  options?: { maxSizeBytes?: number },            // standart 5 * 1024 * 1024
): { valid: true } | { valid: false; code: 'EMPTY_FILE' | 'FILE_TOO_LARGE' | 'UNSUPPORTED_EXTENSION' | 'UNSUPPORTED_MIME_TYPE' | 'CONTENT_MISMATCH' }

sanitizeOriginalName(name: string): string
```
Tekshiruv tartibi va qoidalar: 14-bo'lim. Hajm uchun `file.size` ishlatiladi. Kengaytma registrga sezgir emas (`.PNG` — mumkin). `sanitizeOriginalName` natijasida `/`, `\`, boshqaruv belgilari bo'lmaydi, `.`/`..` qolmaydi, uzunlik ≤ 255, uzun nomda kengaytma saqlanadi, bo'sh natija o'rniga bo'sh bo'lmagan zaxira nom.

**4) `src/common/utils/redact.ts`**
```ts
redactSensitive(value: unknown): any
```
Sof funksiya (kirishni o'zgartirmaydi). Kalit nomi (registrga sezgir emas) quyidagilardan birini **o'z ichiga olsa**, qiymati `"[REDACTED]"` ga almashadi: `password`, `passwd`, `secret`, `token`, `authorization`, `cookie`, `apikey`, `api-key` (shu jumladan `set-cookie`, `passwordHash`, `x-api-key`). Ichma-ich obyekt/massivlarda rekursiv ishlaydi, aylanma havolada xato tashlamaydi, primitivlarni o'zgartirmaydi. Qo'shimcha: istalgan satr ichidagi `Bearer <token>` va JWT shaklidagi (`eyJ...x.y.z`) qismlar yashirilsin (kalit sezgir bo'lmasa ham).

**5) `src/common/interceptors/timing.interceptor.ts`**
```ts
export class TimingInterceptor implements NestInterceptor   // konstruktorsiz
```
`response` ga `setHeader` bilan `X-Response-Time: <son>ms` o'rnatadi (handler tugagach; xatoda ham). Vaqtni o'lchashda `Date.now()`, `performance.now()` yoki `process.hrtime` ishlatish mumkin (test soatni soxtalashtiradi).

**6) `src/storage/storage.provider.ts` va `src/storage/local-storage.provider.ts`**
```ts
export abstract class StorageProvider {
  abstract save(buffer: Buffer, originalName: string): Promise<string>;   // saqlash kalitini qaytaradi
  abstract read(key: string): Promise<Buffer>;
  abstract delete(key: string): Promise<void>;                            // idempotent
  abstract exists(key: string): Promise<boolean>;
}
export class LocalStorageProvider extends StorageProvider {
  constructor(baseDir: string) { ... }
}
```
Talablar:
- `save` kalit qaytaradi: tasodifiy/noyob, `/`, `\`, `..` va **foydalanuvchi bergan nomning hech qanday qismini** o'z ichiga olmaydi. Zararli `originalName` (`../../x`) bilan ham fayl faqat `baseDir` ichida yaratiladi.
- `baseDir` yo'q bo'lsa `save` uni (ichma-ich) yaratadi. Bir vaqtdagi ko'p `save` to'qnashmaydi.
- `read`/`delete`/`exists` — kalit `baseDir` dan chiqib ketsa (`../x`, mutlaq yo'l) tashqaridagi faylga **tegmaydi** (`read` rad etiladi; `delete` rad etishi yoki hech narsa qilmasligi mumkin, lekin tashqi fayl saqlanib qoladi).
- `delete` idempotent: mavjud bo'lmagan kalit uchun xato tashlamaydi. `read` mavjud bo'lmagan kalit uchun rad etadi.
- `baseDir` o'rnida oddiy fayl bo'lsa `save` rad etiladi (yarim fayl qolmaydi).

## 18. Test ko'rsatmalari

Repozitoriyda:

```
test/
├── e2e/                       # HTTP orqali butun ilova (haqiqiy PostgreSQL)
│   ├── auth.e2e-spec.ts
│   ├── users.e2e-spec.ts
│   ├── projects.e2e-spec.ts
│   ├── members.e2e-spec.ts
│   ├── rbac.e2e-spec.ts               # amal × rol matritsasi
│   ├── tasks.e2e-spec.ts
│   ├── task-workflow.e2e-spec.ts      # tayinlash va status o'tishlari
│   ├── attachments.e2e-spec.ts
│   ├── request-pipeline.e2e-spec.ts   # request id, logging, timing
│   ├── errors-validation.e2e-spec.ts
│   └── database-integrity.e2e-spec.ts
├── unit/                      # izolyatsiyalangan mantiq (6 ta modul)
└── support/                   # infratuzilma va yordamchilar (o'zgartirmang)
```

**Qoidalar:**
- `test/support/` ni **o'zgartirmang**. Testlar to'g'ri bo'lsa, yangilanishi kerak bo'lgan narsa — sizning kodingiz. Test noto'g'ri deb o'ylasangiz — o'qituvchiga yozing.
- Har bir test mustaqil: oldingi test ma'lumotiga tayanmaydi; tartib ahamiyatsiz.
- Testlar jadval/ustun nomlariga tayanmaydi — faqat HTTP shartnomasiga va (`database-integrity`) umumiy sxema xususiyatlariga.
- Testlar **faqat** `*_test` bazasiga ulanadi; boshqa bazada ishga tushishdan bosh tortadi.

**Tavsiya etilgan ish tartibi** (har bir qadamdan keyin `pnpm test:unit` / `pnpm test:e2e -- <fayl>` ni ishlating):

1. Loyiha skeleti: `app.module`, `app.setup`, `data-source`, `.env`, ulanish → hech bo'lmasa testlar *ko'tarilishi* kerak.
2. Unit modullar (oson g'alabalar, 6 ta fayl).
3. Request ID middleware, xato filteri, ValidationPipe.
4. Users + Auth migratsiyasi → `auth.e2e-spec.ts`, `users.e2e-spec.ts`.
5. Projects → Members → RBAC.
6. Tasks → workflow.
7. Storage + Attachments.
8. Logging/timing, database-integrity, tozalash va `ARCHITECTURE.md`.

Bitta faylni ishga tushirish: `pnpm test:e2e -- test/e2e/auth.e2e-spec.ts`; bitta testni nomi bo'yicha: `pnpm test:e2e -- -t "login"`.

## 19. Muhit o'zgaruvchilari

| O'zgaruvchi | Misol | Izoh |
|---|---|---|
| `NODE_ENV` | `development` / `test` / `production` | `test` rejimini test infratuzilmasi o'zi o'rnatadi |
| `PORT` | `3000` | |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | `127.0.0.1`, `5434`, `teamflow`, ... | |
| `DB_NAME` | `teamflow_dev` / `teamflow_test` | test bazasi **`_test` bilan tugashi shart** |
| `JWT_SECRET` | kamida 32 belgi | kodda qattiq yozilmaydi |
| `JWT_EXPIRES_IN` | `15m` | |
| `ADMIN_EMAIL` | `admin@teamflow.local` | shu email bilan ro'yxatdan o'tgan odam global ADMIN |
| `UPLOAD_DIR` | `./uploads` | fayllar saqlanadigan papka |
| `MAX_UPLOAD_SIZE_BYTES` | `5242880` | |
| `BCRYPT_ROUNDS` | `10` | ixtiyoriy; testlarda `4` (tezlik uchun). Standart qiymat xavfsiz (≥ 10) bo'lsin |

Fayllar: `.env.example` (dev), `.env.test.example` (test). Nusxa oling:

```bash
cp .env.example .env
cp .env.test.example .env.test   # ixtiyoriy: bo'lmasa .env.test.example ishlatiladi
```

`.env` va `.env.test` `.gitignore` da. Sirlarni hech qachon repozitoriyga qo'shmang.

## 20. Ilovani ishga tushirish buyruqlari

Talab: **Node.js 24.x**, **pnpm**, **Docker** (PostgreSQL uchun).

```bash
nvm use                 # .nvmrc -> Node 24
pnpm install
pnpm db:up              # PostgreSQL 16 (127.0.0.1:5434): teamflow_dev va teamflow_test bazalari
cp .env.example .env

pnpm migration:run      # dev bazaga migratsiyalar (src/database/data-source.ts kerak)
pnpm start:dev          # ilova (watch)
pnpm build && pnpm start:prod
pnpm migration:generate src/database/migrations/Name   # entity o'zgarishidan migratsiya yaratish
pnpm migration:revert
pnpm db:down
```

`docker-compose.yml` boshqa loyihalaringiz portlari (5432/5433) bilan to'qnashmaslik uchun `5434` portdan foydalanadi.

## 21. Testlarni ishga tushirish buyruqlari

```bash
pnpm typecheck          # tsc --noEmit (testlar va src kompilyatsiyasi)
pnpm test:unit          # Vitest, DB kerak emas
pnpm test:e2e           # Vitest + Supertest + haqiqiy PostgreSQL (pnpm db:up kerak)
pnpm test:all           # ikkalasi
pnpm test:e2e:watch     # o'zgarishda qayta ishga tushirish
TEST_VERBOSE=1 pnpm test:e2e    # test paytida ilova loglarini ham konsolga chiqarish
```

E2E fayllar **ketma-ket** ishlaydi (bitta test bazasi). To'liq E2E to'plami taxminan 1–3 daqiqa.

Boshlang'ich holatda: unit testlar "modul topilmadi", E2E testlar "`src/app.module.ts` topilmadi" xabari bilan yiqiladi. Bu to'g'ri — siz shu xabarlarni yo'qotib borasiz.

## 22. Definition of Done

Topshiriq **tugagan** deb hisoblanadi, agar:

- [ ] `pnpm typecheck` xatosiz o'tadi.
- [ ] `pnpm test:unit` — barcha unit testlar yashil.
- [ ] `pnpm test:e2e` — barcha E2E testlar yashil (testlarni o'zgartirmasdan, o'tkazib yubormasdan: `skip`/`only` yo'q).
- [ ] Sxema faqat migratsiyalar bilan yaratilgan; `synchronize: true` yo'q; har bir migratsiyada `down` bor; `pnpm migration:run` toza bazada ishlaydi.
- [ ] Ilova `pnpm start:dev` bilan ishga tushadi va 7-bo'limdagi barcha endpointlar qo'lda (curl/Postman) ham ishlaydi.
- [ ] Parol, xesh, token, sir hech qayerda (javob, log, xato) chiqmaydi.
- [ ] Controller'lar ingichka: biznes mantiq service'larda, avtorizatsiya qayta ishlatiladigan mantiqda.
- [ ] Servislar `StorageProvider` abstraksiyasiga bog'liq, `LocalStorageProvider` ga to'g'ridan-to'g'ri emas.
- [ ] Entity'lar API javobida to'g'ridan-to'g'ri qaytarilmaydi (DTO/mapper chegarasi).
- [ ] `package.json` da `"engines": { "node": ">=24 <25" }` saqlangan.
- [ ] `ARCHITECTURE.md` yozilgan va 5-bo'limdagi 6 ta savolga javob beradi.
- [ ] `.env` / `.env.test` repozitoriyga qo'shilmagan; `.env.example` dolzarb.
- [ ] Kod toza: foydalanilmagan import/o'lik kod yo'q, nomlar tushunarli, `any` minimal.

**Baholash mezonlari (taxminiy):** testlar — 60%, arxitektura va kod sifati — 20%, `ARCHITECTURE.md` va asoslash — 10%, migratsiyalar va DB dizayni — 10%.

Omad! Qiyinlashsa — `HINTS.md` ni oching. U tayyor yechim bermaydi, faqat qaysi tomonga qarash kerakligini ko'rsatadi.
