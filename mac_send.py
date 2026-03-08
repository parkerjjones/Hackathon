#!/usr/bin/env python3
"""Send LXMF messages from Mac to Pi over the mesh."""
import RNS
import LXMF
import time
import sys

PI_ADDR = "f12d097e7cad57176da98a52a4d2e3e7"

MESSAGES = [
    ("Mesh Test", "Hello from Mac Heltec!"),
    ("LoRa Link", "Packets flowing over 915MHz"),
    ("Reticulum", "Encrypted mesh is alive"),
]

RNS.loglevel = RNS.LOG_WARNING
r = RNS.Reticulum()
router = LXMF.LXMRouter(storagepath="/tmp/lxmf_mac")
my_ident = router.identity
router.register_delivery_identity(my_ident, display_name="MacNode")

my_dest = None
for key, dest in router.delivery_destinations.items():
    my_dest = dest
    break

print("Mac: " + my_dest.hash.hex()[:12])
dest_hash = bytes.fromhex(PI_ADDR)

RNS.Transport.request_path(dest_hash)
for i in range(20):
    time.sleep(1)
    if RNS.Transport.has_path(dest_hash):
        break

dest_ident = RNS.Identity.recall(dest_hash)
if not dest_ident:
    RNS.Transport.request_path(dest_hash)
    time.sleep(5)
    dest_ident = RNS.Identity.recall(dest_hash)

if not dest_ident:
    print("Cannot resolve Pi identity")
    sys.exit(1)

lxmf_dest = RNS.Destination(dest_ident, RNS.Destination.OUT, RNS.Destination.SINGLE, "lxmf", "delivery")

for title, body in MESSAGES:
    msg = LXMF.LXMessage(
        lxmf_dest, my_dest,
        body.encode("utf-8"),
        title=title.encode("utf-8"),
        desired_method=LXMF.LXMessage.DIRECT,
    )
    print("Sending: " + body)
    router.handle_outbound(msg)

    for j in range(30):
        time.sleep(1)
        if msg.state == LXMF.LXMessage.DELIVERED:
            print("  -> delivered")
            break
        elif msg.state == LXMF.LXMessage.FAILED:
            print("  -> failed")
            break
    else:
        print("  -> timeout")

    time.sleep(2)

print("Done.")
