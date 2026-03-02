# 3D AI Avatar Backend

A production-ready, highly concurrent backend foundation for a 3D AI Avatar Web Application. Built with FastAPI, WebSockets, and Uvicorn.

## Features

- **FastAPI & Uvicorn**: High-performance asynchronous API
- **WebSocket Streaming**: Memory-efficient bi-directional connection manager
- **Structured Logging**: JSON-formatted logs suitable for aggregation
- **Lifespan Management**: Graceful startup and shutdown handling
- **Health Checks**: Endpoint for load balancer health monitoring
- **Environment Configuration**: Strict Pydantic-based configuration management

## Prerequisites

- Python 3.11+
- Virtualenv

## Setup Instructions

1. **Create and activate a virtual environment**:
   ```bash
   python3.11 -m venv venv
   # On Windows: venv\Scripts\activate
   # On Linux/macOS: source venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to match your target environment.

## Running Locally (Development)

To verify the installation and run a local development server, use:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Running in Production (DigitalOcean)

For a single DigitalOcean droplet with 8GB RAM, run the application using Uvicorn's performant settings:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 --proxy-headers
```

*Note on Workers*: Since WebSockets inherently keep connections persistent, tune the `--workers` argument based on the droplet's CPU layout. 4 workers are a good default for a moderately sized instance. We avoid reload flags in production.

### Production Environment Variables

Ensure `.env` contains secure and optimized variables:
```env
ENV=production
LOG_LEVEL=WARNING
MAX_CONNECTIONS=100
```

## Memory Safety Considerations

- This application utilizes async IO entirely to ensure scaling up to concurrent limits gracefully.
- `MAX_CONNECTIONS` explicitly caps WebSocket memory scaling to avoid unbounded memory growth.
- Active websocket sessions hold a minimal footprint integer timestamp, averting high memory overhead per connection.
- Strict graceful shutdown closes sockets to clear the operating system open-file resources safely.

## LLM Streaming Architecture

The LLM logic spans several bounded services avoiding monolithic routes:

- **Session Control**: Tracking active connections, enforcing strict token consumption metrics, and eliminating runaway usage through the `SessionManager`. 
- **Token Streaming Flow**: WebSockets transmit JSON structurally (`{type: "chat", message: "Hello"}`). A `StreamController` handles API isolation, mapping messages directly through the `GroqStreamingService`, and streaming out payload tokens (`{type: "token", content: "..."}`) sequentially.
- **Memory Safeguards**: The API client reuses the `httpx.AsyncClient` from the global FastAPI lifespan pool. Streaming prevents full text buffering. Dropping an active connection mid-stream inherently invokes an `asyncio.CancelledError` inside the controller, releasing HTTPX sockets automatically.
- **Cancellation Strategy**: Websocket disconnections inherently tear down task constraints without background leakages, guaranteeing predictable garbage collection matching 100% async Python capabilities.

## Real-Time Audio Streaming Architecture

The system features an advanced Text-to-Speech (TTS) pipeline powered by `edge-tts`. Operating completely asynchronously, it ensures 8GB cloud droplets can orchestrate numerous concurrent voice sessions natively:

1. **Token Processing**: Raw tokens produced by Groq are appended to the `AudioStreamBuffer`.
2. **Buffering**: To prevent microscopic and stuttering audio fragments, the buffer evaluates punctuation regex boundaries (e.g. `.` `?` `!`) or length capacity caps (`TTS_MAX_BUFFER_CHARS`).
3. **TTS Service**: Flushed logical text blocks stream sequentially into `EdgeTTSService` mapped cleanly via a context boundary.
4. **Chunking**: Transcoded PCM byte streams route into `AudioChunkEncoder`, splitting binary mass sizes consistently to 32KB payload limits natively supported by Websockets.
5. **Base64 WebSocket Packaging**: Fully formed `AudioChunkEncoder` output wraps into JSON as Base64. 

This layout inherently circumvents storing disk variables, loading full `.wav` files into finite RAM constraints, or executing multi-process delays.

### WebSocket Protocol Types
- `{ "type": "chat", "message": "query" }` - Inbound textual trigger.
- `{ "type": "ping" }` - Maintain lifecycle heartbeat.
- `{ "type": "token", "content": "xyz" }` - Outbound partial LLM token.
- `{ "type": "audio_chunk", "data": "base64==" }` - Outbound audio PCM chunk frame.
- `{ "type": "audio_done" }` - Signals backend finished yielding audio entirely.
- `{ "type": "done" }` - Signals backend finished text tokens.
- `{ "type": "error", "message": "..." }` - Pipeline halt exceptions cleanly communicated to interface.

## Phoneme Streaming Architecture 

Our architecture supports deterministic real-time visual lip sync through synchronized API interactions bridging Rhubarb pipelines without locking primary audio processes.

1. **Audio Re-capture**: Individual audio sequence bytes pulled securely generated by TTS are batched simultaneously towards `RhubarbLipSyncService`. Active audio streams broadcast seamlessly without halting waiting on parsing mechanics.
2. **Deterministic Isolation**: `os.tempfile` bounds chunked `.wav` fragments physically written entirely to RAM avoiding arbitrary OS disk clutter. Hard removal blocks fire `finally` inside the extraction context guaranteeing garbage collection even in event of unhandled parsing error or API termination limits.
3. **Concurrency Bottlenecks**: Creating parallel subprocesses via `subprocess.create_exec` invites immediate droplet crashes without checks. A centralized thread-safe `ProcessGuard` caps physical thread spans enforcing `LIPSYNC_MAX_CONCURRENT_PROCESSES` strictly leveraging `asyncio.Semaphore`.
4. **WebSocket Coordination**: Tasks queue using decoupled parallel limits (`asyncio.create_task()`). Final `phoneme_done` markers block structurally resolving inflight jobs ensuring full transcript synchronization prior to emitting completion vectors.
5. **Fail Safety**: If a client abandons the streaming tab natively (`WebSocketDisconnect` event), cancellation errors unroll upstream explicitly tearing down active instances killing lingering Rhubarb background executions.
