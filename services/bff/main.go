// Command bff is the backend for the calculator's page. It serves the
// page's built static files over HTTP, and answers the engine protocol
// at POST /api/calc, so the page can run the engine here and not as
// wasm in its worker. docs/features/001-calculator/prd.md section 3.
//
//	$ task bff:serve
//	serving .../web/apps/app/dist on http://127.0.0.1:8080
//
// The page is a single page, so a request that names no file is
// answered with index.html.
//
// The engine API is single-tenant: one engine, one store, shared by
// every caller. It is correct only on loopback, which is what the
// default --addr is; see engine.go and --api.
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jpillora/opts"
)

// shutdownGrace is how long the in-flight requests have to finish when
// the server stops.
const shutdownGrace = 5 * time.Second

type rootCmd struct {
	Addr   string `opts:"short=a" help:"Host:port to listen on. The engine API is single-tenant, so keep it on loopback."`
	Dir    string `opts:"short=d" help:"Directory of the page's built static files."`
	API    bool   `help:"Serve the engine protocol at POST /api/calc. Single-tenant: one engine and one store for every caller, so it is only safe on a loopback --addr. --api=false is a static server."`
	Store  string `help:"The file the engine's calculations are kept in, under --api. Read at start, and written whole on each put and delete. A missing file starts from the three seeded calculations."`
	Bugs   string `help:"Directory the page's feedback reports are written to, at POST /api/bugreport, with their screenshots and narrations. Not under --api: the offline page sends a report too. Empty turns the routes off."`
	MywURL string `opts:"name=myw-url" help:"My Whisper's URL, the transcription service, which GET /api/config tells the page. Empty is no service, and the page draws no dictate button."`
	Open   string `opts:"short=o" help:"Open this path in a browser once the server listens, such as / for the server's engine or '/?offline' for the wasm engine."`
}

// newRootCmd carries the defaults. Dir and Store are relative to the
// directory bff runs in; the tasks pass paths from services/bff.
func newRootCmd() *rootCmd {
	return &rootCmd{
		Addr:  "127.0.0.1:8080",
		Dir:   "web/apps/app/dist",
		API:   true,
		Store: "calculations.json",
		Bugs:  ".bugreports",
	}
}

// Run serves until the process is interrupted.
func (c *rootCmd) Run() error {
	return c.run(context.Background(), log.New(os.Stderr, "", log.LstdFlags))
}

// run is Run with the context and the log supplied, so a test can stop
// it and read what it said.
func (c *rootCmd) run(ctx context.Context, logger *log.Logger) error {
	var (
		handler    http.Handler
		closeAPI   func() error
		ln         net.Listener
		srv        *http.Server
		serveErr   = make(chan error, 1)
		ctx2, stop = signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
		shutCtx    context.Context
		shutCancel context.CancelFunc
		err        error
	)
	defer stop()
	// ctx2, never a request's context: the grammar the engine parses
	// with matches under the context it was built with, so it has to
	// live as long as the server does.
	if handler, closeAPI, err = c.handler(ctx2, logger); err != nil {
		return err
	}
	defer func() { _ = closeAPI() }()
	srv = &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}
	if ln, err = net.Listen("tcp", c.Addr); err != nil {
		return fmt.Errorf("listening on %s: %w", c.Addr, err)
	}
	logger.Printf("serving %s on http://%s", c.Dir, ln.Addr())
	if c.API {
		logger.Printf("engine API at http://%s/api/calc, store %s (single-tenant; see --help)", ln.Addr(), c.Store)
	}
	if c.Bugs != "" {
		logger.Printf("feedback reports to %s, at http://%s/api/bugreport", c.Bugs, ln.Addr())
	}
	if c.MywURL == "" {
		logger.Printf("no My Whisper: the page draws no dictate button")
	} else {
		logger.Printf("the page transcribes at %s (told at /api/config)", mywURL(c.MywURL))
	}
	// After Listen, so the browser never races the socket, and before
	// Serve, which blocks.
	if c.Open != "" {
		var url = fmt.Sprintf("http://%s%s", ln.Addr(), c.Open)
		logger.Printf("opening %s", url)
		if err = openBrowser(url); err != nil {
			logger.Printf("could not open a browser: %v", err)
		}
	}
	go func() {
		var err error
		if err = srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serveErr <- err
		}
	}()
	select {
	case err = <-serveErr:
		return fmt.Errorf("serving: %w", err)
	case <-ctx2.Done():
	}
	logger.Printf("shutting down")
	shutCtx, shutCancel = context.WithTimeout(context.Background(), shutdownGrace)
	defer shutCancel()
	return srv.Shutdown(shutCtx)
}

// handler builds the mux: the static files at the root, the health
// route, the config route, the engine protocol unless --api=false, and
// the feedback report unless --bugs is empty.
//
// It is apart from run so a test has the whole mux without a listener.
// ctx is the server's lifetime; the returned func releases the
// engine's grammar and is never nil.
func (c *rootCmd) handler(ctx context.Context, logger *log.Logger) (http.Handler, func() error, error) {
	var (
		static   *staticHandler
		engineH  *engineHandler
		bugs     *bugReportHandler
		mux      = http.NewServeMux()
		closeAPI = func() error { return nil }
		err      error
	)
	if static, err = newStaticHandler(c.Dir, true); err != nil {
		return nil, closeAPI, err
	}
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		fmt.Fprintln(w, "ok")
	})
	// Not under --api and not under --bugs: the page reads it at every
	// load, and it is how the page learns what is on. By path, for the
	// 405.
	mux.Handle("/api/config", &configHandler{
		config: serverConfig{
			Myw:  mywURL(c.MywURL),
			Bugs: c.Bugs != "",
			API:  c.API,
		},
	})
	if c.API {
		// A grammar that will not load, or a store that will not read,
		// stops bff at start; it is not a route that answers every
		// request with the same error.
		if engineH, err = newEngineHandler(ctx, newFileStore(c.Store)); err != nil {
			return nil, closeAPI, err
		}
		// By path, not as "POST /api/calc", so a wrong method gets a 405.
		// Registered by method, a GET would fall through to the static
		// handler and be answered with index.html.
		mux.Handle("/api/calc", engineH)
		closeAPI = engineH.Close
	}
	// Not under --api: a report needs no engine, and the offline page,
	// which runs with --api=false, sends one too. By path, for the 405.
	if c.Bugs != "" {
		bugs = newBugReportHandler(c.Bugs)
		mux.Handle("/api/bugreport", bugs)
		mux.Handle("/api/bugreport/screenshot", bugs.screenshots())
		mux.Handle("/api/bugreport/audio", bugs.audio())
	} else {
		// Off is a 404 for every method, so the static handler's
		// fallback does not answer it with index.html.
		mux.Handle("/api/bugreport", http.NotFoundHandler())
		mux.Handle("/api/bugreport/", http.NotFoundHandler())
	}
	mux.Handle("/", static)
	return logging(mux, logger), closeAPI, nil
}

func main() {
	var (
		cli opts.ParsedOpts
		err error
	)
	if cli, err = opts.New(newRootCmd()).
		Name("bff").
		EmbedGlobalFlagSet().
		Complete().
		ParseArgsError(os.Args); err != nil {
		fmt.Fprintf(os.Stderr, "%v", err)
		os.Exit(1)
	}
	// An error from Run is about the directory, the port or the store,
	// not about how the command was called, so the help text is left
	// out.
	if err = cli.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(2)
	}
}
