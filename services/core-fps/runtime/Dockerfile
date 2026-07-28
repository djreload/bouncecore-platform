FROM debian:bookworm-slim AS runtime-release

ARG CORE_FPS_RUNTIME_URL=https://github.com/cfoust/sour/releases/download/v0.2.5/sour_0.2.5_linux_amd64.tar.gz
ARG CORE_FPS_RUNTIME_SHA256=18efcf8cf73e66ade20eacdb8e6649c29de6722a6141fba094fffae46b3bc836

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl libenet7 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/core

RUN curl --fail --location --retry 4 --retry-delay 2 "${CORE_FPS_RUNTIME_URL}" --output /tmp/core-runtime.tar.gz \
  && echo "${CORE_FPS_RUNTIME_SHA256}  /tmp/core-runtime.tar.gz" | sha256sum --check --strict \
  && tar -xzf /tmp/core-runtime.tar.gz -C /opt/core \
  && rm /tmp/core-runtime.tar.gz \
  && chmod 0755 /opt/core/sour

RUN set -eux; \
  mkdir -p /tmp/core-game; \
  ./sour serve --address 127.0.0.1 --port 1337 >/tmp/sour-release.log 2>&1 & \
  release_pid=$!; \
  trap 'kill "${release_pid}" 2>/dev/null || true' EXIT; \
  ready=0; \
  for attempt in $(seq 1 60); do \
    if curl --fail --silent --show-error http://127.0.0.1:1337/game/api.js --output /tmp/core-game/api.js; then \
      ready=1; \
      break; \
    fi; \
    sleep 1; \
  done; \
  if [ "${ready}" -ne 1 ]; then \
    cat /tmp/sour-release.log; \
    exit 1; \
  fi; \
  curl --fail --silent --show-error http://127.0.0.1:1337/game/sauerbraten.js --output /tmp/core-game/sauerbraten.js; \
  curl --fail --silent --show-error http://127.0.0.1:1337/game/sauerbraten.wasm --output /tmp/core-game/sauerbraten.wasm; \
  test -s /tmp/core-game/api.js; \
  test -s /tmp/core-game/sauerbraten.js; \
  test -s /tmp/core-game/sauerbraten.wasm; \
  kill "${release_pid}"; \
  wait "${release_pid}" || true; \
  trap - EXIT

FROM golang:1.22-bookworm AS builder

ARG CORE_FPS_SOURCE_REPOSITORY=https://github.com/djreload/core
ARG CORE_FPS_SOURCE_REF=2ed2b492d5491dfaf41fb883e6646c666e0f6035

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential ca-certificates git git-lfs libenet-dev nodejs npm swig zlib1g-dev \
  && npm install --global yarn@1.22.22 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /src

RUN git clone "${CORE_FPS_SOURCE_REPOSITORY}" . \
  && git checkout --detach "${CORE_FPS_SOURCE_REF}" \
  && git lfs install --local \
  && git lfs pull

COPY solo-bot.patch /tmp/solo-bot.patch
COPY index.html /tmp/core-index.html

RUN git apply --check /tmp/solo-bot.patch \
  && git apply /tmp/solo-bot.patch \
  && go test -vet=off ./pkg/gameserver ./pkg/gameserver/relay \
  && cd client \
  && yarn install --frozen-lockfile --non-interactive \
  && yarn parcel build --target package \
  && cp /tmp/core-index.html /src/pkg/server/static/site/index.html

COPY --from=runtime-release /tmp/core-game /src/pkg/server/static/site/game

RUN CGO_ENABLED=1 go build -trimpath -o /out/sour ./cmd/sour

FROM runtime-release

ARG CORE_FPS_SOURCE_REPOSITORY=https://github.com/djreload/core
ARG CORE_FPS_SOURCE_REF=2ed2b492d5491dfaf41fb883e6646c666e0f6035

LABEL org.opencontainers.image.source="${CORE_FPS_SOURCE_REPOSITORY}"
LABEL org.opencontainers.image.revision="${CORE_FPS_SOURCE_REF}"
LABEL uk.co.bouncecore.component="core-fps-runtime"

COPY --from=builder /out/sour /opt/core/sour
COPY core.yaml /opt/core/core.yaml
COPY brand_flags.py /tmp/brand_flags.py

RUN apt-get update \
  && apt-get install -y --no-install-recommends fonts-dejavu-core python3-cbor2 python3-pil \
  && python3 /tmp/brand_flags.py \
  && apt-get purge -y --auto-remove fonts-dejavu-core python3-cbor2 python3-pil \
  && rm -rf /var/lib/apt/lists/* /tmp/brand_flags.py

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
