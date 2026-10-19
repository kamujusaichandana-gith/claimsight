import { ClaimStatus, PolicyType } from '@prisma/client'
import { z } from 'zod'

export const listAdminClaimsQuerySchema = z.object({
  status: z.nativeEnum(ClaimStatus).optional(),
  policyType: z.nativeEnum(PolicyType).optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z
    .enum([
      'createdAt',
      'updatedAt',
      'incidentDate',
      'amount',
      'status',
      'claimNumber',
    ])
    .default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .default(10)
    .transform((limit) => Math.min(limit, 50)),
})

export const updateClaimStatusSchema = z.object({
  status: z.nativeEnum(ClaimStatus),
})

export const createAdminClaimCommentSchema = z.object({
  message: z.string().trim().min(1).max(5000),
})

export type ListAdminClaimsQuery = z.infer<
  typeof listAdminClaimsQuerySchema
>
export type UpdateClaimStatusInput = z.infer<typeof updateClaimStatusSchema>
export type CreateAdminClaimCommentInput = z.infer<
  typeof createAdminClaimCommentSchema
>
