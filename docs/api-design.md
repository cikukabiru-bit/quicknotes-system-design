# QuickNotes API Design

This document describes the real QuickNotes REST API that the backend team should build. (The API client in this repository uses the JSONPlaceholder practice API only to prove the front end can talk to an API.)

## Basics

- **Base URL:** `https://api.quicknotes.example/v1`
- **Format:** all requests and responses use JSON (`Content-Type: application/json`).
- **Authentication:** every endpoint except log in needs a token in the header: `Authorization: Bearer <token>`. Users can only see and change their own notes and tags.
- **Validation rules for a note:**
  - `title` is required, 1 to 100 characters.
  - `body` is optional, up to 10,000 characters.
  - `tags` is optional, a list of tag names.

## Endpoints

| #   | Method | Path          | Description                                                                                          | Success status |
| --- | ------ | ------------- | ---------------------------------------------------------------------------------------------------- | -------------- |
| 1   | POST   | `/auth/login` | Log in with email and password and receive a token.                                                  | 200 OK         |
| 2   | GET    | `/notes`      | List the logged-in user's notes, newest first. Supports `?page=`, `?limit=`, `?tag=` and `?search=`. | 200 OK         |
| 3   | GET    | `/notes/{id}` | Get one note by its id.                                                                              | 200 OK         |
| 4   | POST   | `/notes`      | Create a new note.                                                                                   | 201 Created    |
| 5   | PUT    | `/notes/{id}` | Replace a note's title, body and tags.                                                               | 200 OK         |
| 6   | PATCH  | `/notes/{id}` | Update only some fields of a note (for example just the title).                                      | 200 OK         |
| 7   | DELETE | `/notes/{id}` | Delete a note.                                                                                       | 204 No Content |
| 8   | GET    | `/tags`       | List the logged-in user's tags.                                                                      | 200 OK         |
| 9   | POST   | `/tags`       | Create a new tag.                                                                                    | 201 Created    |

## Example: create a note

**Request**

```http
POST /v1/notes
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "title": "Buy groceries",
  "body": "Milk, bread and sukuma wiki",
  "tags": ["personal", "shopping"]
}
```

**Response: 201 Created**

The response also includes the header `Location: /v1/notes/42`, which is the address of the new note.

```json
{
  "id": 42,
  "userId": 7,
  "title": "Buy groceries",
  "body": "Milk, bread and sukuma wiki",
  "tags": ["personal", "shopping"],
  "createdAt": "2026-10-18T09:30:00Z",
  "updatedAt": "2026-10-18T09:30:00Z"
}
```

## Example: list notes

**Request**

```http
GET /v1/notes?page=1&limit=2
Authorization: Bearer <token>
```

**Response: 200 OK**

```json
{
  "data": [
    {
      "id": 42,
      "userId": 7,
      "title": "Buy groceries",
      "body": "Milk, bread and sukuma wiki",
      "tags": ["personal", "shopping"],
      "createdAt": "2026-10-18T09:30:00Z",
      "updatedAt": "2026-10-18T09:30:00Z"
    },
    {
      "id": 41,
      "userId": 7,
      "title": "Study for the Day 7 quiz",
      "body": "Caching, CDNs and load balancers",
      "tags": ["study"],
      "createdAt": "2026-10-17T18:05:00Z",
      "updatedAt": "2026-10-17T18:05:00Z"
    }
  ],
  "page": 1,
  "limit": 2,
  "total": 37
}
```

The list is **paginated** (a page of notes at a time) so a user with thousands of notes does not receive them all in one huge response.

## Error codes

| Status | Name                  | When it happens                                                                                |
| ------ | --------------------- | ---------------------------------------------------------------------------------------------- |
| 400    | Bad Request           | The request data is not valid, for example the title is missing or longer than 100 characters. |
| 401    | Unauthorized          | There is no token, or the token is wrong or has expired, so we do not know who the user is.    |
| 403    | Forbidden             | The user is logged in but is trying to read or change a note that belongs to someone else.     |
| 404    | Not Found             | The note or tag does not exist, for example `GET /notes/99999`.                                |
| 429    | Too Many Requests     | The user has sent too many requests in a short time (rate limiting protects the system).       |
| 500    | Internal Server Error | Something unexpected went wrong on the server. The user should try again later.                |

### Error body

Every error uses the same JSON shape, so the front end can always show `error.message` to the user:

```json
{
  "error": {
    "status": 400,
    "code": "VALIDATION_ERROR",
    "message": "Title is required and must be 100 characters or fewer.",
    "field": "title"
  }
}
```

Another example, for a missing note:

```json
{
  "error": {
    "status": 404,
    "code": "NOT_FOUND",
    "message": "Note 99999 was not found."
  }
}
```
