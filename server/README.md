# Minsaar Node.js API Service (`minsaar-api`)

Core backend API for Minsaar, built with Node.js 20, Express, TypeScript, Prisma ORM, and PostgreSQL 16.

## Architecture

Strict multi-layer architecture:
`routes -> middleware -> controllers -> services -> repositories`

- **Controllers**: Handle HTTP requests, status codes, and input/output formatting.
- **Services**: Contain business logic, rule evaluations, and energy calculations.
- **Repositories**: Encapsulate all database interaction via Prisma.
- **Validators**: Zod schemas for request validation.
- **Utils**: Custom error hierarchy, energy formulas, time manipulation.

## Database & Persistence

- **Database**: PostgreSQL 16
- **Migrations**: Handled via `prisma migrate deploy`
- **Volume**: Named persistent Docker volume `minsaar_postgres_data` prevents data loss across `docker compose down` and restarts.

### Database Commands

```bash
# Apply migrations
npm run db:migrate

# Seed development/demo data
npm run db:seed

# Generate Prisma Client
npm run db:generate
```

### Backup and Restore

```bash
# Backup database to a file
docker exec -t minsaar-db pg_dump -U postgres minsaar > minsaar_backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
cat minsaar_backup.sql | docker exec -i minsaar-db psql -U postgres minsaar
```

## Default Seeded Credentials

- **Admin User**: `admin@campus.edu` / `password123` (Role: `ADMIN`)
- **Viewer User**: `viewer@campus.edu` / `password123` (Role: `VIEWER`)
- **Device API Key**: `minsaar-device-secret-key-2026`

## Testing

```bash
# Run unit & integration tests
npm test
```
