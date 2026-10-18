// The practice API. JSONPlaceholder's "posts" play the part of our notes.
const API_URL = "https://jsonplaceholder.typicode.com/posts";

// Select the elements
const loadBtn = document.querySelector("#load-btn");
const statusText = document.querySelector("#status");
const noteForm = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitBtn = document.querySelector("#submit-btn");
const notesList = document.querySelector("#notes-list");

// The notes currently shown on the page
let notes = [];

// Show a message in #status. type is "loading", "success" or "error"
function showStatus(message, type) {
  statusText.textContent = message;
  statusText.className = type;
}

// Reusable request function: calls fetch, checks response.ok and throws on errors
async function request(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error("Request failed with status " + response.status);
  }

  // 204 No Content has no body to read
  let data = null;
  if (response.status !== 204) {
    data = await response.json();
  }

  return { status: response.status, data: data };
}

// GET: load 10 notes
async function getNotes() {
  return request(API_URL + "?_limit=10");
}

// POST: create a note
async function createNote(title, body) {
  return request(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title, body: body, userId: 1 })
  });
}

// DELETE: remove a note
async function removeNote(id) {
  return request(API_URL + "/" + id, { method: "DELETE" });
}

// Draw the notes array on the page
function renderNotes() {
  notesList.textContent = "";

  if (notes.length === 0) {
    const empty = document.createElement("li");
    empty.classList.add("empty");
    empty.textContent = "No notes to show yet. Click \"Load notes\" or add a new note.";
    notesList.appendChild(empty);
    return;
  }

  for (const note of notes) {
    const li = document.createElement("li");
    li.classList.add("note");

    const title = document.createElement("h3");
    title.textContent = note.title;

    const body = document.createElement("p");
    body.textContent = note.body;

        const deleteBtn = document.createElement("button");
    deleteBtn.classList.add("delete-btn");
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      handleDelete(note, deleteBtn);
    });

    li.appendChild(title);
    li.appendChild(body);
    li.appendChild(deleteBtn);
    notesList.appendChild(li);
  }
}

// Task 1: load notes with GET
async function loadNotes() {
  showStatus("Loading notes...", "loading");
  loadBtn.disabled = true;

  try {
    const result = await getNotes();
    notes = result.data;
    renderNotes();
    showStatus("Loaded " + notes.length + " notes from the server.", "success");
  } catch (error) {
    console.error(error);
    showStatus("Sorry, we could not load the notes. Please check your connection and try again.", "error");
  } finally {
    loadBtn.disabled = false;
  }
}

loadBtn.addEventListener("click", loadNotes);

// Task 2: create a note with POST
noteForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (title === "") {
    showStatus("Please enter a title for your note.", "error");
    return;
  }

  if (title.length > 100) {
    showStatus("The title must be 100 characters or fewer.", "error");
    return;
  }

  showStatus("Saving note...", "loading");
  submitBtn.disabled = true;

  try {
    const result = await createNote(title, body);
    const newNote = result.data;

    // Mark notes we created, so Delete knows they are not really on the server
    newNote.isLocal = true;

    notes.unshift(newNote);
    renderNotes();
    showStatus("Note created (status " + result.status + ", id " + newNote.id + ").", "success");
    noteForm.reset();
  } catch (error) {
    console.error(error);
    showStatus("Sorry, we could not save your note. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

// Task 3: delete a note with DELETE
//
// JSONPlaceholder is a fake API: it answers a POST with id 101 but does not
// really save the note, so a created note does not exist on the server.
// - Notes we created ourselves (isLocal): there is nothing to delete on the
//   server, so we skip the request and just remove the note from the page.
// We remove the exact note object (not "every note with this id"), because
// several created notes can all have the same id 101.
async function handleDelete(note, button) {
  if (note.isLocal) {
    notes = notes.filter(function (item) {
      return item !== note;
    });
    renderNotes();
    showStatus("Note removed.", "success");
    return;
  }

  showStatus("Deleting note...", "loading");
  button.disabled = true;

  try {
    const result = await removeNote(note.id);
    notes = notes.filter(function (item) {
      return item !== note;
    });
    renderNotes();
    showStatus("Note deleted (status " + result.status + ").", "success");
  } catch (error) {
    console.error(error);
    showStatus("Sorry, we could not delete that note. Please try again.", "error");
  } finally {
    button.disabled = false;
  }
}

// Show the empty state when the page first loads
renderNotes();