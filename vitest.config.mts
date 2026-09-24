import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': import.meta.dirname } },
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
    // Unit tests never touch the real DB: prisma is mocked per file; env only needs to validate.
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      NEXTAUTH_SECRET: 'test-secret-test-secret-test-secret-123',
      NEXTAUTH_URL: 'http://localhost:3000',
    },
  },
})
