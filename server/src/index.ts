import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { authRouter } from './routes/auth.routes.js'
import { adminRouter } from './routes/admin.routes.js'
import { customerRouter } from './routes/customer.routes.js'
import { errorHandler } from './middleware/error-handler.js'
import { AppError } from './lib/app-error.js'
import { prisma } from './lib/prisma.js'

if (process.env.NODE_ENV === 'production') {
  const missingEnvironmentVariables = [
    'DATABASE_URL',
    'JWT_SECRET',
    'CLIENT_ORIGIN',
  ].filter((name) => !process.env[name]?.trim())
  if (
    process.env.LLM_ENABLED?.trim().toLowerCase() === 'true' &&
    !process.env.LLM_API_KEY?.trim()
  ) {
    missingEnvironmentVariables.push('LLM_API_KEY (required when LLM_ENABLED=true)')
  }

  if (missingEnvironmentVariables.length > 0) {
    throw new Error(
      `Missing required production environment variable(s): ${missingEnvironmentVariables.join(', ')}`,
    )
  }
}

const app = express()
const port = Number(process.env.PORT ?? 3000)
const clientOrigins = (process.env.CLIENT_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.set('trust proxy', 1)
app.use(helmet())
app.use(
  cors({
    origin: clientOrigins,
  }),
)
app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api', customerRouter)

app.get('/health', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    response.status(200).json({ status: 'ok', database: 'connected' })
  } catch (error) {
    console.error('Health check database query failed:', error)
    response.status(503).json({
      status: 'error',
      database: 'unavailable',
      message: 'Database connection failed',
    })
  }
})

app.use((_request, _response, next) => {
  next(new AppError(404, 'Route not found'))
})
app.use(errorHandler)

app.listen(port, () => {
  console.log(`ClaimSight API listening on port ${port}`)
})
