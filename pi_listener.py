#!/usr/bin/env python3
"""LXMF listener — logs received messages to /tmp/lxmf_inbox.log"""
import RNS
import LXMF
import time
import json
import sys
import os

REMOTE_GPS_FILE = "/tmp/remote_gps.json"

def _update_remote_gps(src, lat, lng):
    try:
        data = {}
        if os.path.exists(REMOTE_GPS_FILE):
            with open(REMOTE_GPS_FILE) as f:
                data = json.load(f)
        data[src] = {"lat": lat, "lng": lng, "t": time.time()}
        with open(REMOTE_GPS_FILE, "w") as f:
            json.dump(data, f)
    except Exception:
        pass


def msg_received(message):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    src = RNS.prettyhexrep(message.source_hash)
    title = message.title.decode("utf-8") if message.title else ""
    content = message.content.decode("utf-8") if message.content else ""

    if title == "GPS":
        try:
            gps = json.loads(content)
            lat = gps.get("lat")
            lng = gps.get("lng")
            if lat and lng:
                _update_remote_gps(src, lat, lng)
                sys.stdout.write("GPS from {}: {},{}\n".format(src[:12], lat, lng))
                sys.stdout.flush()
                return
        except Exception:
            pass

    entry = {"ts": ts, "from": src, "title": title, "msg": content}
    line = json.dumps(entry)
    sys.stdout.write(line + "\n")
    sys.stdout.flush()
    with open("/tmp/lxmf_inbox.log", "a") as f:
        f.write(line + "\n")

r = RNS.Reticulum()
router = LXMF.LXMRouter(storagepath="/tmp/lxmf_pi")
ident = router.identity
lxmf_dest = router.register_delivery_identity(ident, display_name="PiNode")
router.register_delivery_callback(msg_received)

for key, dest in router.delivery_destinations.items():
    addr = dest.hash.hex()
    sys.stdout.write("Pi LXMF address: " + addr + "\n")
    sys.stdout.flush()
    with open("/tmp/lxmf_address.txt", "w") as f:
        f.write(addr + "\n")
    break

while True:
    time.sleep(1)
