"use strict";
const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const db = require("./db");
const { escapeHtml, page } = require("./views");

const PORT = Number(process.env.PORT || 8080);
const FLAG_PART1 = process.env.FLAG_PART1 || "WRECKIT70{dev_flag_part1}";
const ADMIN_TICKET_BODY = process.env.ADMIN_SEED_FLAG_PART2 || "WRECKIT70{dev_flag_part2}";

const app = express();
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
  })
);

// Seed an admin account with a ticket containing flag part 2. The password
// is read from an env var (rather than generated randomly here) so the bot
// container can be handed the exact same credentials to log in as this real
// admin account instead of self-registering a role-less one (Task 7).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(16).toString("hex");
const adminId = db.createUser("admin", ADMIN_PASSWORD, "admin");
db.createTicket(adminId, "Internal: rotate gateway pool credentials", ADMIN_TICKET_BODY);

app.get("/", (req, res) => {
  res.send(
    page(
      "Relay Helpdesk",
      `<h1>Relay Helpdesk</h1><p><a href="/register">Register</a> | <a href="/login">Login</a></p>`
    )
  );
});

app.get("/register", (req, res) => {
  res.send(
    page(
      "Register",
      `<form method="post" action="/register">
        <input name="username" placeholder="username" required>
        <input name="password" type="password" placeholder="password" required>
        <button type="submit">Register</button></form>`
    )
  );
});

app.post("/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("missing fields");
  try {
    db.createUser(username, password);
  } catch {
    return res.status(409).send("username taken");
  }
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.send(
    page(
      "Login",
      `<form method="post" action="/login">
        <input name="username" placeholder="username" required>
        <input name="password" type="password" placeholder="password" required>
        <button type="submit">Login</button></form>`
    )
  );
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.getUserByCredentials(username, password);
  if (!user) return res.status(401).send("invalid credentials");
  req.session.userId = user.id;
  req.session.role = user.role;
  res.redirect("/tickets");
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).send("login required");
  next();
}

app.get("/tickets", requireAuth, (req, res) => {
  const tickets = db.listTicketsForUser(req.session.userId);
  const rows = tickets
    .map((t) => `<li><strong>${escapeHtml(t.subject)}</strong>: ${escapeHtml(t.body)}</li>`)
    .join("");
  res.send(
    page(
      "Your Tickets",
      `<h1>Your Tickets</h1><ul>${rows}</ul>
       <form method="post" action="/tickets">
         <input name="subject" placeholder="subject" required>
         <textarea name="body" placeholder="describe your issue"></textarea>
         <button type="submit">Submit</button></form>`
    )
  );
});

app.post("/tickets", requireAuth, (req, res) => {
  const { subject, body } = req.body;
  if (!subject || !body) return res.status(400).send("missing fields");
  db.createTicket(req.session.userId, subject, body);
  res.redirect("/tickets");
});

// Intentionally unauthenticated: the backend assumes only the gateway's
// health checks reach this path directly, and the gateway blocks it for
// everyone else. That assumption is exactly what request smuggling defeats.
app.get("/internal/flag-part1", (req, res) => {
  res.type("text/plain").send(FLAG_PART1);
});

app.get("/admin/tickets", (req, res) => {
  if (req.session.role !== "admin") return res.status(403).send("admins only");
  const tickets = db.listAllTickets();
  const rows = tickets
    .map((t) => `<li>${escapeHtml(t.username)} — ${escapeHtml(t.subject)}: ${escapeHtml(t.body)}</li>`)
    .join("");
  res.send(page("All Tickets", `<h1>All Tickets</h1><ul>${rows}</ul>`));
});

// Decoy: looks like a way in, isn't. No credentials for this exist anywhere
// in the app or its data; it's a dead end for anyone trying to brute-force
// their way to /admin/tickets instead of finding the real vector.
app.get("/admin", (req, res) => {
  res.send(page("Admin Login", `<h1>Staff Login</h1><p>Restricted. Contact IT.</p>`));
});

const http = require("http");
const server = http.createServer({ insecureHTTPParser: true }, app);
// The gateway's BackendPool (Task 4) holds a small number of these TCP
// connections open for the entire process lifetime, reused across many
// unrelated client requests. Node's default keepAliveTimeout (5000ms)
// would have this server proactively close a pooled connection the moment
// it sits idle for 5s between requests -- and the gateway's pool releases
// connections back into rotation in a `finally` with no health check, so a
// closed-but-still-pooled connection causes every future request that
// acquires it to fail with a broken pipe. Disabling the timeout (0 means
// disabled, per Node's http docs) matches the pool's actual lifetime
// contract: these sockets are meant to live as long as the process does.
server.keepAliveTimeout = 0;
server.listen(PORT, "0.0.0.0", () => console.log(`backend listening on :${PORT}`));
