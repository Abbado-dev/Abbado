.PHONY: dev dev-backend dev-frontend build clean test reset

# Run backend and frontend in parallel for development.
dev:
	@make -j2 dev-backend dev-frontend

dev-backend:
	cd backend && go run ./cmd/abbado

dev-frontend:
	cd frontend && npm run dev

# Build the single binary with embedded frontend.
build:
	./build.sh

test:
	cd backend && go test ./...

reset:
	./reset.sh

clean:
	rm -rf backend/abbado frontend/dist
