package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"

	"github.com/raznak/abbado/internal/database"
	"github.com/raznak/abbado/internal/server"
)

// version is set at build time via -ldflags.
var version = "dev"

func dataDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		log.Fatalf("Failed to get home directory: %v", err)
	}
	if version == "dev" {
		return filepath.Join(home, ".abbado-dev")
	}
	return filepath.Join(home, ".abbado")
}

func pidFile() string { return filepath.Join(dataDir(), "abbado.pid") }
func logFile() string { return filepath.Join(dataDir(), "abbado.log") }

func main() {
	cmd := ""
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}

	switch cmd {
	case "version":
		fmt.Println("abbado", version)
	case "start":
		cmdStart()
	case "stop":
		cmdStop()
	case "status":
		cmdStatus()
	case "logs":
		cmdLogs()
	case "serve":
		// Internal: runs the actual server (called by start in background).
		serve()
	default:
		// No args or unknown → run server in foreground.
		serve()
	}
}

func cmdStart() {
	// Check if already running.
	if pid := readPID(); pid > 0 {
		if processAlive(pid) {
			fmt.Printf("Abbado is already running (pid %d)\n", pid)
			return
		}
		// Stale pid file.
		os.Remove(pidFile())
	}

	dir := dataDir()
	os.MkdirAll(dir, 0755)

	// Open log file.
	lf, err := os.OpenFile(logFile(), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		log.Fatalf("Failed to open log file: %v", err)
	}

	// Re-exec self with "serve" in background.
	exe, err := os.Executable()
	if err != nil {
		log.Fatalf("Failed to get executable path: %v", err)
	}

	proc := exec.Command(exe, "serve")
	proc.Stdout = lf
	proc.Stderr = lf
	proc.Env = os.Environ()
	proc.SysProcAttr = &syscall.SysProcAttr{Setsid: true}

	if err := proc.Start(); err != nil {
		log.Fatalf("Failed to start: %v", err)
	}

	// Write PID file.
	os.WriteFile(pidFile(), []byte(strconv.Itoa(proc.Process.Pid)), 0644)
	lf.Close()

	port := os.Getenv("ABBADO_PORT")
	if port == "" {
		port = "7777"
	}

	fmt.Printf("Abbado started (pid %d)\n", proc.Process.Pid)
	fmt.Printf("  http://localhost:%s\n", port)
	fmt.Printf("  Logs: %s\n", logFile())
}

func cmdStop() {
	pid := readPID()
	if pid <= 0 {
		fmt.Println("Abbado is not running")
		return
	}

	if !processAlive(pid) {
		os.Remove(pidFile())
		fmt.Println("Abbado is not running (stale pid removed)")
		return
	}

	// Send SIGTERM for graceful shutdown.
	proc, err := os.FindProcess(pid)
	if err != nil {
		log.Fatalf("Failed to find process: %v", err)
	}
	proc.Signal(syscall.SIGTERM)

	os.Remove(pidFile())
	fmt.Printf("Abbado stopped (pid %d)\n", pid)
}

func cmdStatus() {
	pid := readPID()
	if pid <= 0 || !processAlive(pid) {
		fmt.Println("Abbado is not running")
		if pid > 0 {
			os.Remove(pidFile())
		}
		return
	}

	port := os.Getenv("ABBADO_PORT")
	if port == "" {
		port = "7777"
	}

	fmt.Printf("Abbado is running (pid %d)\n", pid)
	fmt.Printf("  http://localhost:%s\n", port)
	fmt.Printf("  Logs: %s\n", logFile())
}

func cmdLogs() {
	path := logFile()
	if _, err := os.Stat(path); err != nil {
		fmt.Println("No logs found")
		return
	}

	// Default: tail -f
	follow := true
	lines := "50"
	for _, arg := range os.Args[2:] {
		if arg == "--no-follow" || arg == "-n" {
			follow = false
		}
	}

	args := []string{"-n", lines}
	if follow {
		args = append(args, "-f")
	}
	args = append(args, path)

	tail := exec.Command("tail", args...)
	tail.Stdout = os.Stdout
	tail.Stderr = os.Stderr
	tail.Run()
}

func serve() {
	port := os.Getenv("ABBADO_PORT")
	if port == "" {
		port = "7777"
	}

	dbPath := os.Getenv("ABBADO_DB")
	if dbPath == "" {
		dbPath = filepath.Join(dataDir(), "abbado.db")
	}

	db, err := database.Open(dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	handler := server.New(db, port)

	addr := fmt.Sprintf(":%s", port)
	log.Printf("Abbado listening on http://localhost%s", addr)

	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func readPID() int {
	data, err := os.ReadFile(pidFile())
	if err != nil {
		return 0
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		return 0
	}
	return pid
}

func processAlive(pid int) bool {
	proc, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	// Signal 0 checks if process exists without actually signaling.
	return proc.Signal(syscall.Signal(0)) == nil
}
