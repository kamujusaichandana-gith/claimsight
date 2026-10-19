import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { readFile, unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import multer from 'multer'
import type { RequestHandler } from 'express'
import { AppError } from '../lib/app-error.js'

const uploadDirectory = fileURLToPath(
  new URL('../../uploads/', import.meta.url),
)
const allowedMimeTypes: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
}

export const claimDocumentUpload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      mkdirSync(uploadDirectory, { recursive: true })
      callback(null, uploadDirectory)
    },
    filename: (_request, file, callback) => {
      callback(null, `${randomUUID()}${allowedMimeTypes[file.mimetype]}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!allowedMimeTypes[file.mimetype]) {
      callback(new AppError(400, 'Only PDF, JPG, and PNG files are allowed'))
      return
    }

    callback(null, true)
  },
})

export const validateClaimDocumentContent: RequestHandler = async (
  request,
  _response,
  next,
) => {
  const file = request.file
  if (!file) {
    next()
    return
  }

  const contents = await readFile(file.path)
  const isPdf =
    file.mimetype === 'application/pdf' &&
    contents.subarray(0, 5).toString() === '%PDF-'
  const isJpeg =
    file.mimetype === 'image/jpeg' &&
    contents[0] === 0xff &&
    contents[1] === 0xd8 &&
    contents[2] === 0xff
  const isPng =
    file.mimetype === 'image/png' &&
    contents
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))

  if (!isPdf && !isJpeg && !isPng) {
    await unlink(file.path)
    throw new AppError(
      400,
      'The uploaded file content does not match a supported type',
    )
  }

  next()
}
