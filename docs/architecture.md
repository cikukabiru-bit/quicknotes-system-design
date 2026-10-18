# QuickNotes Architecture

QuickNotes is moving from a browser-only app (notes saved in localStorage) to a real online service used by **1 million people**. This document describes the requirements, the expected load, the architecture and how a request travels through it.

## 1. Requirements

### Functional requirements (what the system must do)

- Users can sign up, log in and log out.
- Users can create, view, edit and delete their own notes.
- A note has a title (required, up to 100 characters) and an optional body.
- Users can add tags to notes and filter their notes by tag.
- Users can search their notes by words in the title or body.
- Notes are available on any device the user logs in from (phone, laptop).

### Non-functional requirements (how well it must do it)

- **Availability:** at least 99.9% (about 8.8 hours of downtime per year at most).
- **Latency:** listing notes should take under 200 milliseconds for 95% of requests.
- **Scalability:** support 1 million users, and grow by adding servers rather than rebuilding.
- **Durability:** a saved note must never be lost (replication and daily backups).
- **Security:** HTTPS everywhere, passwords stored as hashes, users can only access their own notes, and rate limiting to stop abuse.
- **Consistency:** after creating a note, a user should see it straight away.

## 2. Load estimate (1 million users)

### Assumptions

- 1,000,000 registered users, and **20%** use QuickNotes each day: **200,000 daily active users**.
- Each active user makes **20 reads** a day (opening the app, listing notes, opening a note, searching).
- Each active user makes **5 writes** a day (creating, editing or deleting notes).
- An average note (title, body and details such as dates) is about **1 KB**.
- Peak traffic is **5 times** the average. There are **86,400 seconds** in a day.

### Reads per second

- Reads per day = 200,000 × 20 = 4,000,000
- Average = 4,000,000 ÷ 86,400 ≈ 46.3, so about **46 reads per second**
- Peak = 46.3 × 5 ≈ **231 reads per second**

### Writes per second

- Writes per day = 200,000 × 5 = 1,000,000
- Average = 1,000,000 ÷ 86,400 ≈ 11.6, so about **12 writes per second**
- Peak = 11.6 × 5 ≈ **58 writes per second**

### Storage per year

- Assume (to be safe) every write creates a new 1 KB note: 1,000,000 × 1 KB = **1 GB per day**
- Per year = 1 GB × 365 = **365 GB per year**
- Allowing double for indexes and the read replica's copy, we should plan for about **0.75 TB per year**.

### What this means

QuickNotes is **read-heavy** (4 reads for every write), so we add a **cache** and a **read replica** to handle reads. The write load (58 per second at peak) and storage (well under 1 TB a year) are small enough for **one primary SQL database**, so we do not need to split the data across many databases yet.

## 3. Architecture diagram

```text
                    +------------------------------+
                    |  Client (browser or phone)   |
                    +------------------------------+
                       |            |            |
      1. find the      | 2. static  |            | 3. API calls (HTTPS)
         address       |    files   |            |    e.g. GET /v1/notes
                       v            v            v
                 +-----------+  +-------+  +------------------------------+
                 |    DNS    |  |  CDN  |  |        Load Balancer         |
                 +-----------+  +-------+  +------------------------------+
                                               |          |          |
                                               v          v          v
                                           +--------+ +--------+ +--------+
                                           |  App   | |  App   | |  App   |
                                           | Server | | Server | | Server |
                                           |   1    | |   2    | |   3    |
                                           +--------+ +--------+ +--------+
                                               |          |          |
              +--------------------+-----------+----------+---+------+-----------+
              |                    |                          |                  |
              v                    v                          v                  v
        +-----------+     +-----------------+         +----------------+   +-----------+
        |   Cache   |     |   Primary DB    | copies  |  Read Replica  |   |   Queue   |
        |  (Redis)  |     |  (all writes)   |-------->|  (most reads)  |   |  (jobs)   |
        +-----------+     +-----------------+  data   +----------------+   +-----------+
                                   ^                                             |
                                   |                                             v
                                   |                                       +------------+
                                   +---------------------------------------|   Worker   |
                                          saves job results                +------------+
```

- The **client** first asks **DNS** for the address of QuickNotes, then downloads the page files (`index.html`, `style.css`, `api.js`) from the **CDN**, and sends all API requests to the **load balancer**.
- App servers read from the **cache** first, then from the **read replica**. All writes go to the **primary database**.
- App servers put slow jobs on the **queue**, and the **worker** does them in the background.

## 4. Components and the problem each one solves

