FROM golang:1.24-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/core-fps-telemetry .

FROM alpine:3.21

RUN apk add --no-cache ca-certificates

COPY --from=build /out/core-fps-telemetry /usr/local/bin/core-fps-telemetry

USER 10001:10001

EXPOSE 1338

HEALTHCHECK --interval=15s --timeout=4s --retries=8 \
  CMD wget -qO- http://127.0.0.1:1338/healthz | grep -q '^ok$'

ENTRYPOINT ["/usr/local/bin/core-fps-telemetry"]
