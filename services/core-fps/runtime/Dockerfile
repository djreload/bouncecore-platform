FROM debian:bookworm-slim

ARG CORE_FPS_RUNTIME_URL=https://github.com/cfoust/sour/releases/download/v0.2.5/sour_0.2.5_linux_amd64.tar.gz
ARG CORE_FPS_RUNTIME_SHA256=18efcf8cf73e66ade20eacdb8e6649c29de6722a6141fba094fffae46b3bc836
ARG CORE_FPS_SOURCE_REPOSITORY=https://github.com/djreload/core
ARG CORE_FPS_SOURCE_REF=2ed2b492d5491dfaf41fb883e6646c666e0f6035

LABEL org.opencontainers.image.source="${CORE_FPS_SOURCE_REPOSITORY}"
LABEL org.opencontainers.image.revision="${CORE_FPS_SOURCE_REF}"
LABEL uk.co.bouncecore.component="core-fps-runtime"

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/core

RUN curl --fail --location --retry 4 --retry-delay 2 "${CORE_FPS_RUNTIME_URL}" --output /tmp/core-runtime.tar.gz \
  && echo "${CORE_FPS_RUNTIME_SHA256}  /tmp/core-runtime.tar.gz" | sha256sum --check --strict \
  && tar -xzf /tmp/core-runtime.tar.gz -C /opt/core \
  && rm /tmp/core-runtime.tar.gz \
  && chmod 0755 /opt/core/sour

COPY core.yaml /opt/core/core.yaml

RUN groupadd --system --gid 10001 corefps \
  && useradd --system --uid 10001 --gid corefps --home-dir /var/cache/sour --shell /usr/sbin/nologin corefps \
  && mkdir -p /var/cache/sour \
  && chown -R corefps:corefps /var/cache/sour /opt/core

USER corefps

EXPOSE 1337

HEALTHCHECK --interval=15s --timeout=4s --retries=8 \
  CMD curl --fail --silent --show-error http://127.0.0.1:1337/ >/dev/null || exit 1

ENTRYPOINT ["/opt/core/sour"]
CMD ["serve", "--address", "0.0.0.0", "--port", "1337", "/opt/core/core.yaml"]
