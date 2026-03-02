FROM python:3.11-slim

# Install core utilities and media bindings
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    unzip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Pull Rhubarb Linux Binary into path directly
RUN wget https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.13.0/Rhubarb-Lip-Sync-1.13.0-Linux.zip \
    && unzip Rhubarb-Lip-Sync-1.13.0-Linux.zip \
    && mv Rhubarb-Lip-Sync-1.13.0-Linux/rhubarb /usr/local/bin/ \
    && chmod +x /usr/local/bin/rhubarb \
    && rm -rf Rhubarb-Lip-Sync-1.13.0-Linux*

# Isolate execution boundary 
RUN useradd -m -U appuser
WORKDIR /app

# Separate layer for dependency caching strictly
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Migrate source code explicitly avoiding root leaks
COPY . .
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Fire production Gunicorn configuration
CMD ["gunicorn", "-c", "gunicorn_conf.py", "app.main:app"]
