"""Gunicorn production configuration file."""
import multiprocessing

# Worker Class & Socket bindings
bind = "0.0.0.0:8000"
worker_class = "uvicorn.workers.UvicornWorker"

# Worker bounds explicitly clamped avoiding memory explosions on 2GB-4GB droplets
cores = multiprocessing.cpu_count()
workers_per_core = 1
default_web_concurrency = workers_per_core * cores + 1
# Maximum 2 workers explicitly preventing duplicated memory allocation pools (LLM models/libraries overhead)
workers = min(default_web_concurrency, 2)

# Timeouts & Request handling
timeout = 120
graceful_timeout = 120
keepalive = 5

# Logging mechanics
loglevel = "info"
accesslog = "-"
errorlog = "-"

# Avoid temp file leakage and worker sync stalls (Needs Linux /dev/shm natively or tmpfs)
# Defaults safely but is a recommendation for Docker execution explicitly:
worker_tmp_dir = "/dev/shm"
