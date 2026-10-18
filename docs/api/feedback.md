# Feedback

User feedback with optional admin replies. Users manage their own feedback; admins can list everything and reply.

**Base path:** `/feedback` · See the [conventions guide](./README.md) for envelope and errors.

## The feedback object

```json
{
  "_id": "665f5b90e3a2a24b8c8d7e01",
  "user": "665f1c9be3a2a24b8c8d7a01",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "feedback": "Love the app — dark mode would be great!",
  "reply": "Thanks! Dark mode ships next release.",
  "createdAt": "2026-07-16T13:00:00.000Z",
  "updatedAt": "2026-07-16T13:30:00.000Z"
}
```

`reply` is present only after an admin has responded. `user` links the author's profile; the service also supports anonymous submissions (with explicit `name` + `email`), though the current controller requires an authenticated caller.

---

## Submit feedback

```
POST /feedback/post-feedback     🔒 user
```

Creates feedback attributed to the authenticated user (name/email are resolved from the profile). The submitter receives a thank-you notification and the admin feed is notified.

### Body parameters

| Parameter  | Type   | Required | Description   |
| ---------- | ------ | -------- | ------------- |
| `feedback` | string | Yes      | Feedback text |

### Example request

```bash
curl -X POST http://localhost:8001/feedback/post-feedback \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "feedback": "Love the app — dark mode would be great!" }'
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Feedback posted",
  "data": { "...": "feedback object" }
}
```

### Errors

| Status | Condition          |
| ------ | ------------------ |
| `400`  | Missing `feedback` |

---

## Get feedback by id

```
GET /feedback/get-feedback     🔒 user
```

### Query parameters

| Parameter    | Type   | Required |
| ------------ | ------ | -------- |
| `feedbackId` | string | Yes      |

### Example request

```bash
curl "http://localhost:8001/feedback/get-feedback?feedbackId=665f5b90e3a2a24b8c8d7e01" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Feedback retrieved",
  "data": { "...": "feedback object" }
}
```

### Errors

| Status | Condition            |
| ------ | -------------------- |
| `400`  | Missing `feedbackId` |
| `404`  | Feedback not found   |

---

## List feedback

```
GET /feedback/get-all-feedbacks     🔒 user
```

Paginated list — the caller's own feedback for users, **all** feedback for admins. Supports the standard [pagination/filter/sort parameters](./README.md#pagination-filtering-sorting).

### Example request

```bash
curl "http://localhost:8001/feedback/get-all-feedbacks?page=1&limit=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Feedback retrieved",
  "data": {
    "meta": { "page": 1, "limit": 10, "total": 2, "totalPage": 1 },
    "feedback": [{ "...": "feedback objects" }]
  }
}
```

---

## Reply to feedback

```
PATCH /feedback/update-feedback-with-reply     🔒 admin
```

Attaches (or overwrites) an admin reply. The original submitter is notified.

### Body parameters

| Parameter    | Type   | Required |
| ------------ | ------ | -------- |
| `feedbackId` | string | Yes      |
| `reply`      | string | Yes      |

### Example request

```bash
curl -X PATCH http://localhost:8001/feedback/update-feedback-with-reply \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "feedbackId": "665f5b90e3a2a24b8c8d7e01",
    "reply": "Thanks! Dark mode ships next release."
  }'
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Feedback updated",
  "data": { "...": "feedback object with reply" }
}
```

### Errors

| Status | Condition                       |
| ------ | ------------------------------- |
| `400`  | Missing `feedbackId` or `reply` |
| `403`  | Caller is not an admin          |
| `404`  | Feedback not found              |

---

## Delete feedback

```
DELETE /feedback/delete-feedback     🔒 user
```

### Body parameters

| Parameter    | Type   | Required |
| ------------ | ------ | -------- |
| `feedbackId` | string | Yes      |

### Example request

```bash
curl -X DELETE http://localhost:8001/feedback/delete-feedback \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "feedbackId": "665f5b90e3a2a24b8c8d7e01" }'
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Feedback deleted",
  "data": { "acknowledged": true, "deletedCount": 1 }
}
```

### Errors

| Status | Condition            |
| ------ | -------------------- |
| `400`  | Missing `feedbackId` |
| `404`  | Feedback not found   |
