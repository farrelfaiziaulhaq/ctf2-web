#!/usr/bin/env python3
"""Build raw AMQP 0-9-1 frames that publish a message to the worker queue.

The admin "connector-test" endpoint opens a raw TCP socket to RabbitMQ and
writes the segments we give it (base64). So we hand-craft the AMQP handshake
plus a Basic.Publish carrying our serialized PHP payload to `preview.render`.

Usage:
    python3 build_amqp.py <payload_b64> [queue] > frames.json

Then paste the array into `segments_b64` in payload.js.
"""
import base64
import json
import struct
import sys


def frame(ftype: int, channel: int, payload: bytes) -> bytes:
    return struct.pack(">BHI", ftype, channel, len(payload)) + payload + b"\xce"


def shortstr(s: str) -> bytes:
    b = s.encode()
    return bytes([len(b)]) + b


def longstr(b: bytes) -> bytes:
    return struct.pack(">I", len(b)) + b


def empty_table() -> bytes:
    return struct.pack(">I", 0)


def method(channel: int, class_id: int, method_id: int, args: bytes = b"") -> bytes:
    return frame(1, channel, struct.pack(">HH", class_id, method_id) + args)


def build(payload_b64: str, queue: str = "preview.render",
          user: str = "produser", password: str = "Password123", vhost: str = "/"):
    body = base64.b64decode(payload_b64)

    segments = [b"AMQP\x00\x00\x09\x01"]  # protocol header

    # Connection.Start-Ok (10,11)
    start_ok = empty_table() + shortstr("PLAIN") + longstr(b"\x00" + user.encode() + b"\x00" + password.encode()) + shortstr("en_US")
    segments.append(method(0, 10, 11, start_ok))

    # Connection.Tune-Ok (10,31): channel-max, frame-max, heartbeat
    segments.append(method(0, 10, 31, struct.pack(">HLH", 2047, 131072, 0)))

    # Connection.Open (10,40)
    segments.append(method(0, 10, 40, shortstr(vhost) + shortstr("") + b"\x00"))

    # Channel.Open (20,10)
    segments.append(method(1, 20, 10, shortstr("")))

    # Basic.Publish (60,40): ticket, exchange, routing-key, mandatory|immediate
    segments.append(method(1, 60, 40, struct.pack(">H", 0) + shortstr("") + shortstr(queue) + b"\x00"))

    # Content Header (type 2): class 60, weight 0, body size, property flags 0
    segments.append(frame(2, 1, struct.pack(">HHQH", 60, 0, len(body), 0)))

    # Content Body (type 3)
    segments.append(frame(3, 1, body))

    return [base64.b64encode(s).decode() for s in segments]


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    print(json.dumps(build(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "preview.render")))
