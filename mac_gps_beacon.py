#!/usr/bin/env python3
"""
GPS beacon — reads GPS from the local Heltec (via /tmp/gps.json written by
the patched RNodeInterface) and sends coordinates to the Pi over LXMF.
Falls back to Mac's own GPS if Heltec GPS unavailable.
"""
import RNS
import LXMF
import time
import json
import sys
import os

PI_ADDR = "1cf245565cb9e859fdce270c6b0880c3"
GPS_FILE = "/tmp/gps.json"
BEACON_INTERVAL = 30

RNS.loglevel = RNS.LOG_WARNING
r = RNS.Reticulum()
router = LXMF.LXMRouter(storagepath="/tmp/lxmf_mac_beacon")
my_ident = router.identity
router.register_delivery_identity(my_ident, display_name="MacBeacon")

my_dest = None
for key, dest in router.delivery_destinations.items():
    my_dest = dest
    break

print("Mac beacon: " + my_dest.hash.hex()[:12])
print("Target Pi:  " + PI_ADDR[:12])
dest_hash = bytes.fromhex(PI_ADDR)


def resolve_pi():
    RNS.Transport.request_path(dest_hash)
    for i in range(30):
        time.sleep(1)
        if RNS.Transport.has_path(dest_hash):
            break
    ident = RNS.Identity.recall(dest_hash)
    if not ident:
        RNS.Transport.request_path(dest_hash)
        time.sleep(5)
        ident = RNS.Identity.recall(dest_hash)
    return ident


def read_gps():
    try:
        if os.path.exists(GPS_FILE):
            with open(GPS_FILE) as f:
                g = json.load(f)
            lat = g.get("lat")
            lng = g.get("lng")
            t = g.get("t", 0)
            if lat and lng and lat != 0 and lng != 0 and (time.time() - t) < 120:
                return {"lat": lat, "lng": lng}
    except Exception:
        pass
    return None


print("Resolving Pi...")
pi_ident = resolve_pi()
if pi_ident:
    print("Pi resolved!")
else:
    print("Pi not found yet, will retry...")

print("Beacon active. Interval: {}s".format(BEACON_INTERVAL))

while True:
    try:
        gps = read_gps()
        if not gps:
            print("  no local gps, skipping")
            time.sleep(BEACON_INTERVAL)
            continue

        if not pi_ident:
            pi_ident = resolve_pi()
            if not pi_ident:
                print("  pi unreachable, retrying...")
                time.sleep(BEACON_INTERVAL)
                continue

        lxmf_dest = RNS.Destination(pi_ident, RNS.Destination.OUT,
                                     RNS.Destination.SINGLE, "lxmf", "delivery")

        body = json.dumps(gps)
        msg = LXMF.LXMessage(
            lxmf_dest, my_dest,
            body.encode("utf-8"),
            title=b"GPS",
            desired_method=LXMF.LXMessage.DIRECT,
        )
        router.handle_outbound(msg)
        print("  sent: {:.5f}, {:.5f}".format(gps["lat"], gps["lng"]))

        for j in range(20):
            time.sleep(1)
            if msg.state == LXMF.LXMessage.DELIVERED:
                print("  -> delivered")
                break
            elif msg.state == LXMF.LXMessage.FAILED:
                print("  -> failed")
                break

        time.sleep(BEACON_INTERVAL)

    except KeyboardInterrupt:
        print("\nBeacon stopped.")
        break
    except Exception as e:
        print("err: " + str(e))
        time.sleep(BEACON_INTERVAL)
