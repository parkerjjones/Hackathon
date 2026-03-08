#!/usr/bin/env python3
"""
Mesh network visualizer — Waveshare 2" LCD (ST7789V, 240x320).
Single unified screen: GPS map (hero), message tape, LoRa status bar.
Cyberdeck HUD aesthetic. LoRa-only (no TCP).
"""

import spidev
import RPi.GPIO as GPIO
import time
import math
import random
import json
import os
import io
from PIL import Image, ImageDraw, ImageFont
from datetime import datetime

DC_PIN = 25
RST_PIN = 27
CS_PIN = 8
W = 240
H = 320
INBOX = "/tmp/lxmf_inbox.log"
GPS_FILE = "/tmp/gps.json"
REMOTE_GPS = "/tmp/remote_gps.json"
MAP_CACHE = "/tmp/map_tile.png"

MAP_Y0  = 0
MAP_Y1  = 210
TAPE_Y0 = 214
TAPE_Y1 = 284
BAR_Y0  = 288


class ST7789:
    def __init__(self):
        GPIO.setwarnings(False)
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(DC_PIN, GPIO.OUT)
        GPIO.setup(RST_PIN, GPIO.OUT)
        GPIO.setup(CS_PIN, GPIO.OUT)
        self.spi = spidev.SpiDev()
        self.spi.open(0, 0)
        self.spi.max_speed_hz = 62500000
        self.spi.mode = 0
        self._reset()
        self._hw()

    def _cmd(self, c):
        GPIO.output(DC_PIN, GPIO.LOW)
        GPIO.output(CS_PIN, GPIO.LOW)
        self.spi.writebytes([c])
        GPIO.output(CS_PIN, GPIO.HIGH)

    def _dat(self, d):
        GPIO.output(DC_PIN, GPIO.HIGH)
        GPIO.output(CS_PIN, GPIO.LOW)
        if isinstance(d, int):
            self.spi.writebytes([d])
        else:
            for i in range(0, len(d), 4096):
                self.spi.writebytes(d[i:i + 4096])
        GPIO.output(CS_PIN, GPIO.HIGH)

    def _reset(self):
        GPIO.output(RST_PIN, GPIO.HIGH)
        time.sleep(0.01)
        GPIO.output(RST_PIN, GPIO.LOW)
        time.sleep(0.01)
        GPIO.output(RST_PIN, GPIO.HIGH)
        time.sleep(0.12)

    def _hw(self):
        self._cmd(0x01); time.sleep(0.15)
        self._cmd(0x11); time.sleep(0.12)
        self._cmd(0x3A); self._dat(0x05)
        self._cmd(0xB2); self._dat([0x0C, 0x0C, 0x00, 0x33, 0x33])
        self._cmd(0xB7); self._dat(0x35)
        self._cmd(0xBB); self._dat(0x19)
        self._cmd(0xC0); self._dat(0x2C)
        self._cmd(0xC2); self._dat(0x01)
        self._cmd(0xC3); self._dat(0x12)
        self._cmd(0xC4); self._dat(0x20)
        self._cmd(0xC6); self._dat(0x0F)
        self._cmd(0xD0); self._dat([0xA4, 0xA1])
        self._cmd(0xE0); self._dat([0xD0, 0x04, 0x0D, 0x11, 0x13, 0x2B, 0x3F, 0x54, 0x4C, 0x18, 0x0D, 0x0B, 0x1F, 0x23])
        self._cmd(0xE1); self._dat([0xD0, 0x04, 0x0C, 0x11, 0x13, 0x2C, 0x3F, 0x44, 0x51, 0x2F, 0x1F, 0x1F, 0x20, 0x23])
        self._cmd(0x36); self._dat(0x00)
        self._cmd(0x21)
        self._cmd(0x29); time.sleep(0.05)

    def show(self, img):
        if img.size != (W, H):
            img = img.resize((W, H))
        px = img.convert("RGB").tobytes()
        buf = bytearray(W * H * 2)
        j = 0
        for i in range(0, len(px), 3):
            c = ((px[i] & 0xF8) << 8) | ((px[i+1] & 0xFC) << 3) | (px[i+2] >> 3)
            buf[j] = c >> 8
            buf[j+1] = c & 0xFF
            j += 2
        self._cmd(0x2A); self._dat([0x00, 0x00, 0x00, 0xEF])
        self._cmd(0x2B); self._dat([0x00, 0x00, 0x01, 0x3F])
        self._cmd(0x2C); self._dat(list(buf))

    def cleanup(self):
        self.spi.close()
        GPIO.cleanup()


