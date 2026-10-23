import { access } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RequestHandler } from 'express'
import { UserRole } from '@prisma/client'
import { AppError } from '../lib/app-error.js'
import { prisma } from '../lib/prisma.js'

const uploadDirectory = fileURLToPath(new URL('../../uploads/', import.meta.url))

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    error.code === 'ENOENT'
  )
}

export const downloadClaimDocument: RequestHandler = async (
  request,
  response,
  next,
) => {
  const { claimId, documentId } = request.params
  if (!request.user || typeof claimId !== 'string' || typeof documentId !== 'string') {
    throw new AppError(404, 'Document not found')
  }

  const document = await prisma.claimDocument.findFirst({
    where: {
      id: documentId,
      claimId,
      ...(request.user.role === UserRole.CUSTOMER
        ? { claim: { userId: request.user.id } }
        : {}),
    },
  })

  if (!document) {
    throw new AppError(404, 'Document not found')
  }

  const filePath = join(uploadDirectory, basename(document.filePath))
  try {
    await access(filePath)
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new AppError(404, 'Document file is no longer available')
    }
    throw error
  }

  response.download(filePath, basename(document.fileName), (error) => {
    if (!error) return
    if (isMissingFileError(error) && !response.headersSent) {
      response.status(404).json({ error: 'Document file is no longer available' })
      return
    }
    next(error)
  })
}
