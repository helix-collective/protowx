package server

import (
	"net/http"
	"strings"
)

// cors guards every route with an allowlist of origins. The service is
// unauthenticated, so the list is never *: that would let any page in
// the user's browser post audio here and read the text back.
//
//   - A request with an Origin on the list gets Access-Control-Allow-Origin
//     echoing it, and Vary: Origin.
//   - A preflight from one gets Allow-Methods for its route and
//     Allow-Headers: Content-Type, and is answered 204 before any body
//     is read.
//   - An Origin not on the list is a 403 before the body is read.
//   - No Origin at all, a curl, passes: CORS guards browsers, not
//     processes (PRD section 11).
//
// The SSE of a live stream is a route like any other: the header is set
// before the handler runs, so the page's EventSource is let in.
//
// methods answers a path's methods, for the preflight's Allow-Methods.
func cors(origins []string, methods func(path string) string, next http.Handler) http.Handler {
	var allowed = make(map[string]bool, len(origins))
	for _, o := range origins {
		allowed[strings.TrimSuffix(o, "/")] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var (
			origin = r.Header.Get("Origin")
			h      = w.Header()
		)
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}
		if !allowed[origin] {
			httpError(w, http.StatusForbidden, "the origin "+origin+" is not allowed; pass it with --origin")
			return
		}
		h.Set("Access-Control-Allow-Origin", origin)
		h.Add("Vary", "Origin")
		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			h.Set("Access-Control-Allow-Methods", methods(r.URL.Path))
			h.Set("Access-Control-Allow-Headers", "Content-Type")
			h.Set("Access-Control-Max-Age", "600")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