try:
    import RNS
    HAS_RNS = True
except Exception:
    HAS_RNS = False

BK       = (0, 0, 0)
PHOS     = (0, 255, 140)
PHOS_DIM = (0, 100, 55)
PHOS_LO  = (0, 50, 28)
AMBER    = (255, 180, 0)
CYAN     = (0, 200, 255)
WHITE    = (200, 210, 200)
HUD_DIM  = (0, 35, 20)
HUD_MID  = (0, 70, 40)
LED_ON   = (0, 240, 80)
LED_OFF  = (50, 15, 10)

try:
    F14B = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 14)
    F12  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 12)
    F12B = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 12)
    F11  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 11)
    F10  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 10)
    F9   = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 9)
except Exception:
    try:
        F14B = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
        F12  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
        F12B = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 12)
        F11  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
        F10  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10)
        F9   = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 9)
    except Exception:
        F14B = F12 = F12B = F11 = F10 = F9 = ImageFont.load_default()


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def tw(d, s, f):
    try:
        return d.textlength(s, font=f)
    except Exception:
        return len(s) * 8


# ─── OSM tile helpers ───

def _latlon_to_tile(lat, lng, zoom):
    n = 2 ** zoom
    x_tile = (lng + 180.0) / 360.0 * n
    lat_rad = math.radians(lat)
    y_tile = (1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * n
    tx = int(x_tile)
    ty = int(y_tile)
    px = int((x_tile - tx) * 256)
    py = int((y_tile - ty) * 256)
    return tx, ty, px, py


def _phosphor_tint(img):
    grey = img.convert("L")
    r_ch = Image.new("L", img.size, 0)
    g_ch = grey.point(lambda p: min(255, int(p * 0.9)))
    b_ch = grey.point(lambda p: min(255, int(p * 0.45)))
    return Image.merge("RGB", (r_ch, g_ch, b_ch))


def fetch_map(lat, lng, zoom=16, w=W, h=210):
    try:
        import urllib.request
        tx, ty, off_x, off_y = _latlon_to_tile(lat, lng, zoom)
        tiles_x = 3
        tiles_y = 3
        canvas = Image.new("RGB", (tiles_x * 256, tiles_y * 256), (0, 0, 0))

        for dy in range(tiles_y):
            for dx in range(tiles_x):
                tile_x = tx - 1 + dx
                tile_y = ty - 1 + dy
                url = f"https://tile.openstreetmap.org/{zoom}/{tile_x}/{tile_y}.png"
                req = urllib.request.Request(url, headers={
                    "User-Agent": "PiMeshViz/1.0 (Reticulum cyberdeck)"
                })
                try:
                    resp = urllib.request.urlopen(req, timeout=8)
                    tile_img = Image.open(io.BytesIO(resp.read())).convert("RGB")
                    canvas.paste(tile_img, (dx * 256, dy * 256))
                except Exception:
                    pass

        center_px = 256 + off_x
        center_py = 256 + off_y
        left = max(0, center_px - w // 2)
        top = max(0, center_py - h // 2)
        right = min(tiles_x * 256, left + w)
        bottom = min(tiles_y * 256, top + h)
        crop = canvas.crop((left, top, right, bottom))
        if crop.size != (w, h):
            crop = crop.resize((w, h))
        result = _phosphor_tint(crop)
        result.save(MAP_CACHE)
        return result
    except Exception as e:
        print("map: " + str(e))
        return None


class Viz:
    def __init__(self):
        self.lcd = ST7789()
        self.rns = None
        self.rnode = {}
        self.frame = 0
        self.t0 = time.time()
        self.msgs = []
        self.inbox_sz = 0
        self.scroll_offset = 0.0
        self.last_time = time.time()

        self.lora_active = False
        self.lora_txb = 0
        self.lora_rxb = 0
        self.peer_count = 0

        self.gps_lat = None
        self.gps_lng = None
        self.gps_t = 0
        self.map_img = None
        self.map_lat = None
        self.map_lng = None
        self.map_fetch_t = 0

        self.gps_trail = []
        self.remote_nodes = {}

    def start_rns(self):
        if HAS_RNS:
            try:
                self.rns = RNS.Reticulum()
            except Exception as e:
                print("rns: " + str(e))

    def poll(self):
        if not self.rns:
            return
        try:
            s = self.rns.get_interface_stats()
            if not s:
                return

            peers = 0
            for iface in s.get("interfaces", []):
                itype = iface.get("type", "")
                status = iface.get("status", False)
                txb = iface.get("txb", 0) or 0
                rxb = iface.get("rxb", 0) or 0

                if "LocalServer" in itype or "LocalClient" in itype or "Auto" in itype:
                    continue
                if "RNode" in itype:
                    self.rnode = iface
                    self.lora_active = status
                    self.lora_txb = txb
                    self.lora_rxb = rxb
                elif "AutoInterfacePeer" in itype:
                    if status:
                        peers += 1
            self.peer_count = peers
        except Exception as e:
            print("poll: " + str(e))

        self._read_inbox()
        self._read_gps()
        self._read_remote_gps()

    def _read_remote_gps(self):
        try:
            if not os.path.exists(REMOTE_GPS):
                return
            with open(REMOTE_GPS, "r") as f:
                data = json.load(f)
            self.remote_nodes = {}
            for src, info in data.items():
                lat = info.get("lat")
                lng = info.get("lng")
                t = info.get("t", 0)
                if lat and lng and (time.time() - t) < 300:
                    self.remote_nodes[src] = {"lat": lat, "lng": lng, "t": t}
        except Exception:
            pass

    def _read_inbox(self):
        try:
            if not os.path.exists(INBOX):
                return
            sz = os.path.getsize(INBOX)
            if sz == self.inbox_sz:
                return
            self.inbox_sz = sz
            with open(INBOX, "r") as f:
                lines = f.readlines()
            self.msgs = []
            for line in lines:
                line = line.strip()
                if line:
                    try:
                        self.msgs.append(json.loads(line))
                    except Exception:
                        pass
            self.msgs = self.msgs[-20:]
        except Exception:
            pass

    def _read_gps(self):
        try:
            if not os.path.exists(GPS_FILE):
                return
            with open(GPS_FILE, "r") as f:
                g = json.load(f)
            lat = g.get("lat")
            lng = g.get("lng")
            if lat and lng and lat != 0 and lng != 0:
                self.gps_lat = lat
                self.gps_lng = lng
                self.gps_t = g.get("t", time.time())
                if not self.gps_trail or (abs(lat - self.gps_trail[-1][0]) > 0.00001 or abs(lng - self.gps_trail[-1][1]) > 0.00001):
                    self.gps_trail.append((lat, lng))
                    self.gps_trail = self.gps_trail[-50:]
        except Exception:
            pass

    def _wrap(self, d, text, font, max_w):
        words = text.split(" ")
        lines = []
        cur = ""
        for w in words:
            test = (cur + " " + w).strip()
            if tw(d, test, font) <= max_w:
                cur = test
            else:
                if cur:
                    lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines if lines else [""]

    def _hex_grid(self, d, x0, y0, x1, y1):
        spacing = 18
        row = 0
        y = y0
        while y < y1:
            offset = (spacing // 2) if row % 2 else 0
            x = x0 + offset
            while x < x1:
                d.point((x, y), fill=HUD_DIM)
                x += spacing
            y += int(spacing * 0.86)
            row += 1

    def _latlon_to_px(self, lat, lng, center_lat, center_lng, zoom, cx, cy):
        """Convert a lat/lng to pixel position relative to map center."""
        n = 2 ** zoom
        def to_merc(la, lo):
            x = (lo + 180.0) / 360.0 * n * 256
            lr = math.radians(la)
            y = (1.0 - math.log(math.tan(lr) + 1.0 / math.cos(lr)) / math.pi) / 2.0 * n * 256
            return x, y
        mx, my = to_merc(lat, lng)
        cmx, cmy = to_merc(center_lat, center_lng)
        return int(cx + (mx - cmx)), int(cy + (my - cmy))

    # ─── RENDER ───

    def render(self):
        now = time.time()
        dt = now - self.last_time
        self.last_time = now
        t = self.frame * 0.04

        img = Image.new("RGB", (W, H), BK)
        d = ImageDraw.Draw(img)
        map_h = MAP_Y1 - MAP_Y0
        has_gps = self.gps_lat is not None and self.gps_lng is not None

        # ─── MAP SECTION ───
        if has_gps:
            need_fetch = False
            if self.map_img is None:
                need_fetch = True
            elif self.map_lat is not None:
                dlat = abs(self.gps_lat - self.map_lat)
                dlng = abs(self.gps_lng - self.map_lng)
                if dlat > 0.0003 or dlng > 0.0003:
                    need_fetch = True
            if now - self.map_fetch_t < 45:
                need_fetch = False

            if need_fetch:
                tile = fetch_map(self.gps_lat, self.gps_lng, zoom=16, w=W, h=map_h)
                if tile:
                    self.map_img = tile
                    self.map_lat = self.gps_lat
                    self.map_lng = self.gps_lng
                    self.map_fetch_t = now
            elif self.map_img is None and os.path.exists(MAP_CACHE):
                try:
                    self.map_img = Image.open(MAP_CACHE).convert("RGB")
                except Exception:
                    pass

        if self.map_img:
            tile = self.map_img.resize((W, map_h))
            img.paste(tile, (0, MAP_Y0))
            d = ImageDraw.Draw(img)

            # scanline overlay
            for sy in range(MAP_Y0, MAP_Y1, 4):
                for sx in range(W):
                    px = img.getpixel((sx, sy))
                    img.putpixel((sx, sy), (int(px[0]*0.8), int(px[1]*0.8), int(px[2]*0.8)))

            cx, cy = W // 2, map_h // 2

            # position marker: pulsing crosshair
            if has_gps and self.map_lat:
                px, py = self._latlon_to_px(self.gps_lat, self.gps_lng,
                                            self.map_lat, self.map_lng, 16, cx, cy)
                ch = 10
                d.line([(px - ch, py), (px - 4, py)], fill=PHOS, width=2)
                d.line([(px + 4, py), (px + ch, py)], fill=PHOS, width=2)
                d.line([(px, py - ch), (px, py - 4)], fill=PHOS, width=2)
                d.line([(px, py + 4), (px, py + ch)], fill=PHOS, width=2)

                pr = int(6 + 3 * math.sin(t * 0.8))
                d.ellipse([(px-pr, py-pr), (px+pr, py+pr)], outline=PHOS, width=1)

                d.ellipse([(px-2, py-2), (px+2, py+2)], fill=PHOS)

            # remote nodes from other Heltecs
            if self.map_lat and self.remote_nodes:
                for src, info in self.remote_nodes.items():
                    rlat, rlng = info["lat"], info["lng"]
                    rx, ry = self._latlon_to_px(rlat, rlng,
                                                self.map_lat, self.map_lng, 16, cx, cy)
                    if 0 <= rx < W and 0 <= ry < map_h:
                        age = now - info.get("t", 0)
                        brightness = max(0.3, 1.0 - age / 300.0)
                        nc = mix(BK, AMBER, brightness)
                        d.ellipse([(rx-5, ry-5), (rx+5, ry+5)], fill=nc)
                        d.ellipse([(rx-8, ry-8), (rx+8, ry+8)], outline=mix(BK, AMBER, brightness * 0.4), width=1)
                        # pulsing outer ring
                        rpr = int(10 + 4 * math.sin(t * 0.6))
                        d.ellipse([(rx-rpr, ry-rpr), (rx+rpr, ry+rpr)],
                                  outline=mix(BK, AMBER, brightness * 0.2), width=1)
                        label = src[1:5] if len(src) > 4 else src[:4]
                        d.text((rx - tw(d, label, F9) / 2, ry + 12), label, fill=mix(BK, AMBER, brightness * 0.7), font=F9)

            # HUD corner brackets
            blen = 16
            bw = 2
            for ax, ay, dx, dy in [(4, 4, 1, 1), (W-5, 4, -1, 1), (4, map_h-5, 1, -1), (W-5, map_h-5, -1, -1)]:
                d.line([(ax, ay), (ax + blen * dx, ay)], fill=PHOS, width=bw)
                d.line([(ax, ay), (ax, ay + blen * dy)], fill=PHOS, width=bw)

            # coordinate readout - top left
            if has_gps:
                lat_s = "{:.5f}".format(self.gps_lat)
                lng_s = "{:.5f}".format(self.gps_lng)
                coord = lat_s + "  " + lng_s
                cw = int(tw(d, coord, F10)) + 8
                d.rectangle([(2, map_h - 18), (2 + cw, map_h - 4)], fill=BK)
                d.text((6, map_h - 17), coord, fill=PHOS, font=F10)

            # GPS status LED - top right
            if has_gps:
                age = now - self.gps_t
                if age < 10:
                    gc = LED_ON
                    gs = "LIVE"
                elif age < 60:
                    gc = AMBER
                    gs = str(int(age)) + "s"
                else:
                    gc = LED_OFF
                    gs = str(int(age // 60)) + "m"
                lbl_w = int(tw(d, gs, F10)) + 18
                d.rectangle([(W - 2 - lbl_w, map_h - 18), (W - 2, map_h - 4)], fill=BK)
                d.ellipse([(W - lbl_w, map_h - 15), (W - lbl_w + 8, map_h - 7)], fill=gc)
                d.text((W - lbl_w + 11, map_h - 17), gs, fill=PHOS_DIM, font=F10)

            # LoRa activity flash on map edges
            if self.lora_active:
                pulse = 0.15 + 0.1 * math.sin(t * 1.5)
                ec = mix(BK, PHOS, pulse)
                d.line([(0, 0), (W, 0)], fill=ec, width=1)
                d.line([(0, map_h - 1), (W, map_h - 1)], fill=ec, width=1)

        else:
            # no map: waiting state
            self._hex_grid(d, 0, MAP_Y0, W, MAP_Y1)
            cx, cy = W // 2, map_h // 2
            d.line([(cx - 40, cy), (cx - 6, cy)], fill=HUD_DIM, width=1)
            d.line([(cx + 6, cy), (cx + 40, cy)], fill=HUD_DIM, width=1)
            d.line([(cx, cy - 40), (cx, cy - 6)], fill=HUD_DIM, width=1)
            d.line([(cx, cy + 6), (cx, cy + 40)], fill=HUD_DIM, width=1)
            d.ellipse([(cx-20, cy-20), (cx+20, cy+20)], outline=HUD_DIM, width=1)

            if not has_gps:
                pc = mix(BK, PHOS_DIM, 0.3 + 0.2 * math.sin(t * 1.2))
                msg = "ACQUIRING GPS..."
                d.text((cx - tw(d, msg, F14B) / 2, cy + 30), msg, fill=pc, font=F14B)
                for i in range(3):
                    da = t * 0.5 + i * (math.tau / 3)
                    dr = 50 + 10 * math.sin(t * 0.3 + i)
                    dx = cx + int(dr * math.cos(da))
                    dy = cy + int(dr * math.sin(da))
                    d.ellipse([(dx-2, dy-2), (dx+2, dy+2)], fill=mix(BK, PHOS, 0.3))
            else:
                pc = mix(BK, AMBER, 0.4 + 0.3 * math.sin(t))
                d.text((cx - tw(d, "LOADING MAP...", F14B) / 2, cy + 30), "LOADING MAP...", fill=pc, font=F14B)

        d.line([(0, MAP_Y1 + 1), (W, MAP_Y1 + 1)], fill=HUD_DIM, width=1)

        # ─── MESSAGE TAPE ───
        tape_h = TAPE_Y1 - TAPE_Y0
        tape_img = Image.new("RGB", (W, tape_h), BK)
        td = ImageDraw.Draw(tape_img)

        if self.msgs:
            max_text_w = W - 20
            row_h = 15
            all_rows = []
            for m in self.msgs:
                ts = m.get("ts", "")
                body = m.get("msg", "")
                wrapped = self._wrap(td, body, F11, max_text_w)
                all_rows.append(("ts", ts))
                for wl in wrapped:
                    all_rows.append(("body", wl))
                all_rows.append(("gap", ""))

            total_h = len(all_rows) * row_h
            visible_h = tape_h - 2
            max_scroll = max(0, total_h - visible_h)
            if self.scroll_offset < max_scroll:
                self.scroll_offset = min(self.scroll_offset + 2.0, max_scroll)
            elif self.scroll_offset > max_scroll:
                self.scroll_offset = max_scroll

            y = 2 - int(self.scroll_offset)
            for kind, text in all_rows:
                sy = y
                if -row_h < sy < tape_h:
                    if kind == "ts":
                        td.polygon([(5, sy+2), (9, sy+6), (5, sy+10)], fill=PHOS)
                        td.text((13, sy), text, fill=PHOS_DIM, font=F10)
                    elif kind == "body":
                        td.text((13, sy), text, fill=WHITE, font=F11)
                y += row_h

            for fy in range(6):
                alpha = fy / 6.0
                for fx in range(W):
                    orig = tape_img.getpixel((fx, fy))
                    tape_img.putpixel((fx, fy), (int(orig[0]*alpha), int(orig[1]*alpha), int(orig[2]*alpha)))
        else:
            pc = mix(BK, PHOS_DIM, 0.3 + 0.2 * math.sin(t * 1.5))
            td.text((13, tape_h // 2 - 7), "AWAITING SIGNAL...", fill=pc, font=F11)

        img.paste(tape_img, (0, TAPE_Y0))
        d.line([(0, TAPE_Y1 + 1), (W, TAPE_Y1 + 1)], fill=HUD_DIM, width=1)

        # ─── STATUS BAR ───
        by = BAR_Y0

        led_c = LED_ON if self.lora_active else LED_OFF
        d.ellipse([(6, by+3), (16, by+13)], fill=led_c)
        d.text((20, by+2), "LORA", fill=PHOS_DIM if self.lora_active else HUD_MID, font=F12B)

        batt = self.rnode.get("battery_percent")
        d.rectangle([(72, by+4), (98, by+12)], outline=PHOS_DIM, width=1)
        d.rectangle([(98, by+6), (100, by+10)], fill=PHOS_DIM)
        if batt is not None:
            fw = int(24 * batt / 100)
            bc = LED_ON if batt > 25 else AMBER
            if fw > 0:
                d.rectangle([(74, by+6), (74+fw, by+10)], fill=bc)

        nf = self.rnode.get("noise_floor")
        if nf:
            d.text((106, by+2), str(nf) + "dB", fill=HUD_MID, font=F10)

        hms = datetime.now().strftime("%H:%M")
        d.text((W - 6 - tw(d, hms, F11), by+2), hms, fill=PHOS_DIM, font=F11)

        by2 = by + 16
        up = int(now - self.t0)
        uh, um, us = up // 3600, (up % 3600) // 60, up % 60
        d.text((6, by2), "UP {:d}:{:02d}:{:02d}".format(uh, um, us), fill=HUD_DIM, font=F10)

        txk = self.lora_txb / 1024
        rxk = self.lora_rxb / 1024
        traffic = "TX{:.0f}k RX{:.0f}k".format(txk, rxk)
        d.text((100, by2), traffic, fill=HUD_DIM, font=F10)

        freq = self.rnode.get("frequency")
        if freq:
            mhz = "{:.1f}".format(freq / 1000000)
        else:
            mhz = "915.0"
        d.text((W - 6 - tw(d, mhz, F10), by2), mhz, fill=HUD_DIM, font=F10)

        self.frame += 1
        return img

    def run(self):
        print("mesh viz v9 — gps map")
        self.start_rns()
        print("rns: " + ("connected" if self.rns else "unavailable"))
        lp = 0
        while True:
            try:
                now = time.time()
                if now - lp > 3:
                    self.poll()
                    lp = now
                self.lcd.show(self.render())
                time.sleep(0.08)
            except KeyboardInterrupt:
                print("\nbye")
                self.lcd.cleanup()
                break
            except Exception as e:
                print("err: " + str(e))
                import traceback
                traceback.print_exc()
                time.sleep(1)


if __name__ == "__main__":
    Viz().run()
