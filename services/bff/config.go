package main

import (
	"encoding/json"
	"net/http"
)

// configHandler serves GET /api/config: what the page needs to know
// about this server that it cannot read from its own URL. It is not
// under --api: the offline page reads it too. Registered by path, for
// the 405.
//
//	{"myw": "http://127.0.0.1:8090", "bugs": true, "api": true}
//
// myw is My Whisper's URL, or "" for none; bugs is whether the feedback
// report routes are on; api is whether POST /api/calc is. The traces'
// viewer joins it with the traces.
type configHandler struct {
	config serverConfig
}

// serverConfig is the body. The page's serverConfig.ts reads it.
type serverConfig struct {
	Myw  string `json:"myw"`
	Bugs bool   `json:"bugs"`
	API  bool   `json:"api"`
}

func (h *configHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var (
		out []byte
		err error
	)
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		httpError(w, http.StatusMethodNotAllowed, "the config API takes GET")
		return
	}
	if out, err = json.Marshal(h.config); err != nil {
		httpError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	// The page reads it once at load; a cached answer from a server
	// started with other flags would point at a service that is gone.
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(out)
}
