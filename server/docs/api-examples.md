# Authentication API Examples

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
