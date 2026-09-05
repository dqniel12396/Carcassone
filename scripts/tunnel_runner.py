#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Carcassonne Cloudflare Tunnel Daemon & Telegram Notification Service
Starts a Cloudflare Quick Tunnel for http://localhost:3080 and notifies Telegram Bot
whenever the tunnel is started, restarted, or when the public URL changes.
"""

import os
import sys
import re
import time
import subprocess
import urllib.request
import urllib.parse
import json
import datetime

# Configuration
LOCAL_SERVICE_URL = "http://localhost:3080"
TELEGRAM_BOT_TOKEN = "8476427268:AAH-ioPFMzXERY0Peu0zxg5ej855SwzEMro"
TELEGRAM_CHAT_IDS = [
    "1325227524",       # DanSan
    "-5358243913"       # BOTS IBG
]

CLOUDFLARED_BIN = "/usr/local/bin/cloudflared"

def log(msg):
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{now}] [TunnelRunner] {msg}", flush=True)

def send_telegram_message(text):
    for chat_id in TELEGRAM_CHAT_IDS:
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": False
            }
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode('utf-8'))
                if result.get("ok"):
                    log(f"Telegram alert successfully delivered to chat {chat_id}")
                else:
                    log(f"Telegram delivery warning for chat {chat_id}: {result}")
        except Exception as e:
            log(f"Failed to send Telegram message to chat {chat_id}: {e}")

def notify_tunnel_online(public_url):
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    msg = (
        "🏰 <b>Carcassonne: War Room — Servidor Online</b>\n\n"
        f"🌐 <b>Enlace de Acceso Público:</b>\n"
        f"👉 <a href=\"{public_url}\">{public_url}</a>\n\n"
        "⚔️ <i>¡El reino medieval está listo para la batalla! Puedes ingresar desde PC, tablet o móvil para jugar en vivo.</i>\n"
        f"🕒 <b>Hora:</b> {now_str}"
    )
    send_telegram_message(msg)

def ensure_cloudflared():
    if os.path.exists(CLOUDFLARED_BIN) and os.access(CLOUDFLARED_BIN, os.X_OK):
        return CLOUDFLARED_BIN
    
    # Check if in PATH
    try:
        path = subprocess.check_output(["which", "cloudflared"]).decode().strip()
        if path:
            return path
    except Exception:
        pass

    log(f"cloudflared not found. Downloading linux amd64 binary to {CLOUDFLARED_BIN}...")
    download_url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
    try:
        urllib.request.urlretrieve(download_url, "/tmp/cloudflared")
        os.system(f"chmod +x /tmp/cloudflared && sudo mv /tmp/cloudflared {CLOUDFLARED_BIN}")
        log("cloudflared successfully installed!")
        return CLOUDFLARED_BIN
    except Exception as e:
        log(f"Error installing cloudflared: {e}")
        return "cloudflared"

def run_tunnel():
    bin_path = ensure_cloudflared()
    cmd = [bin_path, "tunnel", "--url", LOCAL_SERVICE_URL, "--no-autoupdate"]
    
    current_url = None
    url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

    while True:
        log(f"Starting cloudflared tunnel for {LOCAL_SERVICE_URL}...")
        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )

            for line in process.stdout:
                line_str = line.strip()
                if line_str:
                    # Look for tunnel URL
                    match = url_pattern.search(line_str)
                    if match:
                        found_url = match.group(0)
                        if found_url != current_url:
                            current_url = found_url
                            log(f"🚀 New Cloudflare Tunnel URL established: {current_url}")
                            notify_tunnel_online(current_url)

                    # Log connection status / errors
                    if "INF" in line_str or "ERR" in line_str or "Registered tunnel connection" in line_str:
                        if not any(x in line_str for x in ["metrics", "quic: full"]):
                            log(f"[cloudflared] {line_str}")

            process.wait()
            log(f"cloudflared exited with code {process.returncode}. Restarting in 5 seconds...")
        except Exception as e:
            log(f"Error in tunnel process: {e}")
        
        time.sleep(5)

if __name__ == "__main__":
    log("Initializing Carcassonne Cloudflare Tunnel Daemon...")
    run_tunnel()
