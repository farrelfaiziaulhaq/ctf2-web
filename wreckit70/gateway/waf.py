"""Decoy WAF: blocks the obvious stuff. Does nothing to stop the real
vulnerability, which is at the protocol level, not the payload level."""
import re

PATTERNS = [
    re.compile(rb"(?i)\bor\s+1\s*=\s*1\b"),
    re.compile(rb"(?i)union\s+select"),
    re.compile(rb"(?i)<script"),
    re.compile(rb"(?i)drop\s+table"),
]

def looks_malicious(body: bytes) -> bool:
    return any(p.search(body) for p in PATTERNS)
