import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { assertSafeTestDatabaseUrl } from './database-safety.js'

export default function globalSetup(): void {
  const testDatabaseUrl = assertSafeTestDatabaseUrl(
    process.env.TEST_DATABASE_URL,
    process.env.DATABASE_URL,
  )
  const serverDirectory = fileURLToPath(new URL('../', import.meta.url))
  const prismaCli = fileURLToPath(
    new URL('../node_modules/prisma/build/index.js', import.meta.url),
  )

  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: serverDirectory,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'inherit',
  })
}
