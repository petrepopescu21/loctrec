FROM golang:1.23-alpine AS builder

WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /tracker ./cmd/tracker

FROM alpine:3.19

RUN apk --no-cache add ca-certificates wget
COPY --from=builder /tracker /tracker

EXPOSE 8083
CMD ["/tracker"]
