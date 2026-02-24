.PHONY: help build run test clean dev docker-up docker-down docker-logs

help:
	@echo "Available commands:"
	@echo "  make build      - Build the backend server"
	@echo "  make run        - Run the backend server"
	@echo "  make test       - Run tests"
	@echo "  make clean      - Clean build artifacts"
	@echo "  make dev        - Run development servers (backend + frontend)"
	@echo "  make docker-up  - Start Docker services"
	@echo "  make docker-down- Stop Docker services"
	@echo "  make docker-logs- Show Docker logs"

build:
	cd backend && go build -o bin/server ./cmd/server

run:
	cd backend && go run ./cmd/server/main.go

test:
	cd backend && go test -v ./...

clean:
	rm -rf backend/bin/*
	rm -rf frontend/dist

dev:
	@echo "Starting development servers..."
	@make -j2 dev-backend dev-frontend

dev-backend:
	cd backend && go run ./cmd/server/main.go

dev-frontend:
	cd frontend && npm run dev

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f
