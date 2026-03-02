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
