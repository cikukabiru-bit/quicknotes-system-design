# QuickNotes System Design

QuickNotes started as a browser-only note-taking app that saved notes in localStorage. This project (PLP Project 2) plans how to turn it into a real online service for **1 million users**. It has two parts:

1. **An API client** (`index.html`, `api.js`, `style.css`) that proves the front end can talk to an API. It loads, creates and deletes notes using the free [JSONPlaceholder](https://jsonplaceholder.typicode.com/) practice API, and shows loading, success, error and empty states.
2. **Three design documents** in the `docs` folder that the backend team would build from: the API design, the data model and the system architecture.

## Features of the API client

- **Load notes (GET):** loads 10 notes from the server and shows each note's title and body.
- **Create a note (POST):** validates the title (required, maximum 100 characters), sends the note to the server and adds it to the top of the list with the status code and new id.
- **Delete a note (DELETE):** sends a DELETE request and removes the note when it succeeds.
- **Clear feedback:** "Loading...", success (green) and error (red) messages, and an empty-state message when there are no notes.
- **Safe and careful:** buttons are disabled while a request is running, every request is wrapped in `try / catch`, and user text is added with `textContent` only.

## How to run the API client

1. Clone the repository:

```bash
   git clone https://github.com/cikukabiru-bit/quicknotes-system-design.git
```

2. Open the `quicknotes-system-design` folder in VS Code.
3. Right-click `index.html` and choose **Open with Live Server** (or open `index.html` in your browser).
4. Click **Load notes** to load notes, use the form to add a note, and click **Delete** on a note to remove it.

You need an internet connection, because the page talks to JSONPlaceholder. Note: JSONPlaceholder is a practice API, so notes you create are not really saved on the server. The comment above `handleDelete()` in `api.js` explains how the client handles this.

## Design documents

- [API design](docs/api-design.md): the REST endpoints, request and response examples, and error codes for the real QuickNotes API.
- [Data model](docs/data-model.md): the users, notes, tags and note_tags tables, their relationships, SQL, indexes and why we chose SQL.
- [Architecture](docs/architecture.md): requirements, the load estimate for 1 million users, the architecture diagram, request flows, trade-offs and how we avoid single points of failure.

## What I learned

- How to write one reusable `request()` function that calls `fetch`, checks `response.ok` and throws an error, so GET, POST and DELETE all handle errors the same way.
- Why a good interface shows every state (loading, success, error and empty) and disables buttons during a request, so users always know what is happening and cannot send the same request twice.
- How to design a REST API with clear paths, the right HTTP methods and the right status codes (for example 201 for created, 401 vs 403, and 404).
- How a many-to-many relationship (notes and tags) needs a join table, and how an index makes the most common query fast.
- How to estimate load (reads, writes and storage per second and per year) and use those numbers to choose components such as a cache, a read replica and a queue.
- That every design choice is a trade-off, for example a cache makes reads faster but data can be slightly out of date, and that removing single points of failure is what keeps a system available.
