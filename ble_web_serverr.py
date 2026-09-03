"""BLE-to-Web bridge for CarePosture - Team DMT.

Connects to the CAREBOT AI BLE chip with the exact same logic as
CarePosture_Pi4_GUI.py, then re-broadcasts every parsed JSON result to all
connected browser tabs over a WebSocket, so a normal web page (no BLE stack in
the browser) can display live posture data.

Run:
    python3 ble_web_server.py

Then open http://<this-machine-ip>:8000/ in a browser.
"""
from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path

from aiohttp import web, WSMsgType
from bleak import BleakClient, BleakScanner
from bleak.exc import BleakError

APP_DIR = Path(__file__).resolve().parent
GUI_DIR = APP_DIR.parent
STATIC_DIR = APP_DIR / "static"
# Shared with CarePosture_Pi4_GUI.py so both apps always target the same chip.
BLE_CONFIG_PATH = GUI_DIR / "ble_config.json"

BLE_AI_RESULT_UUID = "12345678-1234-5678-1234-56789abc0001"
BLE_SCAN_TIMEOUT = 4
BLE_CONNECT_TIMEOUT = 20
BLE_RECONNECT_DELAY = 5

HTTP_HOST = os.environ.get("CAREPOSTURE_WEB_HOST", "0.0.0.0")
HTTP_PORT = int(os.environ.get("CAREPOSTURE_WEB_PORT", "8000"))


def _load_ble_config() -> dict:
    """Read the MAC/name pair shared with the desktop GUI, then env var overrides."""
    config = {}
    if BLE_CONFIG_PATH.exists():
        try:
            config = json.loads(BLE_CONFIG_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            config = {}
    config["address"] = os.environ.get("CAREPOSTURE_BLE_ADDRESS", config.get("address"))
    config["name"] = os.environ.get("CAREPOSTURE_BLE_NAME", config.get("name"))
    return config


_ble_config = _load_ble_config()
BLE_TARGET_NAME = _ble_config.get("name") or "CAREBOT AI"
BLE_DEVICE_ADDRESS = _ble_config.get("address") or "54:DC:E9:32:1B:16"


class BleWebBridge:
    """Owns the BLE link and fans out every message to all open browser tabs."""

    def __init__(self):
        self.clients: set[web.WebSocketResponse] = set()
        self.rx_buffer = bytearray()
        self.stop_requested = asyncio.Event()

    async def register(self, ws: web.WebSocketResponse):
        self.clients.add(ws)
        await self.send_to(ws, {"type": "status", "message": "WEB CLIENT CONNECTED"})

    def unregister(self, ws: web.WebSocketResponse):
        self.clients.discard(ws)

    @staticmethod
    async def send_to(ws: web.WebSocketResponse, payload: dict):
        if not ws.closed:
            await ws.send_str(json.dumps(payload, ensure_ascii=False))

    async def broadcast(self, payload: dict):
        for ws in list(self.clients):
            await self.send_to(ws, payload)

    async def report_status(self, message: str):
        print(f"[BLE] {message}")
        await self.broadcast({"type": "status", "message": message})

    async def find_device(self) -> str | None:
        # Confirm the peripheral is actually advertising before spending the
        # full connect timeout on a device that is off or out of range.
        if BLE_DEVICE_ADDRESS:
            device = await BleakScanner.find_device_by_address(
                BLE_DEVICE_ADDRESS, timeout=BLE_SCAN_TIMEOUT
            )
            if device is not None:
                return device.address
            device = await BleakScanner.find_device_by_name(
                BLE_TARGET_NAME, timeout=BLE_SCAN_TIMEOUT
            )
            return device.address if device else None
        device = await BleakScanner.find_device_by_name(
            BLE_TARGET_NAME, timeout=BLE_SCAN_TIMEOUT
        )
        return device.address if device else None

    def on_disconnect(self, _client):
        asyncio.create_task(self.report_status("BLE DISCONNECTED - RECONNECTING..."))

    def on_notification(self, _sender, data: bytearray):
        """Reassemble fragmented BLE notifications into whole JSON objects."""
        self.rx_buffer.extend(data)
        while True:
            start = self.rx_buffer.find(b"{")
            if start < 0:
                return
            if start:
                del self.rx_buffer[:start]
            try:
                text = self.rx_buffer.decode("utf-8")
                result, index = json.JSONDecoder().raw_decode(text)
            except (UnicodeDecodeError, json.JSONDecodeError):
                return
            consumed = len(text[:index].encode("utf-8"))
            del self.rx_buffer[:consumed]
            if isinstance(result, dict):
                print(f"[AI] {json.dumps(result, ensure_ascii=False)}")
                asyncio.create_task(self.broadcast({"type": "posture", "data": result}))

    async def connect_and_listen(self, address: str):
        await self.report_status(f"CONNECTING: {address}")
        async with BleakClient(
            address, timeout=BLE_CONNECT_TIMEOUT, disconnected_callback=self.on_disconnect
        ) as client:
            if not client.is_connected:
                await self.report_status("BLE CONNECTION FAILED")
                return
            characteristic = next(
                (
                    item
                    for service in client.services
                    for item in service.characteristics
                    if item.uuid.lower() == BLE_AI_RESULT_UUID.lower()
                ),
                None,
            )
            if characteristic is None:
                await self.report_status("AI RESULT UUID NOT FOUND")
                return
            if "notify" not in characteristic.properties:
                await self.report_status("AI RESULT DOES NOT SUPPORT NOTIFY")
                return
            await client.start_notify(BLE_AI_RESULT_UUID, self.on_notification)
            await self.report_status("BLE CONNECTED - AI NOTIFY ENABLED")
            while client.is_connected and not self.stop_requested.is_set():
                await asyncio.sleep(1)

    async def run_forever(self):
        while not self.stop_requested.is_set():
            self.rx_buffer.clear()
            await self.report_status("BLE SCANNING...")
            try:
                address = await self.find_device()
                if address is None:
                    await self.report_status("KHONG THAY CAREBOT AI - KIEM TRA NGUON/KHOANG CACH")
                else:
                    await self.connect_and_listen(address)
            except asyncio.CancelledError:
                raise
            except asyncio.TimeoutError:
                await self.report_status("BLE CONNECT TIMEOUT")
            except BleakError as exc:
                await self.report_status(f"BLE ERROR: {exc}")
            except Exception as exc:
                await self.report_status(f"BLE UNEXPECTED ERROR: {exc}")
            if not self.stop_requested.is_set():
                await asyncio.sleep(BLE_RECONNECT_DELAY)


bridge = BleWebBridge()


async def websocket_handler(request: web.Request) -> web.WebSocketResponse:
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    await bridge.register(ws)
    try:
        async for msg in ws:
            if msg.type == WSMsgType.ERROR:
                break
    finally:
        bridge.unregister(ws)
    return ws


async def start_ble_task(app: web.Application):
    app["ble_task"] = asyncio.create_task(bridge.run_forever())


async def stop_ble_task(app: web.Application):
    bridge.stop_requested.set()
    app["ble_task"].cancel()


def build_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/ws", websocket_handler)
    app.router.add_static("/", STATIC_DIR, show_index=True)
    app.on_startup.append(start_ble_task)
    app.on_cleanup.append(stop_ble_task)
    return app


if __name__ == "__main__":
    web.run_app(build_app(), host=HTTP_HOST, port=HTTP_PORT)
