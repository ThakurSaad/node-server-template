# Content (CMS)

Admin-editable static content: **terms & conditions**, **privacy policy**, **about us**, **FAQ**, and **contact us**. Reading is public; writing and deleting require an admin.

**Base path:** `/manage` · See the [conventions guide](./README.md) for envelope and errors.

## The content object

All five content types share one shape — a single document per type:

```json
{
  "_id": "665f6ca0e3a2a24b8c8d7f01",
  "description": "<h1>Terms & Conditions</h1><p>...</p>",
  "createdAt": "2026-07-16T14:00:00.000Z",
  "updatedAt": "2026-07-16T14:00:00.000Z"
}
```

`description` is free-form text — store HTML or Markdown as your frontend prefers.

## Endpoint pattern

Each content type follows the same three routes. Substitute `<content>` with one of: `terms-conditions` · `privacy-policy` · `about-us` · `faq` · `contact-us`.

| Method | Endpoint            | Access   | Behavior                                                               |
| ------ | ------------------- | -------- | ---------------------------------------------------------------------- |
| POST   | `/add-<content>`    | 🔒 admin | **Upsert** — creates the document or updates it in place               |
| GET    | `/get-<content>`    | Public   | Returns the current document (`data` is `null`/omitted if none exists) |
| DELETE | `/delete-<content>` | 🔒 admin | Deletes by id (passed as a query parameter)                            |

### Full route list

```
POST   /manage/add-terms-conditions        GET /manage/get-terms-conditions        DELETE /manage/delete-terms-conditions
POST   /manage/add-privacy-policy          GET /manage/get-privacy-policy          DELETE /manage/delete-privacy-policy
POST   /manage/add-about-us                GET /manage/get-about-us                DELETE /manage/delete-about-us
POST   /manage/add-faq                     GET /manage/get-faq                     DELETE /manage/delete-faq
POST   /manage/add-contact-us              GET /manage/get-contact-us              DELETE /manage/delete-contact-us
```

---

## Create or update content

```
POST /manage/add-<content>     🔒 admin
```

Upserts the single document for that content type: the first call creates it; subsequent calls overwrite it.

### Body parameters

| Parameter     | Type   | Required | Description  |
| ------------- | ------ | -------- | ------------ |
| `description` | string | Yes      | Content body |

### Example request

```bash
curl -X POST http://localhost:8001/manage/add-privacy-policy \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "description": "<h1>Privacy Policy</h1><p>We respect your privacy...</p>" }'
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Privacy policy updated",
  "data": { "...": "content object" }
}
```

(`message` is `"Successful"` on first creation, the type-specific `"... updated"` on subsequent upserts.)

---

## Read content

```
GET /manage/get-<content>     Public
```

### Example request

```bash
curl http://localhost:8001/manage/get-privacy-policy
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Successful",
  "data": { "...": "content object" }
}
```

If the content has never been created, `data` is omitted.

---

## Delete content

```
DELETE /manage/delete-<content>?id=<documentId>     🔒 admin
```

### Query parameters

| Parameter | Type   | Required | Description             |
| --------- | ------ | -------- | ----------------------- |
| `id`      | string | Yes      | The content document id |

### Example request

```bash
curl -X DELETE "http://localhost:8001/manage/delete-privacy-policy?id=665f6ca0e3a2a24b8c8d7f01" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Deletion Successful",
  "data": { "acknowledged": true, "deletedCount": 1 }
}
```

### Errors

| Status | Condition                     |
| ------ | ----------------------------- |
| `403`  | Caller is not an admin        |
| `404`  | No document with the given id |
