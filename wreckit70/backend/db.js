"use strict";
const Database = require("better-sqlite3");
const db = new Database(":memory:");

db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'
  );
  CREATE TABLE tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

function createUser(username, password, role = "user") {
  return db
    .prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)")
    .run(username, password, role).lastInsertRowid;
}

function getUserByCredentials(username, password) {
  return db
    .prepare("SELECT * FROM users WHERE username = ? AND password = ?")
    .get(username, password);
}

function createTicket(userId, subject, body) {
  return db
    .prepare("INSERT INTO tickets (user_id, subject, body) VALUES (?, ?, ?)")
    .run(userId, subject, body).lastInsertRowid;
}

function listTicketsForUser(userId) {
  return db.prepare("SELECT * FROM tickets WHERE user_id = ? ORDER BY id DESC").all(userId);
}

function listAllTickets() {
  return db
    .prepare(
      "SELECT tickets.*, users.username FROM tickets JOIN users ON tickets.user_id = users.id ORDER BY tickets.id DESC"
    )
    .all();
}

module.exports = { createUser, getUserByCredentials, createTicket, listTicketsForUser, listAllTickets };
