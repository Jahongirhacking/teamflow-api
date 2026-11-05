# TeamFlow API — Maslahatlar (HINTS)

Bu hujjat **tayyor yechim bermaydi**. U sizga "nimaga qarash kerak" va "qanday o'ylash kerak" ni ko'rsatadi. Har bir mavzu to'rt qismdan iborat:

- **Muammo** — nima uchun bu savol umuman paydo bo'ladi;
- **Tushuncha** — masalani yechishga yordam beradigan g'oya;
- **Odatiy xatolar** — boshqalar qayerda qoqilgan;
- **Qayerdan o'rganish** — hujjatlarda nima qidirish kerak.

Avval `ASSIGNMENT.md` ni, so'ng yiqilayotgan testning **xabarini** diqqat bilan o'qing. Test xabari ko'pincha javobning yarmini aytib turadi.

> Qoida: 20 daqiqadan ko'proq qotib qolsangiz — shu yerga qarang. 2 soatdan ko'p qotsangiz — o'qituvchiga savol bering.

---

## Mundarija

1. [Qayerdan boshlash](#1-qayerdan-boshlash)
2. [NestJS modul arxitekturasi](#2-nestjs-modul-arxitekturasi)
3. [Dependency Injection](#3-dependency-injection)
4. [TypeORM munosabatlari](#4-typeorm-munosabatlari)
5. [Ma'lumotlar bazasi normalizatsiyasi](#5-malumotlar-bazasi-normalizatsiyasi)
6. [Migratsiyalarni loyihalash](#6-migratsiyalarni-loyihalash)
7. [Tranzaksiyalar va poyga holatlari](#7-tranzaksiyalar-va-poyga-holatlari)
8. [Passport strategiyalari](#8-passport-strategiyalari)
9. [JWT autentifikatsiyasi](#9-jwt-autentifikatsiyasi)
10. [Custom decorator'lar](#10-custom-decoratorlar)
11. [Reflector va metadata](#11-reflector-va-metadata)
12. [Global guard'lar](#12-global-guardlar)
13. [Resurs darajasidagi avtorizatsiya](#13-resurs-darajasidagi-avtorizatsiya)
14. [Interceptor va Middleware farqi](#14-interceptor-va-middleware-farqi)
15. [ExecutionContext](#15-executioncontext)
16. [Custom pipe'lar](#16-custom-pipelar)
17. [Custom provider'lar](#17-custom-providerlar)
18. [Dinamik storage provider dizayni](#18-dinamik-storage-provider-dizayni)
19. [Multer](#19-multer)
20. [Fayl xavfsizligi](#20-fayl-xavfsizligi)
21. [Xatolarni qayta ishlash](#21-xatolarni-qayta-ishlash)
22. [Loglash va maxfiy ma'lumotlar](#22-loglash-va-maxfiy-malumotlar)
23. [Test bazasini izolyatsiya qilish](#23-test-bazasini-izolyatsiya-qilish)
24. [Mock'lar bilan unit-test](#24-mocklar-bilan-unit-test)
25. [Supertest bilan E2E test](#25-supertest-bilan-e2e-test)
26. [Tez-tez uchraydigan "nega yiqilyapti?" holatlari](#26-tez-tez-uchraydigan-nega-yiqilyapti-holatlari)

---

## 1. Qayerdan boshlash

**Muammo.** 475+ ta yiqilayotgan test oldida nimadan boshlashni bilmaslik.

**Tushuncha.** Testlar piramida kabi: pastki qavat (sof funksiyalar) osonroq va keyingi qavatlar uchun poydevor. `ASSIGNMENT.md` 18-bo'limdagi ishlash tartibini kuzating. Bitta fayl, bitta `describe`, bitta test ustida ishlang. "Yashil" bo'lgach — keyingisi.

**Odatiy xatolar.**
- Hamma modulni birdaniga yozib, keyin testni ishga tushirish. Xatoni topish qiyin bo'ladi.
- Testni o'qimay, o'z tasavvuringiz bo'yicha yozish. Test — shartnoma.
- `it.only`/`it.skip` qo'yib "yashil" qilish. Bu topshiriqni topshirmaslik bilan teng.

**Qayerdan o'rganish.** Vitest CLI: fayl va nom bo'yicha filtrlash (`-t`). Test xabaridagi `expected` / `received` ni o'qishni o'rganing.

---

## 2. NestJS modul arxitekturasi

**Muammo.** Hamma narsa `AppModule` ga tiqilsa, 2 kundan keyin hech kim hech narsani topa olmaydi; modullar bir-biriga aylanma bog'liq bo'lib qoladi.

**Tushuncha.** Modul — "bir mas'uliyat atrofidagi" provider'lar to'plami. O'zingizga savol bering: *"Bu funksiya qaysi biznes tushunchasiga tegishli?"* (auth, users, projects, memberships, tasks, attachments, storage...). Modul faqat o'zi `exports` qilgan narsani boshqalarga beradi — shu orqali "ommaviy interfeys"ni nazorat qilasiz. Ko'p modullarga kerak bo'ladigan narsa (masalan, ruxsat tekshiruvi) alohida modulga chiqariladi.

Bog'liqlik yo'nalishini chizib ko'ring (qog'ozda!): kim kimni import qiladi? Strelkalar aylana hosil qilsa — dizayn muammosi bor.

**Odatiy xatolar.**
- Har bir entity uchun avtomatik "modul" yaratib, mantiq jihatidan yopishgan narsalarni ajratib yuborish (yoki aksincha, hammasini bitta modulga tiqish).
- `forwardRef()` ni "dori" sifatida ishlatish. U ko'pincha aylanma bog'liqlik belgisi, yechim emas.
- `exports` ga yozishni unutish (xato: *"Nest can't resolve dependencies of..."*).
- Controller ichida repository'ga bevosita murojaat qilish.

**Qayerdan o'rganish.** NestJS Docs: *Modules*, *Dynamic modules*, *Circular dependency*. Qidiruv so'zlari: "feature module", "shared module", "module exports re-exporting".

---

## 3. Dependency Injection

**Muammo.** Servislar bir-birini `new` bilan yaratsa, ularni testda almashtirib bo'lmaydi va bog'liqliklar yashirin qoladi.

**Tushuncha.** Siz "menga X kerak" deysiz (konstruktor parametri), konteyner esa "X ni mana bunday yarataman" deydi. Shuning uchun ob'ekt *nima qilishini* biladi, lekin *qanday olinishini* bilmaydi. Bu testlashni osonlashtiradi: unit-testda haqiqiy narsa o'rniga soxta (mock) berasiz.

Token — bu "kalit". Odatda klass o'zi kalit bo'ladi. Interfeys runtime'da yo'q bo'lgani uchun ular token bo'la olmaydi — shuning uchun `StorageProvider` abstrakt **klass**.

**Odatiy xatolar.**
- `@Injectable()` ni unutish.
- Provider'ni modulga qo'shmay, boshqa modulning provider'ini ishlatishga urinish.
- Servis ichida `process.env` ni to'g'ridan-to'g'ri o'qib, uni testda almashtirib bo'lmay qolishi.
- Scope: `REQUEST` scope'li provider'ni singleton ichiga kiritib, butun zanjirni "request-scoped" qilib yuborish (unumdorlik pasayadi).

**Qayerdan o'rganish.** *Providers*, *Custom providers*, *Injection scopes*. "constructor injection vs property injection".

---

## 4. TypeORM munosabatlari

**Muammo.** "Foydalanuvchi va loyiha" orasida bir nechta turli munosabat bor: egalik (bir-ko'p), a'zolik (ko'p-ko'p, **qo'shimcha ma'lumot bilan** — rol), ijrochi (ixtiyoriy)...

**Tushuncha.**
- Savol: *"Bog'lanishning o'zi ma'lumot tashiyaptimi?"* A'zolikda ha (rol, qo'shilgan vaqt) — demak oddiy `@ManyToMany` yetmaydi; bog'lanishning o'zi alohida entity bo'lishi kerak.
- Munosabatning "egasi tomoni" (foreign key qaysi jadvalda turadi) va teskari tomoni farqini tushuning.
- `nullable` munosabat (ijrochi yo'q bo'lishi mumkin) va `onDelete` ni *DB darajasida* belgilash — ilova kodiga ishonishdan ko'ra ishonchliroq.
- Relation'ni "eager" qilish qulay, lekin yashirin JOIN va ortiqcha ma'lumot keltiradi; kerak joyda aniq yuklang.
- `ManyToOne` bilan birga foreign key ustunini (`@RelationId` yoki alohida ustun) ochiq olish ko'p hollarda qulay: tayinlash uchun butun ob'ektni yuklashga hojat qolmaydi.

**Odatiy xatolar.**
- Entity'ni to'g'ridan-to'g'ri API javobi sifatida qaytarish (parol xeshi, ichki maydonlar sizib chiqadi).
- N+1 so'rovlar: ro'yxatni olib, har bir element uchun alohida so'rov.
- `cascade: true` ni hamma joyga qo'yish — kutilmagan o'chirishlar. Cascade'ni DB'dagi `ON DELETE` bilan adashtirmang: ular ikki xil mexanizm.
- `save()` ning "upsert"ga o'xshab ishlashini unutish (id berilsa yangilaydi).
- Aylanma `JSON` xatosi (ikki tomonli relation'ni serializatsiya qilganda).

**Qayerdan o'rganish.** TypeORM Docs: *Relations*, *Many-to-many relations with custom properties*, *Eager and Lazy relations*, *Find options* va *Query Builder*. Qidiruv: "junction entity", "onDelete CASCADE SET NULL typeorm".

---

## 5. Ma'lumotlar bazasi normalizatsiyasi

**Muammo.** "Rol" ni qayerda saqlash kerak: foydalanuvchida yoki a'zolikda? Vazifaning "loyiha nomi"ni vazifada takrorlasa bo'ladimi?

**Tushuncha.** Har bir fakt **bir joyda** saqlanadi. Savol: *"Bu qiymat nimaga bog'liq?"*
- Loyiha roli *foydalanuvchiga* ham, *loyihaga* ham emas — **ikkalasining juftligiga** bog'liq → juftlikda saqlanadi.
- Vazifaning loyihasi vazifaga tegishli fakt, loyiha nomi esa loyihaga → takrorlamang, JOIN qiling.

Indeks haqida o'ylang: *qaysi so'rovlar eng ko'p bajariladi?* (a'zo bo'lgan loyihalarim, loyiha vazifalari holat bo'yicha, email bo'yicha qidiruv). FK ustunlariga indeks PostgreSQL'da avtomatik **yaratilmaydi**.

Ba'zan ataylab denormalizatsiya qilinadi (masalan, biriktirmada `projectId` vazifadan olinishi mumkin, lekin to'g'ridan-to'g'ri ham saqlanadi) — ammo bu ongli qaror bo'lishi va izchillik qanday ta'minlanishini aytib bera olishingiz kerak. `ARCHITECTURE.md` shuning uchun.

**Odatiy xatolar.**
- Bir xil ma'lumotni ikki joyda saqlab, ular "ajralib ketishi".
- Faqat ilova kodidagi tekshiruvga tayanib, DB'da unique/FK/NOT NULL qo'ymaslik. Ikkita bir vaqtdagi so'rov ilova tekshiruvidan "o'tib ketadi" — oxirgi himoya chizig'i DB.
- Email uchun `UNIQUE` qo'yib, registrni unutish (`A@x.com` va `a@x.com`).
- Enum qiymatini erkin matn sifatida saqlash.

**Qayerdan o'rganish.** "database normalization 1NF 2NF 3NF", "composite unique constraint", PostgreSQL: *CHECK constraints*, *Unique indexes*, *Partial indexes*, `lower()` bo'yicha funksional indeks.

---

## 6. Migratsiyalarni loyihalash

**Muammo.** `synchronize: true` qulay, lekin production'da ma'lumotni yo'qotishi mumkin va sxema tarixi saqlanmaydi.

**Tushuncha.** Migratsiya — sxemaning **versiyalangan o'zgarishi**: `up` (oldinga) va `down` (qaytarish). Ikki yo'l bor: entity'dan avtomatik generatsiya qilish yoki qo'lda yozish. Generatsiya vaqt tejaydi, lekin natijani **o'qing**: u siz o'ylagan narsani (indeks, `ON DELETE`, enum, `timestamptz`) aynan shunday yaratdimi?

Fikr yuriting:
- Yangi bo'sh bazada barcha migratsiyalar tartib bilan ishlaydimi? (Test infratuzilmasi aynan shuni qiladi.)
- `down` haqiqatan teskari ishlaydimi? Uni bir marta qo'lda sinab ko'ring.
- UUID uchun default qiymatni qayerda generatsiya qilasiz: ilovadami yoki DB'dami? Har ikkisining oqibati bor (PostgreSQL 13+ da `gen_random_uuid()` o'rnatilgan).
- Migratsiya fayllari yozilgach **o'zgartirilmaydi** (boshqa joyda ishlagan bo'lishi mumkin) — o'zgarish kerak bo'lsa yangi migratsiya yoziladi.

**Odatiy xatolar.**
- Migratsiyani entity bilan "yarim" mos qoldirish (masalan, entity'da bor ustun migratsiyada yo'q) — testlar "column does not exist" bilan yiqiladi.
- TypeORM CLI uchun yo'llar: `src/**/*.ts` (ts-node) va `dist/**/*.js` (build) farqini unutish.
- `data-source.ts` da `.env` yuklash va test muhitidagi o'zgaruvchilarni **bosib yuborish** (testlar `DB_NAME` ni o'zi beradi, siz uni override qilmasligingiz kerak).
- Hamma narsani bitta ulkan migratsiyaga solish.

**Qayerdan o'rganish.** TypeORM Docs: *Migrations*, *DataSource*. CLI: `migration:generate`, `migration:run`, `migration:revert`, `migration:show`.

---

## 7. Tranzaksiyalar va poyga holatlari

**Muammo.** Loyiha yaratganda ikkita yozuv bo'ladi: loyiha va egasining a'zoligi. Ikkinchisi yiqilsa, "egasiz loyiha" qoladi. Yoki: ikkita bir vaqtdagi so'rov bir xil emailni ro'yxatdan o'tkazmoqchi.

**Tushuncha.**
- *Tranzaksiya*: "yoki hammasi, yoki hech narsa". Bir nechta bog'liq yozuvni o'zgartirganda kerak.
- TypeORM'da tranzaksiya ichidagi barcha amallar **bir xil** `EntityManager` orqali o'tishi kerak — oddiy `repository` tranzaksiyadan tashqarida ishlaydi!
- *Poyga holati (race condition)*: "avval tekshir, keyin yoz" yondashuvi bir vaqtdagi ikki so'rov uchun ishlamaydi. Ishonchli yo'l: DB cheklovi (UNIQUE) ni ishga solib, **uning xatosini ushlash** va `409` ga aylantirish. PostgreSQL xato kodlari: `23505` (unique), `23503` (foreign key).
- Fayl bilan DB bitta tranzaksiyaga kirmaydi. Shuning uchun tartib va **kompensatsiya** haqida o'ylang: qaysi birini avval qilsangiz, ikkinchisi yiqilsa nima bo'ladi? (14-bo'lim `ASSIGNMENT.md`.)

**Odatiy xatolar.**
- `findOne` → `if (exists) throw` → `save`: poyga uchun yetarli emas.
- Tranzaksiya ichida `this.repo.save()` chaqirish (manager emas).
- Tranzaksiyada tashqi tizimga (disk) yozishni "rollback" bo'ladi deb o'ylash.
- Tranzaksiyani ochiq qoldirish (xato bo'lganda `release` qilmaslik).

**Qayerdan o'rganish.** TypeORM: *Transactions* (`DataSource.transaction`, `QueryRunner`). PostgreSQL: *error codes* (`23505`). Qidiruv: "check-then-act race condition", "idempotent operation".

---

## 8. Passport strategiyalari

**Muammo.** "Kim bu?" savoliga javob berish mantiqini controller'lardan ajratish.

**Tushuncha.** Passport — *strategiyalar* kutubxonasi. Strategiya bitta ish qiladi: so'rovdan ma'lumotni ajratib oladi (token, login/parol) va uni tekshirib, "foydalanuvchi" ob'ektini beradi. NestJS'da bu `PassportStrategy` bilan o'raladi va `AuthGuard` orqali ishga tushadi. `validate()` metodining **qaytargan qiymati** `request.user` ga aylanadi.

Savol: *`validate()` ichida nima qilish kerak?* Token imzosi allaqachon tekshirilgan. Lekin foydalanuvchi o'chirilgan yoki bloklangan bo'lishi mumkinmi? Bu qaerda tekshiriladi? (Testlar buni kutadi.)

**Odatiy xatolar.**
- Strategiyani modulga provider sifatida qo'shishni unutish — guard "Unknown authentication strategy" deydi.
- `validate()` da tokenning payload'ini bazani tekshirmasdan ishonib qaytarish.
- JWT sirini kodga yozib qo'yish; `ignoreExpiration: true` qoldirish; algoritmlarni cheklamaslik (`alg: none` hujumi haqida o'qing).
- Xatoni o'zingiz `UnauthorizedException` bilan emas, noaniq `Error` bilan tashlash → `500`.

**Qayerdan o'rganish.** NestJS Docs: *Authentication*, *Passport recipe*. `passport-jwt` README: `jwtFromRequest`, `secretOrKey`, `algorithms`.

---

## 9. JWT autentifikatsiyasi

**Muammo.** Token nima, uni kim ishlab chiqadi, ichiga nima qo'yish mumkin, nima mumkin emas?

**Tushuncha.** JWT — imzolangan (lekin **shifrlanmagan**) JSON. Payload'ni har kim o'qiy oladi; imzo faqat uni *o'zgartirib bo'lmasligini* kafolatlaydi. Shuning uchun payload'ga maxfiy narsa qo'yilmaydi.
- `sub` — "subject" — foydalanuvchi identifikatori (testlar shuni kutadi).
- `exp` — muddat. Qisqa muddat xavfsizroq.
- Token imzolangandan keyin foydalanuvchi holati o'zgarishi mumkin (bloklandi, roli o'zgardi). Tokenni "haqiqat manbai" qilmang: har so'rovda zarur ma'lumotni bazadan oling. Bu — soddalik va xavfsizlik orasidagi savdo; `ARCHITECTURE.md` da bu haqda yozing.

Parol xeshlash: sekin algoritm (bcrypt/argon2) ataylab sekin. "Salt" har bir parol uchun tasodifiy — shuning uchun bir xil parol turli xesh beradi. `bcrypt` ning `rounds` parametri vaqtni belgilaydi (testlar tezlik uchun kichikroq qiymat beradi — `BCRYPT_ROUNDS`).

**Odatiy xatolar.**
- SHA256/MD5 bilan parol xeshlash (tez = buzish oson).
- Muvaffaqiyatsiz loginda "email topilmadi" / "parol noto'g'ri" kabi turli xabar berish (foydalanuvchi mavjudligi sezdiriladi).
- Xeshni `select` bilan har joyda yuklab, tasodifan javobga qo'shib yuborish. Xesh ustunini standart tanlovdan chiqarishni o'ylab ko'ring.
- Taqqoslashni `===` bilan emas, kutubxona funksiyasi bilan qilish kerak (vaqt hujumlari).

**Qayerdan o'rganish.** jwt.io (token tuzilishi), OWASP *Password Storage Cheat Sheet*, OWASP *JWT Cheat Sheet*. `@nestjs/jwt` hujjatlari.

---

## 10. Custom decorator'lar

**Muammo.** Har bir controller metodida `req.user` ni qo'lda olish va `@Req()` bilan ishlash — takrorlanuvchi va test qilish qiyin kod.

**Tushuncha.** Decorator'ning ikki turi bor:
1. **Parametr decorator'i** — so'rovdan qiymatni "chiqarib" beradi (masalan, joriy foydalanuvchi). `createParamDecorator` va `ExecutionContext` bilan quriladi.
2. **Metadata decorator'i** — metod/klassga "yorliq" yopishtiradi (masalan, "bu endpoint ommaviy", "bu amal shu ruxsatni talab qiladi"). Yorliqni keyin guard o'qiydi (11-bo'lim).

Decorator o'zi hech narsani *tekshirmaydi* — u faqat ma'lumot beradi yoki yorliq qo'yadi. Tekshiruv boshqa joyda (guard).

**Odatiy xatolar.**
- Decorator ichida biznes mantiq yozish.
- Metadata kalitini matn sifatida har joyda takrorlash (xatoga moyil) — bitta konstantaga chiqaring.
- `@Req()` ni controller'da ishlatib, Express'ga qattiq bog'lanib qolish.

**Qayerdan o'rganish.** NestJS Docs: *Custom route decorators*, *Decorator composition* (`applyDecorators`). TypeScript: *Decorators*.

---

## 11. Reflector va metadata

**Muammo.** Guard'ga "bu endpoint ommaviy" yoki "bu amal `task:assign` ruxsatini talab qiladi" degan ma'lumotni qanday yetkazish?

**Tushuncha.** Decorator metadata yozadi (`SetMetadata`), guard esa `Reflector` orqali o'qiydi. Asosiy savol: **qaysi joydagi metadata ustun?** Metod darajasi va klass darajasi. `get`, `getAllAndOverride`, `getAllAndMerge` farqini aniqlab oling:
- "Klass ommaviy emas, lekin bitta metod ommaviy" — metod klassni *bosib o'tadi* (override).
- "Klassdagi ruxsatlar + metoddagi ruxsatlar" — *birlashtiriladi* (merge).

Qaysi biri sizga kerak — biznes qoidasiga bog'liq.

**Odatiy xatolar.**
- `reflector.get(key, context.getClass())` bilan faqat klassni o'qib, metod metadata'sini ko'rmaslik.
- `getHandler()` va `getClass()` ni adashtirish.
- Metadata yo'q holatni (`undefined`) ishlov bermaslik.

**Qayerdan o'rganish.** NestJS Docs: *Guards → Setting roles per handler*, `Reflector` API.

---

## 12. Global guard'lar

**Muammo.** Har bir controller'ga `@UseGuards(JwtGuard)` qo'yishni unutib, tasodifan ochiq endpoint qoldirish.

**Tushuncha.** *Secure by default*: guard **hamma joyga** qo'llanadi, ommaviy endpointlar esa **istisno** sifatida yorliqlanadi. Global guard'ni `APP_GUARD` token'i bilan ro'yxatdan o'tkazish uni DI konteyneriga kiritadi (u `Reflector` kabi narsalarni ola oladi) — `app.useGlobalGuards(new X())` esa DI'siz.

Guard'lar tartibi ahamiyatli: avval autentifikatsiya ("kim?"), so'ng global rol, so'ng resurs ruxsati. Bitta guard'da hammasini qilmoqchi bo'lmang — kichik, bir vazifali guard'lar zanjiri aniqroq.

**Odatiy xatolar.**
- Global guard'ni `main.ts` da `useGlobalGuards` bilan qo'shib, `Reflector` kerak bo'lganda `undefined` olish.
- Testlar `configureApp` ni ishlatadi, `main.ts` ni emas: faqat `main.ts` da qilingan sozlama testlarda **yo'q**. Shuning uchun umumiy sozlamalarni `configureApp` yoki modul ichida (`APP_*` token'lari) bajaring.
- Ommaviy endpointni belgilash yorlig'ini unutib, `register` ni ham yopib qo'yish.

**Qayerdan o'rganish.** *Guards → Binding guards*, "APP_GUARD". Qidiruv: "NestJS global guard public decorator".

---

## 13. Resurs darajasidagi avtorizatsiya

**Muammo.** "Foydalanuvchi MANAGER" yetarli emas: *qaysi loyihada?* Vazifa id'si berilganda loyiha id'si so'rovda yo'q.

**Tushuncha.** Qaror uchun uchta ma'lumot kerak: **kim** (foydalanuvchi + global rol), **nima ustida** (qaysi resurs → qaysi loyiha), **qaysi amal** (ruxsat nomi). Oqim:
1. resursni yuklang → uning loyihasini aniqlang;
2. foydalanuvchining shu loyihadagi a'zoligini toping;
3. (rol, ruxsat) → ruxsat berilganmi? (sof funksiya — unit-test qilinadi!);
4. resursga xos qo'shimcha qoidalar ("o'zi yaratgan", "egasi").

Qayerda joylashtirish? Variantlar: guard + metadata; service ichida alohida "policy" servisi; yoki aralash. Har birining narxi bor: guard controller'dan oldin ishlaydi (resursni ikki marta yuklash mumkin); service-ichidagi tekshiruv esa unutilib qolishi mumkin. **Tanlang va asoslang.**

`404` vs `403`: a'zo bo'lmagan odamga resurs mavjudligini ham bildirmaslik xavfsizroq (sizib chiqish — *information disclosure*). IDOR (Insecure Direct Object Reference) haqida o'qing: id ni taxmin qilib, begona resursga kirish.

**Odatiy xatolar.**
- Faqat `loyiha` endpointlarini himoya qilib, `/tasks/:id` yoki `/attachments/:id` ni unutish (testlar aynan shuni sinaydi).
- Rolni JWT ichiga qo'yib, rol o'zgarganda eski token ishlashda davom etishi.
- Ruxsat mantiqini controller'larda `if (role === 'ADMIN')` ko'rinishida tarqatib yuborish.
- Global ADMIN'ni alohida holat sifatida har joyda qayta yozish (bitta joyda — ruxsat funksiyasida).

**Qayerdan o'rganish.** OWASP *Broken Access Control*, *IDOR Prevention Cheat Sheet*. Qidiruv: "RBAC vs ABAC", "policy-based authorization NestJS", "CASL".

---

## 14. Interceptor va Middleware farqi

**Muammo.** Request ID, logging va timing — "hamma so'rovga tegishli" ishlar. Qaysi biri qayerda yashashi kerak?

**Tushuncha.** So'rov zanjiri: **Middleware → Guard → Interceptor (oldin) → Pipe → Handler → Interceptor (keyin) → Exception filter**.
- **Middleware** — eng boshida; NestJS'ni bilmaydi (Express funksiyasi). *Marshrut topilmasa ham ishlaydi*, guard rad etsa ham ishlaydi. Request ID aynan shu sababli middleware'da (404 va 401 javoblarda ham kerak).
- **Interceptor** — handler atrofini "o'raydi": `ExecutionContext` ga kirish, RxJS oqimi orqali **javob/xatoni** ko'rish va o'zgartirish. Handler chaqirilmasa (guard rad etsa) interceptor ham ishlamaydi.

Savol: *"Menga nima kerak: so'rovning eng boshi (va har qanday natija) yoki handler natijasi?"* Request ID uchun — birinchisi. Handler davomiyligini o'lchash uchun — ikkinchisi. Logging: javob *tugagach* yozish uchun `res.on('finish')` kabi hodisaga ulanish kerak (status kodi shundagina aniq).

Request ID ni log va xato filteriga qanday yetkazasiz? `request` ob'ektining maydoni — eng sodda yo'l (AsyncLocalStorage ham variant, ammo murakkabroq).

**Odatiy xatolar.**
- Timing'ni middleware'da `next()` dan keyin o'lchash (handler hali tugamagan).
- Interceptor'da `tap` va `catchError`/`finalize` farqini bilmaslik → xato holatida sarlavha o'rnatilmaydi.
- Mijoz yuborgan `X-Request-Id` ni tekshirmasdan log'ga yozish (log injection: ichida yangi qator, uzun matn).
- Interceptor'da holat saqlash (`this.startTime = ...`): singleton, bir vaqtdagi so'rovlar bir-birini buzadi. Holat — lokal o'zgaruvchida.

**Qayerdan o'rganish.** NestJS Docs: *Middleware*, *Interceptors*, *Request lifecycle* (juda foydali sxema). RxJS: `tap`, `catchError`, `finalize`, `throwError`.

---

## 15. ExecutionContext

**Muammo.** Guard/interceptor/decorator HTTP, WebSocket yoki RPC kontekstida ishlashi mumkin. Request ob'ektini qanday olish?

**Tushuncha.** `ExecutionContext` — "hozir nima bajarilyapti" ma'lumoti: `switchToHttp().getRequest()/getResponse()`, `getHandler()` (qaysi metod), `getClass()` (qaysi controller), `getType()`. U `ArgumentsHost` ni kengaytiradi. Unit-testda uni soxta ob'ekt bilan almashtirasiz — shuning uchun faqat kerakli metodlarni ishlating, qolgan "xususiyatlarga" bog'lanib qolmang.

**Odatiy xatolar.**
- `context.getRequest()` kabi mavjud bo'lmagan metodni chaqirish (avval `switchToHttp()`).
- Response sarlavhasini handler `response.send()` qilib bo'lgandan keyin o'rnatishga urinish (*headers already sent*).

**Qayerdan o'rganish.** *Execution context* bo'limi, `ArgumentsHost` API.

---

## 16. Custom pipe'lar

**Muammo.** Query parametrlari matn sifatida keladi (`"2"`). UUID noto'g'ri bo'lsa, bazaga yetib borib `500` bermasligi kerak. Baʼzi validatsiyani `class-validator` dekoratorlari bilan ifodalab bo'lmaydi.

**Tushuncha.** Pipe — qiymatni **o'zgartiradi** (transformation) yoki **tekshiradi** (validation) — handler'ga yetishidan oldin. Tayyor pipe'lar (`ParseUUIDPipe`, `ParseIntPipe`) va `ValidationPipe` ko'p ishni qiladi; o'zingiznikini kerak bo'lganda yozing (masalan, fayl uchun — 19-bo'lim).

`ValidationPipe` sozlamalari: `whitelist` (DTO'da yo'q maydonni olib tashlaydi), `forbidNonWhitelisted` (olib tashlamasdan xato beradi), `transform` (oddiy ob'ektni DTO klassi nusxasiga va query'dagi matnni sonlarga aylantiradi). Query DTO'larda `@Type(() => Number)` yoki `enableImplicitConversion` ning farqini tushuning.

**Odatiy xatolar.**
- DTO'ni `interface` qilib yozish — runtime'da yo'qoladi, validatsiya ishlamaydi. DTO **klass** bo'lishi kerak.
- `@IsOptional()` ni `null` va `undefined` uchun qanday ishlashini tekshirmay ishlatish (`description: null` ruxsat, `title: null` — yo'q).
- Matnni trim qilmaslik (`"   "` — bo'sh nom).
- `@Transform` bilan trim qilib, `@IsNotEmpty` ni undan *keyin* ishlashini kutish (tartibni sinab ko'ring).

**Qayerdan o'rganish.** *Pipes*, *Validation*, `class-validator` dekoratorlari ro'yxati, `class-transformer` (`@Type`, `@Transform`).

---

## 17. Custom provider'lar

**Muammo.** Ba'zan "klassni `new` qilib berish" yetmaydi: konstruktorga **konfiguratsiya** (papka yo'li) kerak, yoki abstraksiyani aniq implementatsiyaga bog'lash kerak.

**Tushuncha.** `providers` ro'yxatida to'rt xil yozuv: `useClass`, `useValue`, `useFactory`, `useExisting`. Savol: *"Qiymat qachon va nimaga qarab hosil bo'ladi?"*
- Abstraksiyani implementatsiyaga bog'lash: `provide: Abstraksiya, useClass: Implementatsiya` (yoki factory).
- Konfiguratsiyaga bog'liq ob'ekt (`LocalStorageProvider(baseDir)`): `useFactory` + `inject: [ConfigService]`. Factory ilova **ko'tarilganda** chaqiriladi — testlar `UPLOAD_DIR` ni shu paytdan oldin o'rnatadi.

**Odatiy xatolar.**
- `useValue` bilan ilova ko'tarilmasidan oldin hisoblangan qiymatni berib, testda almashtirib bo'lmay qolishi.
- Factory'da `inject` ro'yxatini unutish (parametrlar `undefined` keladi).
- Token sifatida satr ishlatib, keyin xato yozib qo'yish; klass yoki `Symbol` xavfsizroq.

**Qayerdan o'rganish.** *Custom providers*, *Async providers*, `@nestjs/config`.

---

## 18. Dinamik storage provider dizayni

**Muammo.** Bugun disk, ertaga S3. Servislar har safar o'zgarmasligi kerak.

**Tushuncha.** **Dependency Inversion**: yuqori darajadagi mantiq (`AttachmentsService`) tafsilotga (`fs`) emas, **abstraksiyaga** (`StorageProvider`) bog'liq. Abstraksiya *kichik va nutqda tushunarli* bo'lsin: `save`, `read`, `delete`, `exists`. Unda "yo'l" tushunchasi yo'q — faqat **kalit**. Chunki S3'da yo'l/papka haqiqatan yo'q.

Savollar:
- Kalit qanday yaratiladi, undan foydalanuvchi nomi ta'sir qiladimi? (Ta'sir qilmasin.)
- Kalit "yo'l" kabi talqin qilinadigan joyda (`read(key)`) nima uchun `baseDir` dan chiqib ketmasligini qanday kafolatlaysiz? (`path.resolve` natijasini `baseDir` prefiksi bilan solishtirishni o'ylab ko'ring.)
- `delete` nega **idempotent** bo'lishi kerak? (Yarim-o'chirilgan holatdan tiklanish uchun.)
- Bir xil nomli ikki fayl to'qnashmasligini nima kafolatlaydi?
- Qaysi xatolar "kutilgan" (fayl yo'q), qaysilari "kutilmagan" (disk to'la)?

**Odatiy xatolar.**
- Controller/service ichida `fs` ni to'g'ridan-to'g'ri ishlatish.
- Abstraksiyaga disk tafsilotlarini (to'liq yo'l) "sizdirish".
- `path.join(baseDir, userInput)` ga ishonish: u `..` ni normallashtiradi va ichkaridan tashqariga chiqib ketishi mumkin.
- Saqlash kaliti sifatida vaqt (`Date.now()`) — bir vaqtda ikki so'rov to'qnashadi.

**Qayerdan o'rganish.** SOLID — "D" printsipi; Node.js: `fs/promises`, `crypto.randomUUID`, `path.resolve`/`path.relative`. Qidiruv: "path traversal prevention node".

---

## 19. Multer

**Muammo.** `multipart/form-data` oddiy JSON emas; fayl hajmi cheklanmasa server xotirasi to'lib ketadi.

**Tushuncha.** Multer — multipart'ni o'qiydigan middleware. NestJS'da `FileInterceptor('file', options)` va `@UploadedFile()` orqali ishlatiladi. Muhim tanlovlar:
- **Xotira** yoki **disk** saqlash? Bu topshiriqda tekshiruv (kontent) **diskka yozishdan oldin** bo'lishi kerak — bu qaysi variantni osonlashtiradi?
- `limits.fileSize` — Multer cheklovdan oshsa xato beradi; NestJS buni `413` ga o'giradi. Cheklovni **env'dan** olish kerak (`MAX_UPLOAD_SIZE_BYTES`) — interceptor opsiyalari qachon hisoblanishini o'ylab ko'ring (modul import bo'lganda emas, ilova ko'tarilganda).
- `limits.files` va maydon nomi: "kutilmagan maydon"/"ko'p fayl" holatlarida Multer o'z xatosini beradi.
- Fayl **umuman kelmasa** `@UploadedFile()` `undefined` bo'ladi — buni o'zingiz `400` ga aylantirishingiz kerak.

Tartib masalasi: **guard → interceptor (Multer) → pipe → handler**. Demak ruxsatsiz foydalanuvchi ham fayl yuborishi mumkin, Multer uni xotirada o'qib bo'ladi. Diskka esa faqat ruxsat va tekshiruvdan keyin yozing.

Tekshiruvni qayerga qo'yasiz: `ParseFilePipe` + `FileValidator` (o'z validatoringiz), alohida pipe, yoki service? Har birining narxi bor.

**Odatiy xatolar.**
- `diskStorage` bilan avval saqlab, keyin tekshirib, yaramasa o'chirish (ruxsatsiz yozish va yetim fayl xavfi).
- `file.mimetype` ga ishonish (mijoz yuboradi!).
- `file.originalname` ni yo'lda ishlatish.
- Multer xatolarini yagona xato formatiga keltirmaslik.
- Supertest `.attach()` da maydon nomi bilan interceptor maydon nomining mos kelmasligi (`file`).

**Qayerdan o'rganish.** NestJS Docs: *File upload* (`ParseFilePipe`, `MaxFileSizeValidator`, `FileTypeValidator`), `multer` README: *limits*, *error handling*, *memoryStorage*.

---

## 20. Fayl xavfsizligi

**Muammo.** Fayl yuklash — veb-xavfsizlikdagi eng xavfli joylardan biri. Kengaytmasi `.png`, ichida esa PHP/skript bo'lgan fayl.

**Tushuncha.** Uchta mustaqil tekshiruv, **uchalasi ham mos** bo'lishi kerak:
1. **Kengaytma** — oxirgi nuqtadan keyingi qismi, kichik harfda; *allowlist* (ruxsat etilganlar ro'yxati), blocklist emas.
2. **MIME** — mijoz yuborgan `Content-Type`. Bu **da'vo**, dalil emas.
3. **Haqiqiy kontent** — fayl baytlarining boshi ("magic bytes"/imzo). PNG, JPEG, PDF imzolarini qidirib toping (bu yerda yozilmaydi). Matn fayl uchun: NUL baytlar yo'qligi va to'g'ri kodlash.

Allowlist nima uchun blocklist'dan yaxshi? Siz hamma xavfli turni biladigan bo'lolmaysiz; ruxsat berilganlarni esa sanab chiqa olasiz.

Boshqa himoyalar:
- **Saqlash nomi** tasodifiy; asl nom faqat metadata va tozalangan (`../`, NUL, boshqaruv belgilari olib tashlangan). *Path traversal*.
- **Yuklab olishda**: `Content-Disposition: attachment` va `X-Content-Type-Options: nosniff` — brauzer faylni "ijro" qilmasin. Nomni sarlavhaga xavfsiz kodlash (qo'shtirnoq, `;`, yangi qator).
- **Hajm cheklovi** ilovada, va (production'da) teskari proksida ham.
- **Ruxsatsiz foydalanuvchi uchun fayl mazmuni hech qachon oshkor bo'lmasin** — 404.
- SVG ni nega taqiqladik? (SVG ichida `<script>` bo'lishi mumkin — XSS.)

**Odatiy xatolar.**
- `.includes('png')` kabi yuzaki tekshiruv (`png.exe`).
- Birinchi nuqtadan keyingi qismni kengaytma deb olish (`a.b.png` → `b.png`?). Oxirgisini oling.
- Kontentni faqat birinchi bir necha baytga qarab tekshirganda buferning qisqaligini hisobga olmaslik (bo'sh yoki 3 baytlik fayl).
- Xato bo'lganda faylni saqlab qo'yish (yetim fayl).

**Qayerdan o'rganish.** OWASP *File Upload Cheat Sheet*; "file signatures / magic numbers list" (Wikipedia); MDN: `Content-Disposition`, `X-Content-Type-Options`.

---

## 21. Xatolarni qayta ishlash

**Muammo.** Xatolar turli joydan turli shaklda keladi: `HttpException`, validatsiya, Multer, JSON parser, DB, kutilmagan `Error`. Mijoz esa bitta shaklni kutadi.

**Tushuncha.** **Exception filter** — barcha xatolarni ushlab, bitta formatga keltiradigan joy. Globalmi: `APP_FILTER` yoki `useGlobalFilters`. Qaror daraxti:
- `HttpException` → uning status va xabarini oling (validatsiya xabari massiv bo'lishi mumkin);
- DB xatosi (`QueryFailedError`) → `code` bo'yicha tarjima: unique → `409`, FK → `409/422`; boshqalari → `500`;
- qolgan hamma narsa → `500`, xabar doim umumiy; tafsilot **faqat logda**.

Nima **hech qachon** javobga tushmasligi kerak: stack trace, SQL, yo'llar, kutubxona nomlari. Testlar buni qidiradi.

`@Catch()` (argumentsiz) hamma narsani ushlaydi — lekin tartib/ixtisoslashish haqida o'ylang (bitta katta filter vs ixtisoslashganlar).

Biznes qoidalarining xatolarini ham o'ylab ko'ring: servislar `HttpException` hosilalarini tashlaydimi yoki o'z domen xatolarini (keyin filter HTTP'ga aylantiradi)? Ikkinchisi toza, lekin ko'proq kod. Qaroringizni `ARCHITECTURE.md` da asoslang.

**Odatiy xatolar.**
- Kutilmagan xatoni `message` bilan javobga qaytarish (sizib chiqish).
- Filter ichida `response.send()` va unutilgan `return` → ikki marta javob.
- DB unique xatosini ushlamasdan, "avval tekshir" mantiqiga tayanish (poyga).
- Express darajasidagi xatolar (buzilgan JSON, juda katta tana) Nest filteridan o'tishini tekshirmaslik — qo'lda sinab ko'ring.

**Qayerdan o'rganish.** *Exception filters*, `@Catch`, `HttpAdapterHost`; PostgreSQL error codes; Node `pg` xato obyektidagi `code`, `constraint`.

---

## 22. Loglash va maxfiy ma'lumotlar

**Muammo.** Loglar foydali, lekin parol yoki tokenni tasodifan yozib yuborish — jiddiy xavfsizlik hodisasi. Loglar odatda ko'p odamga va tashqi tizimlarga ko'rinadi.

**Tushuncha.** Yondashuv: **nimani loglashni ruxsat berish** (allowlist), *nimani yashirishni* sanashdan ko'ra xavfsizroq. Misol: faqat metod, yo'l (query'siz yoki tozalangan), status, davomiylik, requestId, userId — tana (body) va sarlavhalarni umuman yozmang. Agar kerak bo'lsa — `redactSensitive` orqali o'tkazing.

Redaction: kalit nomiga qarab (`password`, `token`...) va **qiymat ko'rinishiga** qarab (`Bearer ...`, JWT shakli). Ikkinchisi nega kerak? Sir kutilmagan joyda (xato xabari, URL) chiqib qolishi mumkin.

E'tibor bering: xato filteri `500` ni logga yozganda stack trace va xato obyektida **so'rov tafsilotlari** bo'lishi mumkin (masalan, `axios` xatolari sarlavhalarni o'z ichiga oladi). Unit-test uchun `redactSensitive` — sof funksiya, shuning uchun test qilish oson.

Testlar loglarni qanday ushlaydi? `process.stdout`/`stderr`/`console`. Demak, loglaringiz shu yerdan chiqishi kerak (fayl-deskriptorga to'g'ridan-to'g'ri yozadigan kutubxona ishlamaydi).

**Odatiy xatolar.**
- `JSON.stringify(req.body)` ni loglash.
- Faqat `req.headers.authorization` ni yashirib, `Cookie` yoki `Set-Cookie` ni unutish.
- Redaction funksiyasi kirish obyektini o'zgartirib yuborishi (keyin handler `password` o'rniga `[REDACTED]` ni ko'radi!).
- Aylanma havolali obyektda `JSON.stringify` yiqilishi.

**Qayerdan o'rganish.** OWASP *Logging Cheat Sheet*; NestJS: *Logger*; `res.on('finish')`.

---

## 23. Test bazasini izolyatsiya qilish

**Muammo.** Testlar dev bazani buzmasligi, bir-biriga ta'sir qilmasligi va qayta ishga tushganda bir xil natija berishi kerak.

**Tushuncha.** Ikki daraja izolyatsiya:
1. **Muhit darajasi**: alohida baza (`*_test`), infratuzilma esa nomi `_test` bilan tugamasa ishlashni rad etadi. Nima uchun bunday "xavfsizlik qulfi" kerak? Bir marta noto'g'ri `.env` — va dev bazangiz tozalanadi.
2. **Test darajasi**: har bir testdan oldin ma'lumotlarni tozalash (`TRUNCATE ... CASCADE`). Muqobillar: har bir testni tranzaksiyada ishga tushirib `ROLLBACK` qilish (tez, lekin ilova o'z tranzaksiyalarini ochsa murakkablashadi), yoki har safar bazani qayta yaratish (sekin). Biz `TRUNCATE` ni tanladik — nega? Tranzaksiya-rollback yondashuvi E2E'da (HTTP orqali, alohida ulanishlar) nima uchun ishlamaydi?

Sxema bir marta (migratsiyalar orqali) yaratiladi, ma'lumot esa har testdan oldin tozalanadi. Shu sababli migratsiyadagi xato **hamma** testni yiqitadi.

Fayllar uchun ham xuddi shu: har bir test fayli vaqtinchalik papka oladi va u tozalanadi.

**Odatiy xatolar.**
- Test ma'lumotlari boshqa testda qolib ketishi → ketma-ketlikka bog'liq testlar.
- Haqiqiy emailga xat yuboradigan yoki real servislarga murojaat qiladigan test.
- `sleep` bilan kutish. Buning o'rniga hodisani kuting (`vi.waitFor`).
- Test muhitida `.env` (dev) ni o'qib yuborish.

**Qayerdan o'rganish.** Vitest: `globalSetup`, `setupFiles`, `fileParallelism`; PostgreSQL: `TRUNCATE ... RESTART IDENTITY CASCADE`. Qidiruv: "integration test database isolation strategies".

---

## 24. Mock'lar bilan unit-test

**Muammo.** Unit-test tez, deterministik va **bitta narsa** haqida bo'lishi kerak. Haqiqiy DB yoki fayl tizimi bilan ishlasa — bu E2E.

**Tushuncha.** Test double turlari: *stub* (tayyor javob beradi), *mock* (chaqirilganini tekshiradi), *fake* (soddalashtirilgan haqiqiy implementatsiya), *spy*. Qachon nimasi kerak?
- Sof funksiyalar (ruxsat matritsasi, status o'tishlari, redaction): **mock kerak emas** — kirish → chiqish. Jadvalga asoslangan testlar (`it.each`) bu yerda juda mos.
- Interceptor: `ExecutionContext` va `CallHandler` ni soxta ob'ekt qilasiz; RxJS oqimi uchun `of()`/`throwError()`.
- Vaqt: haqiqiy `sleep` o'rniga soxta soat (`vi.useFakeTimers`). Test soatni *qaysi* API'lar (`Date`, `performance`, `hrtime`) uchun soxtalashtiradi? Interceptor'ingiz qaysi birini ishlatayotganini bilishingiz kerak.

**Muhim:** *implementatsiya tafsiloti*ni emas, **kuzatiladigan xatti-harakatni** tekshiring. "`save` aynan 1 marta chaqirildi" — ko'pincha mo'rt test; "natija shunday" — mustahkam test.

**Odatiy xatolar.**
- Hamma narsani mock qilib, testning o'zi mock'ni sinab qolishi.
- Testlar orasida mock holatini tozalamaslik (`restoreMocks`/`clearMocks`).
- Asinxron testda `await` ni unutish — test "o'tadi", aslida hech narsa tekshirilmaydi.

**Qayerdan o'rganish.** Vitest: *Mocking*, `vi.fn`, `vi.spyOn`, *Fake timers*; NestJS: *Testing*; RxJS `lastValueFrom`/`firstValueFrom`.

---

## 25. Supertest bilan E2E test

**Muammo.** Ilova ishlayotganini HTTP darajasida, haqiqiy bog'liqliklar bilan tekshirish.

**Tushuncha.** E2E'da ilova ko'tariladi (`Test.createTestingModule({ imports: [AppModule] })` → `createNestApplication()` → `init()`), Supertest esa unga port ochmasdan so'rov yuboradi. Muhim: E2E'da ilova **production'dagidek** sozlanishi kerak — shuning uchun `configureApp`. Agar `main.ts` da `app.useGlobalPipes(...)` qilsangiz, E2E'da bu yo'q va testlar "validatsiya ishlamayapti" deb yiqiladi.

Yaxshi E2E test: arrange (sahna) → act (bitta so'rov) → assert (status, tana, **yon ta'sir**: keyingi so'rov bilan tekshirish). Bu testlarda sahna ham HTTP orqali quriladi — ya'ni testlar sxemaga emas, **shartnomaga** tayanadi.

Testlar yiqilganda: `TEST_VERBOSE=1` bilan ilova loglarini ko'ring; bitta testni `-t` bilan ajratib oling; so'rovni `curl` bilan qo'lda takrorlang.

**Odatiy xatolar.**
- Test ilovasi va haqiqiy ilova sozlamalari farq qilishi.
- Ilovani har test uchun qayta ko'tarish (sekin) — bir fayl uchun bir marta, ma'lumotlarni esa tozalash.
- `app.close()` ni unutib, ochiq ulanishlar tufayli jarayon osilib qolishi.
- Status kodni tekshirib, tana yoki yon ta'sirni tekshirmaslik.

**Qayerdan o'rganish.** NestJS: *Testing → End-to-end testing*; Supertest README (`.set`, `.send`, `.attach`, `.field`, `.buffer`, `.parse`).

---

## 26. Tez-tez uchraydigan "nega yiqilyapti?" holatlari

| Alomat | Ehtimoliy sabab |
|---|---|
| `"src/app.module.ts" topilmadi` | Fayl/eksport nomi 17-bo'lim shartnomasidan farq qilmoqda |
| Hamma E2E test `ECONNREFUSED` | `pnpm db:up` ishlamagan yoki port band |
| `relation "..." does not exist` / `column ... does not exist` | Migratsiya yo'q yoki entity bilan mos emas; `pnpm migration:run` ni test bazasiga qo'lda sinang |
| Hamma test "Unauthorized" | Global guard `@Public` yorlig'ini o'qimayapti yoki strategiya modulda yo'q |
| `Nest can't resolve dependencies` | Provider modulga qo'shilmagan yoki `exports`/`imports` yetishmaydi |
| Validatsiya "ishlamayapti" | Pipe faqat `main.ts` da — `configureApp` ga ko'chiring |
| Fayl yuklashda `400 Unexpected field` | Maydon nomi `file` emas |
| Yuklash testlari `413` o'rniga `500` | Multer xatosi filter orqali o'tmayapti yoki `limits` o'rnatilmagan |
| `Cannot set headers after they are sent` | Handler/filter ikki marta javob yuboryapti |
| Testlar vaqti-vaqti bilan yiqiladi | Poyga holati: UNIQUE xatosini `409` ga aylantirmayapsiz |
| Logdagi maxfiy ma'lumot testi yiqiladi | Qaysi qator ekanini test xabaridan ko'ring; ehtimol Nest'ning o'z xato logi (stack) yoki so'rov tanasi |
| `X-Response-Time` yo'q | Interceptor global emas yoki handler'ga yetmay guard rad etgan |
| `pnpm test:e2e` bazani "himoya" qilib to'xtaydi | `DB_NAME` `_test` bilan tugamaydi — to'g'ri, shunday bo'lishi kerak |

---

## Oxirgi maslahat

Test yashil bo'lgach, to'xtamang: *nega* o'tdi, deb so'rang. Kodni test uchun emas, shartnoma uchun yozing — keyin yashirin testlar (va haqiqiy hayot) ham o'tadi.
