# Kysona M600 V2 protocol notes

The M600 V2 is built on a Compx reference design (mouse MCU CX52850E, receiver
CX52650N, PixArt PAW3395 sensor). Its protocol is the same one documented by
[m916proui](https://github.com/dongkid/m916proui/blob/main/SPEC.md) for the
Redragon G49/M916 Pro, with the Kysona-specific differences listed here.
Everything below was verified against a real M600 V2 over the 2.4 GHz receiver.

## USB IDs

| Device | VID:PID |
|---|---|
| Mouse (wired) | `3554:F57D` |
| Receiver | `3554:F5D5` (also listed by the vendor driver: `F57C`, `F57E`, `F512`) |

## Transport

- HID interface 1, usage page **`0xFF02`** usage `0x0002` (Redragon uses `0xFF04`;
  on the Kysona `0xFF04` is an unrelated 7-byte feature report).
- Report ID `0x08`, 16-byte output reports for requests, 16-byte input reports for responses.
- Packet: `[cmd, 0, addrHi, addrLo, len, payload[10], checksum]`.
- Checksum: report ID + all 16 bytes sum to `0x55` (mod 256). Same for responses.
- Requests are answered by an input report echoing `cmd`. Unsolicited `0x0A`
  status reports can arrive at any time and must be skipped.

## Commands used

| Cmd | Name | Notes |
|---|---|---|
| `0x02` | PC driver status | payload `[1]`; heartbeat that wakes the RF link |
| `0x03` | Device online | payload `[1]`; response payload[0] = 1 when mouse is connected |
| `0x04` | Battery | response payload `[level %, charging, mV hi, mV lo]` |
| `0x07` | Write flash | ≤ 10 bytes per request; read back to verify |
| `0x08` | Read flash | ≤ 10 bytes per request |
| `0x0E` | Get current config | response payload[0] = active profile |
| `0x0F` | Set current config | payload `[profile & 1]`; re-applies settings after writes |
| `0x16` / `0x17` | Set / get long-range mode | |

Battery voltage curve (mV at 0%, 5%, … 100%), from the vendor driver:
`3050 3420 3480 3540 3600 3660 3720 3760 3800 3840 3880 3920 3940 3960 3980 4000 4020 4040 4060 4080 4110`.

## Flash layout (0x0000–0x1AFF)

Single-value registers are 2 bytes: `[value, 0x55 - value]`.
Records are 4 bytes: `[b0, b1, b2, 0x55 - (b0 + b1 + b2)]`.

| Addr | Size | Field | Values |
|---|---|---|---|
| `0x00` | reg | Polling rate | `1` 1000 Hz, `2` 500, `4` 250, `8` 125 |
| `0x02` | reg | DPI stage count | 1–8 (6 by default) |
| `0x04` | reg | Active DPI stage | 0-based |
| `0x0A` | reg | Lift-off distance | `1` 1 mm, `2` 2 mm (differs from Redragon) |
| `0x0C` | 8 × rec | DPI stages | `[x, y, ex]`, see below |
| `0x2C` | 8 × rec | DPI stage colours | `[r, g, b]` |
| `0x4C`–`0x5F` | | Unused by the Kysona driver | left untouched |
| `0x60` | 16 × rec | Button bindings | `[class, p1, p2]`, see m916proui SPEC |
| `0xA9` | reg | Key debounce | milliseconds |
| `0xAB` | reg | Motion sync | 0/1 |
| `0xAF` | reg | Angle snapping | 0/1 |
| `0xB1` | reg | Ripple control | 0/1 |
| `0xB5` | reg | "Peak performance" | 0/1 |
| `0xB9` | reg | Sensor mode | `0` LP, `1` HP |
| `0x0100` | 16 × 32 | Shortcut slots | |
| `0x0300` | 16 × 384 | Macro slots | |

Button slots on the M600 V2: 0 left, 1 right, 2 middle, 3 back, 4 forward,
5 DPI button, 8 bottom polling-rate button.

DPI encoding (50-DPI steps, 50–26 000): `raw = dpi / 50 - 1`; `x = y = raw & 0xFF`;
for `raw > 0xFF`, `hi = raw >> 8` and `ex = (hi << 2) | (hi << 6)`.

Unknown registers still to identify: `0xA7`, `0xAD`, `0xB3`, `0xB7`, `0xBB`, `0xBD`
(likely sleep / peak-performance timers).
