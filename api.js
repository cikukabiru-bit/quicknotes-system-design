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

    li.appendChild(title);
    li.appendChild(body);
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

// Show the empty state when the page first loads
renderNotes();