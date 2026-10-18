# QuickNotes Data Model

This document describes how QuickNotes stores its data. It has four tables: **users**, **notes**, **tags** and **note_tags**. The SQL below is written for SQLite (as used on Day 6). In PostgreSQL the same design works, with `SERIAL` or `GENERATED ... AS IDENTITY` for the ids.

## Entities

### users

| Column        | Type         | Key         | Notes                                              |
| ------------- | ------------ | ----------- | -------------------------------------------------- |
| id            | INTEGER      | Primary key | Created by the database                            |
| name          | VARCHAR(100) |             | Required                                           |
| email         | VARCHAR(255) |             | Required, unique (one account per email)           |
| password_hash | VARCHAR(255) |             | Required. We store a hash, never the real password |
| created_at    | TIMESTAMP    |             | Set automatically                                  |

### notes

| Column     | Type         | Key                    | Notes                                 |
| ---------- | ------------ | ---------------------- | ------------------------------------- |
| id         | INTEGER      | Primary key            | Created by the database               |
| user_id    | INTEGER      | Foreign key → users.id | Required. The owner of the note       |
| title      | VARCHAR(100) |                        | Required, 1 to 100 characters         |
| body       | TEXT         |                        | Optional                              |
| created_at | TIMESTAMP    |                        | Set automatically                     |
| updated_at | TIMESTAMP    |                        | Changed every time the note is edited |

### tags

| Column  | Type        | Key                    | Notes                                                               |
| ------- | ----------- | ---------------------- | ------------------------------------------------------------------- |
| id      | INTEGER     | Primary key            | Created by the database                                             |
| user_id | INTEGER     | Foreign key → users.id | Required. Each user has their own tags                              |
| name    | VARCHAR(50) |                        | Required. Unique for each user (a user cannot have two "work" tags) |

### note_tags (join table)

| Column  | Type    | Key                                             | Notes    |
| ------- | ------- | ----------------------------------------------- | -------- |
| note_id | INTEGER | Foreign key → notes.id, part of the primary key | Required |
| tag_id  | INTEGER | Foreign key → tags.id, part of the primary key  | Required |

The primary key is the **pair** `(note_id, tag_id)`, so the same tag cannot be added to the same note twice.

## Relationships

- **users → notes is one-to-many:** one user can write many notes, but each note belongs to exactly one user (`notes.user_id`).
- **users → tags is one-to-many:** one user can create many tags, but each tag belongs to one user (`tags.user_id`).
- **notes ↔ tags is many-to-many:** one note can have many tags (for example "work" and "urgent"), and one tag can be on many notes. A single column cannot hold a list, so the **note_tags** join table stores one row for each note–tag pair. In other words, notes → note_tags is one-to-many and tags → note_tags is one-to-many, and together they make the many-to-many link.

```text
users 1 ──── * notes 1 ──── * note_tags * ──── 1 tags * ──── 1 users
```

## CREATE TABLE statements

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title VARCHAR(100) NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  body TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name VARCHAR(50) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
  note_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

`ON DELETE CASCADE` means that if a user is deleted, their notes and tags are deleted too, and if a note is deleted, its rows in `note_tags` are removed. This stops "orphan" rows that point to something that no longer exists.

## Sample data (to try the queries)

```sql
INSERT INTO users (name, email, password_hash) VALUES
  ('Wanjiku Kamau', 'wanjiku@example.com', 'hashed-password-1'),
  ('Otieno Odhiambo', 'otieno@example.com', 'hashed-password-2');

INSERT INTO notes (user_id, title, body) VALUES
  (1, 'Buy groceries', 'Milk, bread and sukuma wiki'),
  (1, 'Finish the report', 'Send it to the team by Friday'),
  (1, 'Study for the quiz', 'Caching and CDNs'),
  (2, 'Call the bank', NULL);

INSERT INTO tags (user_id, name) VALUES
  (1, 'personal'),
  (1, 'work'),
  (1, 'urgent');

INSERT INTO note_tags (note_id, tag_id) VALUES
  (1, 1),
  (2, 2),
  (2, 3),
  (3, 1);
```

## Example queries

**1. All of one user's notes, newest first (the `GET /notes` endpoint):**

```sql
SELECT id, title, created_at
FROM notes
WHERE user_id = 1
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

**2. Each of a user's notes with its tags (JOIN through the join table):**

```sql
SELECT notes.title, tags.name AS tag
FROM notes
JOIN note_tags ON note_tags.note_id = notes.id
JOIN tags ON tags.id = note_tags.tag_id
WHERE notes.user_id = 1
ORDER BY notes.title;
```

**3. All of a user's notes with the tag "work" (the `GET /notes?tag=work` filter):**

```sql
SELECT notes.id, notes.title
FROM notes
JOIN note_tags ON note_tags.note_id = notes.id
JOIN tags ON tags.id = note_tags.tag_id
WHERE notes.user_id = 1 AND tags.name = 'work';
```

**4. How many notes each tag is used on (including tags that are not used yet):**

```sql
SELECT tags.name, COUNT(note_tags.note_id) AS number_of_notes
FROM tags
LEFT JOIN note_tags ON note_tags.tag_id = tags.id
WHERE tags.user_id = 1
GROUP BY tags.id, tags.name;
```

**5. Search a user's notes (the `GET /notes?search=milk` filter):**

```sql
SELECT id, title
FROM notes
WHERE user_id = 1
  AND (title LIKE '%milk%' OR body LIKE '%milk%');
```

## Indexes

```sql
CREATE INDEX idx_notes_user_created ON notes (user_id, created_at);
CREATE INDEX idx_note_tags_tag ON note_tags (tag_id);
```

- **`idx_notes_user_created`:** listing a user's notes newest first (query 1) is the most common request in the whole app, because it runs every time someone opens QuickNotes. With 1 million users the `notes` table will hold many millions of rows. Without this index the database would have to scan the whole table to find one user's notes. With it, the database jumps straight to that user's notes, already in date order.
- **`idx_note_tags_tag`:** the primary key `(note_id, tag_id)` already makes "tags for a note" fast, but not "notes for a tag" (query 3). This index makes filtering by tag fast too.

The trade-off is that every index makes writes slightly slower and uses extra storage, so we only add indexes for queries we run often.

## SQL or NoSQL?

We chose **SQL** (a relational database such as PostgreSQL). QuickNotes data has a clear, fixed structure and important **relationships**: users own notes and tags, and notes and tags are linked many-to-many. SQL handles this naturally with foreign keys, a join table and `JOIN` queries, and its constraints (`NOT NULL`, `UNIQUE`, `CHECK`, foreign keys) protect the data from mistakes such as a note without an owner or a duplicate tag. Transactions also let us save a note and its tags together, so we never end up with only half of the change saved. A NoSQL document database could store each note with its tags inside it, but then renaming a tag would mean updating every note that uses it, and the database would not enforce the relationships for us. O
