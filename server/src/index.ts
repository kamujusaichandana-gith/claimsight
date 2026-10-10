import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

const app = express()
const port = Number(process.env.PORT ?? 3000)

app.use(helmet())
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  }),
)
app.use(express.json())

app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' })
})

app.listen(port, () => {
  console.log(`ClaimSight API listening on port ${port}`)
})
