#!/usr/bin/env python3
"""Send a single LXMF message over the Reticulum mesh.

Usage: python3 send_lxmf.py <dest_hex> <title> <body>

Exits 0 on success, 1 on failure. Prints JSON result to stdout.
"""
import RNS
import LXMF
import sys
import json
import time

RNS.loglevel = RNS.LOG_CRITICAL

if len(sys.argv) < 4:
    print(json.dumps({"ok": False, "error": "Usage: send_lxmf.py <dest_hex> <title> <body>"}))
    sys.exit(1)

dest_hex = sys.argv[1]
title = sys.argv[2]
body = sys.argv[3]

try:
    r = RNS.Reticulum()
    router = LXMF.LXMRouter(storagepath="/tmp/lxmf_mac")
    ident = router.identity
    router.register_delivery_identity(ident, display_name="MacNode")

    my_dest = None
    for _key, d in router.delivery_destinations.items():
        my_dest = d
        break

    if not my_dest:
        print(json.dumps({"ok": False, "error": "No local LXMF destination"}))
        sys.exit(1)

    dest_hash = bytes.fromhex(dest_hex)

    RNS.Transport.request_path(dest_hash)
    for _ in range(15):
        time.sleep(1)
        if RNS.Transport.has_path(dest_hash):
            break

    dest_ident = RNS.Identity.recall(dest_hash)
    if not dest_ident:
        RNS.Transport.request_path(dest_hash)
        time.sleep(5)
        dest_ident = RNS.Identity.recall(dest_hash)

    if not dest_ident:
        print(json.dumps({"ok": False, "error": "Cannot resolve destination identity"}))
        sys.exit(1)

    lxmf_dest = RNS.Destination(
        dest_ident, RNS.Destination.OUT,
        RNS.Destination.SINGLE, "lxmf", "delivery"
    )

    msg = LXMF.LXMessage(
        lxmf_dest, my_dest,
        body.encode("utf-8"),
        title=title.encode("utf-8"),
        desired_method=LXMF.LXMessage.DIRECT,
    )
    router.handle_outbound(msg)

    for _ in range(30):
        time.sleep(1)
        if msg.state == LXMF.LXMessage.DELIVERED:
            print(json.dumps({"ok": True, "state": "delivered"}))
            sys.exit(0)
        elif msg.state == LXMF.LXMessage.FAILED:
            print(json.dumps({"ok": False, "error": "delivery failed"}))
            sys.exit(1)

    print(json.dumps({"ok": False, "error": "delivery timeout"}))
    sys.exit(1)

except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
    sys.exit(1)
