package main

import (
	"fmt"
	"log"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

func init() {
	// WebAssembly.instantiateStreaming refuses anything but
	// application/wasm, and the system mime table macOS reads does not
	// always carry .wasm, so it is registered here rather than hoped for.
	if err := mime.AddExtensionType(".wasm", "application/wasm"); err != nil {
		panic(err)
	}
}

// staticHandler serves the files under dir. A request that does not name a
// file is answered with index.html when fallback is set, so a client-side
// route survives a reload.
type staticHandler struct {
	dir      string
	fallback bool
	files    http.Handler
}

// newStaticHandler checks that dir is a directory holding an index.html and
// returns a handler over it.
func newStaticHandler(dir string, fallback bool) (*staticHandler, error) {
	var (
		abs  string
		info os.FileInfo
		err  error
	)
	if abs, err = filepath.Abs(dir); err != nil {
		return nil, fmt.Errorf("resolving %s: %w", dir, err)
	}
	if info, err = os.Stat(abs); err != nil {
		return nil, fmt.Errorf("serving %s: %w (run: task web:build)", dir, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("serving %s: not a directory", dir)
	}
	if _, err = os.Stat(filepath.Join(abs, indexFile)); err != nil {
		return nil, fmt.Errorf("serving %s: no %s (run: task web:build)", dir, indexFile)
	}
	return &staticHandler{
		dir:      abs,
		fallback: fallback,
		files:    http.FileServer(http.Dir(abs)),
	}, nil
}

const indexFile = "index.html"

// ServeHTTP serves the requested file, or index.html when there is no such
// file and the fallback is on.
func (h *staticHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var (
		upath = path.Clean("/" + r.URL.Path)
		err   error
	)
	// A hit, a directory included, goes to the file server, which finds a
	// directory's index.html or lists it. Only a miss falls back.
	if _, err = os.Stat(filepath.Join(h.dir, filepath.FromSlash(upath))); err == nil {
		setCacheControl(w, upath)
		h.files.ServeHTTP(w, r)
		return
	}
	if !h.fallback || (r.Method != http.MethodGet && r.Method != http.MethodHead) {
		http.NotFound(w, r)
		return
	}
	setCacheControl(w, "/"+indexFile)
	http.ServeFile(w, r, filepath.Join(h.dir, indexFile))
}

// setCacheControl marks Vite's content-hashed assets immutable and keeps
// everything else revalidating, so a rebuilt dist/ is picked up on reload.
func setCacheControl(w http.ResponseWriter, upath string) {
	if strings.HasPrefix(upath, "/assets/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		return
	}
	w.Header().Set("Cache-Control", "no-cache")
}

// logging wraps next in a one-line-per-request access log.
func logging(next http.Handler, out *log.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var (
			start = time.Now()
			rec   = &statusRecorder{
				ResponseWriter: w,
				status:         http.StatusOK,
			}
		)
		next.ServeHTTP(rec, r)
		out.Printf("%s %s %d %s", r.Method, r.URL.Path, rec.status, time.Since(start).Round(time.Microsecond))
	})
}

// statusRecorder remembers the status code the handler wrote.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(status int) {
	s.status = status
	s.ResponseWriter.WriteHeader(status)
}
