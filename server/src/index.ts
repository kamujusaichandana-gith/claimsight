import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { authRouter } from './routes/auth.routes.js'
import { errorHandler } from './middleware/error-handler.js'
import { AppError } from './lib/app-error.js'

const app = express()
const port = Number(process.env.PORT ?? 3000)

app.use(helmet())
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  }),
)
app.use(express.json())

app.use('/api/auth', authRouter)

app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' })
})

app.use((_request, _response, next) => {
  next(new AppError(404, 'Route not found'))
})
app.use(errorHandler)

app.listen(port, () => {
  console.log(`ClaimSight API listening on port ${port}`)
})
