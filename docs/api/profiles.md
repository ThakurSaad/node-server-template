# Profiles

Manage the authenticated account's profile. The same three operations exist for both roles — mounted at `/user` for users and `/admin` for admins — plus an admin-creation endpoint reserved for the SUPER_ADMIN.

**Base paths:** `/user`, `/admin` · See the [conventions guide](./README.md) for envelope, errors, and auth.

## The profile object

Profiles are stored separately from credentials: the `Auth` record (email, password, role, account status) is linked from the profile via `authId`, which is populated in profile responses.

```json
{
  "_id": "665f1c9be3a2a24b8c8d7a01",
  "authId": {
    "_id": "665f1c9be3a2a24b8c8d7a00",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "USER",
    "isBlocked": false,
    "isActive": true
  },
  "name": "Jane Doe",
  "email": "jane@example.com",
  "profile_image": "uploads/profile_image/6f0b6cf8-6f4e-4f2a-9c1e.jpg",
  "phoneNumber": "+8801700000000",
  "address": "Dhaka, Bangladesh",
  "isOnline": false,
  "createdAt": "2026-07-16T09:00:00.000Z",
  "updatedAt": "2026-07-16T09:00:00.000Z"
}
```

Admin profiles have the same shape minus the user-specific fields (`isOnline`, `locationCoordinates`).

---

## Get profile

```
GET /user/profile        🔒 user
GET /admin/profile       🔒 admin
```

Returns the authenticated account's profile with the linked auth record populated.

### Example request

```bash
curl http://localhost:8001/user/profile \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "User retrieved successfully",
  "data": { "...": "profile object" }
}
```

### Errors

| Status | Condition                      |
| ------ | ------------------------------ |
| `401`  | Missing or invalid token       |
| `403`  | Account blocked or deactivated |
| `404`  | Profile record not found       |

---

## Update profile

```
PATCH /user/edit-profile     🔒 user
PATCH /admin/edit-profile    🔒 admin
```

Partially updates the profile. Send as `multipart/form-data` when uploading a profile image; plain JSON works for text-only updates. Updating `name` also syncs it to the auth record. Uploading a new image deletes the previous file from disk.

### Body parameters (all optional)

| Parameter       | Type   | Notes                                                    |
| --------------- | ------ | -------------------------------------------------------- |
| `name`          | string |                                                          |
| `phoneNumber`   | string |                                                          |
| `address`       | string |                                                          |
| `profile_image` | file   | JPEG/PNG/WebP, max 5 MB; stored under a random UUID name |

### Example request

```bash
curl -X PATCH http://localhost:8001/user/edit-profile \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "name=Jane D." \
  -F "profile_image=@./avatar.png"
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Profile updated successfully",
  "data": { "...": "updated profile object" }
}
```

### Errors

| Status | Condition                                    |
| ------ | -------------------------------------------- |
| `400`  | Invalid file type or unexpected upload field |
| `413`  | File exceeds the 5 MB limit                  |
| `404`  | Profile record not found                     |

Uploaded images are served publicly at `GET /uploads/profile_image/<filename>`.

---

## Delete account

```
DELETE /user/delete-account     🔒 user
DELETE /admin/delete-account    🔒 admin
```

Permanently deletes the account (both the credential and profile records) after re-confirming the password. Also removes the stored profile image. **This cannot be undone.**

### Body parameters

| Parameter  | Type   | Required | Description                  |
| ---------- | ------ | -------- | ---------------------------- |
| `email`    | string | Yes      | Must match the account email |
| `password` | string | Yes      | Current password             |

### Example request

```bash
curl -X DELETE http://localhost:8001/user/delete-account \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "email": "jane@example.com", "password": "hunter2-secure" }'
```

### Response `200`

```json
{ "statusCode": 200, "success": true, "message": "Account deleted!" }
```

### Errors

| Status | Condition          |
| ------ | ------------------ |
| `403`  | Password incorrect |
| `404`  | Account not found  |

---

## Create admin

```
POST /admin/create-admin     🔒 super admin
```

Creates a **pre-activated** `ADMIN` account — no OTP flow. Admins can never self-register through `/auth/register`; this endpoint (or the one-time `npm run seed:admin` script that creates the SUPER_ADMIN) is the only way privileged accounts come into existence.

### Body parameters

| Parameter  | Type   | Required | Description          |
| ---------- | ------ | -------- | -------------------- |
| `name`     | string | Yes      |                      |
| `email`    | string | Yes      | Must be unused       |
| `password` | string | Yes      | Minimum 8 characters |

### Example request

```bash
curl -X POST http://localhost:8001/admin/create-admin \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ops Admin",
    "email": "ops@example.com",
    "password": "a-strong-password"
  }'
```

### Response `201`

```json
{
  "statusCode": 201,
  "success": true,
  "message": "Admin created successfully",
  "data": {
    "_id": "665f1c9be3a2a24b8c8d7a10",
    "name": "Ops Admin",
    "email": "ops@example.com",
    "role": "ADMIN"
  }
}
```

### Errors

| Status | Condition                         |
| ------ | --------------------------------- |
| `403`  | Caller is not a SUPER_ADMIN       |
| `409`  | An account with this email exists |
