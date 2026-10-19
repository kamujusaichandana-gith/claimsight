# API Examples

Base URL: `http://localhost:3000`

All successful authentication responses include a `user` object containing `id`, `name`, `email`, `role`, and `createdAt`. Password hashes are never returned. Use the returned token as a bearer token for protected endpoints.

## Register

`POST /api/auth/register`

```json
{
  "name": "Avery Customer",
  "email": "avery@example.com",
  "password": "secure-pass-123"
}
```

Returns `201 Created` with `{ "user": { ... }, "token": "..." }`. Registration always assigns the `CUSTOMER` role; a `role` property in the request is ignored.

## Login

`POST /api/auth/login`

```json
{
  "email": "avery@example.com",
  "password": "secure-pass-123"
}
```

Returns `200 OK` with `{ "user": { ... }, "token": "..." }`. Wrong email and wrong password both return `401` with `Invalid email or password`.

## Current user

`GET /api/auth/me`

Header: `Authorization: Bearer <token>`

Returns `200 OK` with `{ "user": { ... } }`.

## Validation error

Invalid request bodies return `400 Bad Request` with a `Validation failed` error and field details. Auth routes are limited to 20 requests per 15-minute window per client.

## Environment

Set `JWT_SECRET` to a long random secret and `JWT_EXPIRES_IN` to a `jsonwebtoken` duration such as `1h` in `server/.env`. See `server/.env.example` for the variable names.

## Customer policies

All customer endpoints below require `Authorization: Bearer <token>`. Policies are always scoped to the authenticated customer.

`GET /api/policies` returns `{ "items": [...] }` for the current customer. `GET /api/policies/:id` returns `{ "policy": { ... } }`. A missing policy or a policy owned by another customer returns `404`.

## Create a claim

`POST /api/claims`

```json
{
  "policyId": "cm123policy",
  "incidentDate": "2026-10-10",
  "incidentType": "Vehicle collision",
  "description": "Damage to the rear bumper.",
  "amount": 1250.5
}
```

The policy must belong to the authenticated customer and be `ACTIVE`; otherwise the endpoint returns `404`. The server assigns the customer ID, claim number, and initial `SUBMITTED` status. Claim creation and its first status-history entry are committed together. Success returns `201 Created` with `{ "claim": { ... } }`.

## List claims

`GET /api/claims?status=UNDER_REVIEW&search=collision&sortBy=createdAt&order=desc&page=1&limit=10`

Supported `status` values are `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, and `PAID`. `sortBy` accepts `createdAt`, `updatedAt`, `incidentDate`, `amount`, `status`, or `claimNumber`; `order` accepts `asc` or `desc`. Page defaults to `1`, limit defaults to `10`, and limit cannot exceed `50`. Search matches claim number, incident type, and description. Results contain only the current customer's claims:

```json
{
  "items": [],
  "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
}
```

## Claim detail and documents

`GET /api/claims/:id` returns `{ "claim": { ... } }`, including comments, documents, and chronological status history. A claim owned by another customer returns `404`.

`POST /api/claims/:id/documents` accepts `multipart/form-data` with a single file field named `file`. Only PDF, JPG, and PNG MIME types with matching file signatures are accepted, up to 5 MiB. Files are stored in `server/uploads` under a randomly generated filename; the original filename is not stored. Success returns `201 Created` with `{ "document": { ... } }`; unsupported files return `400`, oversized files return `413`, and a claim owned by another customer returns `404`.

## Customer isolation checks

Create or seed customer A and customer B, each with a policy and claim. Authenticate as A, then verify:

- `GET /api/policies` and `GET /api/claims` contain only A's records.
- `GET /api/policies/<B-policy-id>`, `GET /api/claims/<B-claim-id>`, and `POST /api/claims/<B-claim-id>/documents` all return `404`.
- `POST /api/claims` using B's policy ID returns `404`, and including a `userId` in the body cannot create a claim for B or another account.
