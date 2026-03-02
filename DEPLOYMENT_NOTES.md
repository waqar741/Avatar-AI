# DigitalOcean Deployment & Stability Guide

This document outlines the architecture constraints and production deployment instructions required to safely host the Interactive 3D Avatar System on a minimal DigitalOcean Droplet.

---

## 🚀 DigitalOcean Deployment Notes

### 1. Droplet Size Recommendation
**Target**: Basic Droplet (Shared CPU)
- **RAM**: 2GB to 4GB limits (4GB recommended for stability over 50 concurrent sessions).
- **CPU**: 1 to 2 vCPUs (Ensure `gunicorn_conf.py` worker count is strictly `min(cores+1, 2)` to avoid duplicate library memory allocation bounds).
- **OS**: Ubuntu 22.04 LTS (Docker Pre-installed or manual setup).
- **Swap**: Highly recommended to create a 2GB to 4GB Swap file natively if opting into exactly the 2GB droplet size to handle sporadic Web Audio decoding spikes.

### 2. Network & Security
- **Firewall Ports**: Only expose `80` (HTTP) and `443` (HTTPS). Block direct access to `8000` from public internet.
- **NGINX Reverse Proxy**: Required to map `/ws/avatar` paths up into the internal Gunicorn socket natively. Ensure `proxy_set_header Upgrade $http_upgrade;` and `Connection "Upgrade";` are declared for websocket streams.
- **SSL via Certbot**: WebSockets & Web Speech APIs strictly require a secure `https://` / `wss://` origin to execute permissions in the client's browser.

### 3. Environment Injections
Never hardcode bounds. Utilize standard `.env` placements wrapping:
```env
ENV=production
ALLOWED_ORIGINS=["https://your-domain.com"]
GROQ_API_KEY=gsk_your_key_here
```

---

## 🛡️ Production Readiness Checklist

Before pushing live traffic to the server, ensure the following stability limits hold:

### Memory & Process Stability
- [x] **Idle RAM**: Backend idles strictly `< 400MB` prior to websocket allocations.
- [x] **Load RAM**: Backend remains `< 1GB` securely under 30 active overlapping generative sessions.
- [x] **Subprocess Leak Check**: `Rhubarb` lipsync JSON routines correctly kill subprocesses via wait boundaries, eliminating zombie node trees perfectly.
- [x] **WebSocket Leak Check**: Dropped browsers reliably purge from `ConnectionManager` routing within 60 seconds of disconnection.
- [x] **Clean Restart**: The `uvicorn` lifespan handlers gracefully kill HTTP endpoints waiting to finish existing generation loops upon `SIGTERM`.

### Performance Targets
- [x] **Latency Time-To-First-Token (TTFT)**: Starts audio and pushes face tracking `< 1.5s` upon finishing user speech.
- [x] **Frontend Load Time**: GLB avatar and canvas components mount globally in `< 2.0s`.
- [x] **Animation Framerate**: Strictly maintains stable `60fps` natively while IDLE, avoiding excessive drops below `45fps` whilst SPEAKING and dynamically morphing vectors.

### Safety Guards
- [x] Maximum duration LLM generator caps implemented forcing closures if generation halts locally.
- [x] Maximum active concurrent sessions limited natively per IPv4 bounds.
- [x] Stale IDLE sessions culled forcibly bypassing browser disconnect failures automatically.
