# Reviews

User-submitted ratings and reviews. Users see their own reviews; admins see everyone's.

**Base path:** `/review` · All endpoints are 🔒 **user**. See the [conventions guide](./README.md) for envelope and errors.

## The review object

```json
{
  "_id": "665f4a80e3a2a24b8c8d7d01",
  "user": "665f1c9be3a2a24b8c8d7a01",
  "rating": 5,
  "review": "Excellent service, would recommend!",
  "createdAt": "2026-07-16T12:00:00.000Z",
  "updatedAt": "2026-07-16T12:00:00.000Z"
}
```

`rating` is an integer from **1 to 5**.

---

## Create a review

```
POST /review/post-review
```

> ⚠️ **Template stub.** The route, controller, and service scaffolding exist, but the service body is intentionally empty — it returns `"Review posted"` with no data and persists nothing. Implement your product's review-creation rules here (typical body: `{ rating, review }`, with `user` taken from the token).

### Response `200`

```json
{ "statusCode": 200, "success": true, "message": "Review posted" }
```

---

## List reviews

```
GET /review/get-all-reviews
```

Paginated list with the author populated. **Users** receive only their own reviews; **admins** receive all reviews. Supports the standard [pagination/filter/sort parameters](./README.md#pagination-filtering-sorting) (e.g. `?rating=5`, `?sort=-createdAt`).

### Example request

```bash
curl "http://localhost:8001/review/get-all-reviews?page=1&limit=10&sort=-rating" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Review retrieved",
  "data": {
    "meta": { "page": 1, "limit": 10, "total": 3, "totalPage": 1 },
    "result": [
      {
        "_id": "665f4a80e3a2a24b8c8d7d01",
        "user": {
          "_id": "...",
          "name": "Jane Doe",
          "email": "jane@example.com"
        },
        "rating": 5,
        "review": "Excellent service, would recommend!"
      }
    ]
  }
}
```

---

## Get a review

```
GET /review/get-review
```

### Query parameters

| Parameter  | Type   | Required |
| ---------- | ------ | -------- |
| `reviewId` | string | Yes      |

### Example request

```bash
curl "http://localhost:8001/review/get-review?reviewId=665f4a80e3a2a24b8c8d7d01" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Review retrieved",
  "data": { "...": "review object" }
}
```

### Errors

| Status | Condition          |
| ------ | ------------------ |
| `400`  | Missing `reviewId` |
| `404`  | Review not found   |

---

## Update a review

```
PATCH /review/update-review
```

Updates `rating` and/or `review` text. Omitted fields are left unchanged.

### Body parameters

| Parameter  | Type    | Required | Description     |
| ---------- | ------- | -------- | --------------- |
| `reviewId` | string  | Yes      |                 |
| `rating`   | integer | No       | 1–5             |
| `review`   | string  | No       | New review text |

### Example request

```bash
curl -X PATCH http://localhost:8001/review/update-review \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "reviewId": "665f4a80e3a2a24b8c8d7d01", "rating": 4 }'
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Review updated",
  "data": { "...": "updated review object" }
}
```

### Errors

| Status | Condition                                |
| ------ | ---------------------------------------- |
| `400`  | Missing `reviewId`, or rating out of 1–5 |
| `404`  | Review not found                         |

---

## Delete a review

```
DELETE /review/delete-review
```

### Query parameters

| Parameter  | Type   | Required |
| ---------- | ------ | -------- |
| `reviewId` | string | Yes      |

### Example request

```bash
curl -X DELETE "http://localhost:8001/review/delete-review?reviewId=665f4a80e3a2a24b8c8d7d01" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Review deleted",
  "data": { "acknowledged": true, "deletedCount": 1 }
}
```

### Errors

| Status | Condition          |
| ------ | ------------------ |
| `400`  | Missing `reviewId` |
| `404`  | Review not found   |
