import { assertSafeTestDatabase, loadTestEnv } from './env';

// Har bir worker'da (har bir test faylida) env qayta yuklanadi va yana tekshiriladi.
loadTestEnv();
assertSafeTestDatabase();
