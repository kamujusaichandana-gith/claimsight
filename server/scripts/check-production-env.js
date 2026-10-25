import process from 'node:process'

if (process.env.NODE_ENV === 'production') {
  const requiredVariables = ['DATABASE_URL', 'JWT_SECRET', 'CLIENT_ORIGIN']
  const missingVariables = requiredVariables.filter(
    (name) => !process.env[name]?.trim(),
  )
  if (
    process.env.LLM_ENABLED?.trim().toLowerCase() === 'true' &&
    !process.env.LLM_API_KEY?.trim()
  ) {
    missingVariables.push('LLM_API_KEY (required when LLM_ENABLED=true)')
  }

  if (missingVariables.length > 0) {
    process.stderr.write(
      `Missing required production environment variable(s): ${missingVariables.join(', ')}\n`,
    )
    process.exitCode = 1
  }
}
