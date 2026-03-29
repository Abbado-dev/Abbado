package database

import "database/sql"

// TestDB wraps a *sql.DB for use in tests.
type TestDB struct {
	DB *sql.DB
}
