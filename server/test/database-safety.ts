export function assertSafeTestDatabaseUrl(
  testDatabaseUrl: string | undefined,
  databaseUrl: string | undefined,
): string {
  if (!testDatabaseUrl?.trim()) {
    throw new Error(
      'Tests require TEST_DATABASE_URL. Set it to a dedicated PostgreSQL database whose name contains "test".',
    )
  }

  let testUrl: URL
  try {
    testUrl = new URL(testDatabaseUrl)
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL connection URL.')
  }
  if (!['postgres:', 'postgresql:'].includes(testUrl.protocol)) {
    throw new Error('TEST_DATABASE_URL must use the PostgreSQL protocol.')
  }

  const databaseName = decodeURIComponent(testUrl.pathname.replace(/^\/+/, ''))
  if (!databaseName.toLowerCase().includes('test')) {
    throw new Error(
      'Refusing to run tests: the TEST_DATABASE_URL database name must contain "test".',
    )
  }

  if (databaseUrl?.trim()) {
    let developmentUrl: URL
    try {
      developmentUrl = new URL(databaseUrl)
    } catch {
      developmentUrl = new URL('http://invalid.local')
    }

    if (
      testDatabaseUrl.trim() === databaseUrl.trim() ||
      (
        ['postgres:', 'postgresql:'].includes(developmentUrl.protocol) &&
        developmentUrl.hostname === testUrl.hostname &&
        developmentUrl.port === testUrl.port &&
        developmentUrl.pathname === testUrl.pathname
      )
    ) {
      throw new Error(
        'Refusing to run tests: TEST_DATABASE_URL must not point to DATABASE_URL.',
      )
    }
  }

  return testDatabaseUrl.trim()
}