- **Client (browser or phone):** shows the notes and sends requests to the API, so users can reach their notes from any device.
- **DNS:** turns the name `api.quicknotes.example` into the address of our load balancer, so users never need to know server IP addresses.
- **CDN:** stores copies of the static files (HTML, CSS, JavaScript) close to users around the world, so the app loads fast and our servers do not have to send these files.
- **Load balancer:** spreads API requests across the app servers and stops sending traffic to any server that fails its health check, so no single server is overloaded or becomes a single point of failure.
- **App servers (three of them):** run the QuickNotes API code (log in, check tokens, validate notes, talk to the database), and because they keep no user data in memory we can add more when traffic grows.
- **Cache (Redis):** keeps each user's recent note list in memory, so most list requests are answered in a few milliseconds without touching the database.
- **Primary database:** the single source of truth that handles every write (create, edit, delete), so data stays consistent.
- **Read replica:** a constantly updated copy of the primary that answers read queries, so the heavy read traffic does not slow down writes, and it can take over if the primary fails.
- **Queue:** holds slow jobs (such as updating the search index or sending reminder emails), so the API can reply to the user immediately instead of waiting for them.
- **Worker:** takes jobs from the queue and does them in the background, and we can run more workers if the queue gets long.

## 5. Request flows

### GET /notes (list my notes)

1. The user opens QuickNotes. The browser asks **DNS** for the address of `api.quicknotes.example` and loads the page files from the **CDN**.
2. `api.js` sends `GET /v1/notes?page=1&limit=20` over HTTPS with the user's token in the `Authorization` header.
3. The **load balancer** sends the request to a healthy **app server**.
4. The app server checks the token. If it is missing or invalid, it replies **401 Unauthorized**.
5. The app server looks in the **cache** for this user's first page of notes.
6. **Cache hit:** the notes are returned straight from memory with **200 OK**.
7. **Cache miss:** the app server queries the **read replica** (using the `user_id, created_at` index), saves the result in the cache for 60 seconds, and returns **200 OK** with the notes as JSON.
8. The browser shows the notes using `textContent`.

### POST /notes (create a note)

1. The user fills in the form. The browser checks the title is present and at most 100 characters.
2. `api.js` sends `POST /v1/notes` with the JSON body `{ "title": ..., "body": ..., "tags": [...] }` and the token.
3. The **load balancer** sends the request to a healthy **app server**.
4. The app server checks the token (**401** if invalid) and validates the data again on the server (**400 Bad Request** if the title is missing or too long). We never trust the browser's checks alone.
5. The app server saves the note and its tags in the **primary database** in one **transaction**, so either everything is saved or nothing is.
6. The app server **deletes this user's cached note list**, so their next GET builds a fresh list that includes the new note.
7. The app server puts a job on the **queue**, for example "update the search index for note 42".
8. The app server replies **201 Created** with the new note as JSON. The browser adds it to the top of the list straight away.
9. In the background, the primary database copies the new note to the **read replica**, and the **worker** takes the job from the queue and updates the search index.

## 6. Trade-offs

1. **Cache: speed vs fresh data.** The cache makes most reads very fast and protects the database, but cached data can be out of date. We reduce this by deleting a user's cached list whenever they create, edit or delete a note, and by letting cached lists expire after 60 seconds.
2. **Read replica: more read capacity vs replication lag.** The replica takes most of the read load, but it can be a fraction of a second behind the primary, so a user might not see a note they just created. We handle this by adding the new note to the page straight from the POST response, and by reading a user's notes from the primary for a few seconds after they write.
3. **Queue and worker: fast responses vs delay and complexity.** Replying before the search index is updated keeps creating a note fast, but a new note may take a few seconds to appear in search results, and the queue and worker are extra parts to run and monitor.
4. **One primary SQL database: simplicity vs a write limit.** One primary keeps the data consistent and the design simple. It can only handle so many writes, but our peak of about 58 writes per second is far below that limit. If QuickNotes grows much bigger, we could later split users across several databases (sharding by `user_id`).

## 7. Avoiding single points of failure

A single point of failure is a part that takes the whole system down if it breaks. We avoid them like this:

- **DNS and CDN:** we use managed providers that run many servers in many locations, so one failure does not matter.
- **Load balancer:** we use a managed cloud load balancer that runs in more than one data centre (or a pair of load balancers, where the second takes over if the first fails).
- **App servers:** there are at least three, spread across two data centres. They keep no user data in memory (the login token travels with each request), so if one fails the load balancer simply sends its traffic to the others.
- **Cache:** Redis runs with a replica that takes over automatically. If the cache fails completely, the app servers read from the database instead: slower, but QuickNotes keeps working.
- **Primary database:** if it fails, the **read replica is promoted** to become the new primary. We also take daily backups, so data can be restored even after a serious mistake.
- **Queue and worker:** the queue is a managed service that keeps its jobs on disk, and we run at least two workers. A job stays in the queue until a worker finishes it, so if a worker crashes the job is retried, not lost.
- **Monitoring:** we watch error rates, response times and queue length, with alerts sent to the team, so problems are fixed before users notice.
