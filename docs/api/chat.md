# Chat

1-to-1 conversations with REST endpoints for history/management and WebSocket events for real-time delivery.

**Base path:** `/chat` · All REST endpoints are 🔒 **user**. See the [conventions guide](./README.md) for envelope and errors.

## Data model

A **Chat** is a pair of participants. **Messages** live in their own collection keyed by `chatId`, so conversations scale without growing the chat document.

```json
// Chat
{
  "_id": "665f2a11e3a2a24b8c8d7b01",
  "participants": ["665f1c9be3a2a24b8c8d7a01", "665f1d02e3a2a24b8c8d7a05"],
  "createdAt": "2026-07-16T10:00:00.000Z",
  "updatedAt": "2026-07-16T10:00:00.000Z"
}

// Message
{
  "_id": "665f2b47e3a2a24b8c8d7b10",
  "chatId": "665f2a11e3a2a24b8c8d7b01",
  "sender": "665f1c9be3a2a24b8c8d7a01",
  "receiver": "665f1d02e3a2a24b8c8d7a05",
  "message": "Hey! Is the item still available?",
  "isRead": false,
  "createdAt": "2026-07-16T10:05:00.000Z",
  "updatedAt": "2026-07-16T10:05:00.000Z"
}
```

---

## Start a chat

```
POST /chat/post-chat
```

Creates a conversation with another user — or returns the existing one if you've chatted before (idempotent). Both participants receive a notification when a new chat is created.

### Body parameters

| Parameter    | Type   | Required | Description                 |
| ------------ | ------ | -------- | --------------------------- |
| `receiverId` | string | Yes      | The other user's profile id |

### Example request

```bash
curl -X POST http://localhost:8001/chat/post-chat \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "receiverId": "665f1d02e3a2a24b8c8d7a05" }'
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Chat initiated",
  "data": { "...": "chat object" }
}
```

### Errors

| Status | Condition                    |
| ------ | ---------------------------- |
| `404`  | Sender or receiver not found |

---

## Get chat messages

```
GET /chat/get-chat-messages
```

Returns one chat with its participants and a **paginated** page of messages, newest first.

### Query parameters

| Parameter | Type    | Required | Default | Description       |
| --------- | ------- | -------- | ------- | ----------------- |
| `chatId`  | string  | Yes      | —       | Chat to fetch     |
| `page`    | integer | No       | `1`     | Message page      |
| `limit`   | integer | No       | `10`    | Messages per page |

### Example request

```bash
curl "http://localhost:8001/chat/get-chat-messages?chatId=665f2a11e3a2a24b8c8d7b01&page=1&limit=20" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Chat retrieved",
  "data": {
    "meta": { "page": 1, "limit": 20, "total": 57, "totalPage": 3 },
    "_id": "665f2a11e3a2a24b8c8d7b01",
    "participants": [
      {
        "_id": "...",
        "name": "Jane Doe",
        "phoneNumber": "...",
        "profile_image": "..."
      },
      {
        "_id": "...",
        "name": "John Roe",
        "phoneNumber": "...",
        "profile_image": "..."
      }
    ],
    "messages": [{ "...": "message objects, newest first" }]
  }
}
```

### Errors

| Status | Condition        |
| ------ | ---------------- |
| `400`  | Missing `chatId` |
| `404`  | Chat not found   |

---

## List my chats

```
GET /chat/get-all-chats
```

Returns every conversation the authenticated user participates in, each annotated with `unRead` — the count of messages still unread by the caller — and fully populated participants.

### Example request

```bash
curl http://localhost:8001/chat/get-all-chats \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Chats retrieved",
  "data": {
    "chats": [
      {
        "_id": "665f2a11e3a2a24b8c8d7b01",
        "participants": [{ "...": "user objects" }],
        "unRead": 3,
        "createdAt": "2026-07-16T10:00:00.000Z"
      }
    ]
  }
}
```

---

## Mark messages as seen

```
PATCH /chat/update-message-as-seen
```

Marks every unread message in a chat **addressed to the caller** as read. Returns the Mongo update summary.

### Body parameters

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `chatId`  | string | Yes      |

### Example request

```bash
curl -X PATCH http://localhost:8001/chat/update-message-as-seen \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "chatId": "665f2a11e3a2a24b8c8d7b01" }'
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Message updated as seen",
  "data": { "acknowledged": true, "modifiedCount": 3, "matchedCount": 3 }
}
```

---

# WebSocket interface

Real-time messaging runs over **Socket.IO** on the same host/port as the REST API.

## Connecting

Handshakes are authenticated with the same JWT used for REST. Pass the access token in the handshake `auth` payload — the server derives your identity from the verified token and joins you to a room named after your user id:

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:8001", {
  auth: { token: accessToken },
});

socket.on("connect_error", (err) => {
  // "Authentication token is required" | "Invalid or expired token" |
  // "You are blocked" | "Account is not activated"
  console.error(err.message);
});
```

On successful connection your `isOnline` flag is set to `true`; it flips back to `false` on disconnect.

## Events

### `send_message` — client → server

Persists a message and delivers it to both participants' rooms in real time.

```js
socket.emit("send_message", {
  chatId: "665f2a11e3a2a24b8c8d7b01",
  receiverId: "665f1d02e3a2a24b8c8d7a05",
  message: "On my way!",
});
```

Both sender and receiver then receive:

```js
socket.on("send_message", (payload) => {
  // { statusCode: 200, success: true, message: "Message sent successfully",
  //   data: { ...message object } }
});
```

The `chatId` must reference an existing chat that includes both users — otherwise a `socket_error` is emitted.

### `update_location` — client → server (broadcast back)

Persists the caller's GeoJSON location and broadcasts it to all connected clients.

```js
socket.emit("update_location", { lat: 23.7808, long: 90.2792 });

socket.on("update_location", (payload) => {
  // { ..., data: { type: "Point", coordinates: [90.2792, 23.7808] } }
});
```

### `online_status` — server → client

Confirmation emitted to you after connect/disconnect presence updates:

```js
socket.on("online_status", (payload) => {
  // { ..., message: "You are online", data: { isOnline: true } }
});
```

### `socket_error` — server → client

Every handler failure is reported on a single channel using the REST error shape:

```js
socket.on("socket_error", ({ status, message }) => {
  console.error(status, message); // e.g. 404 "Chat not found. ..."
});
```

Fatal errors (failed user validation) also force a disconnect.
