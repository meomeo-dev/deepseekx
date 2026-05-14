FROM rust:1.91-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    build-essential \
    ca-certificates \
    curl \
    git \
    jq \
    libssl-dev \
    nodejs \
    npm \
    pkg-config \
    python3 \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p \
  /bench/cache-benchmark \
  /bench/codex-home \
  /bench/dashboard-workspace \
  /bench/target/debug \
  /src

WORKDIR /bench

EXPOSE 5173

CMD ["sleep", "infinity"]
