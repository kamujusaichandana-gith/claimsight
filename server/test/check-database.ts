import 'dotenv/config'
import { assertSafeTestDatabaseUrl } from './database-safety.js'

try {
  assertSafeTestDatabaseUrl(
    process.env.TEST_DATABASE_URL,
    process.env.DATABASE_URL,
  )
} catch (error) {
  if (!(error instanceof Error)) {
    throw error
  }
  console.error(error.message)
  process.exitCode = 1
}
