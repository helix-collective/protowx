package servecmd

import (
	"slices"
	"testing"
)

// TestAllowedOrigins: the loopback pair always; --origin added once,
// trimmed of a slash.
func TestAllowedOrigins(t *testing.T) {
	var loopback = []string{
		"http://127.0.0.1:8080",
		"http://localhost:8080",
	}
	for _, tc := range []struct {
		name  string
		extra []string
		want  []string
	}{
		{
			name: "loopback alone",
			want: loopback,
		},
		{
			name: "--origin, once each, without the slash",
			extra: []string{
				"http://127.0.0.1:9000/",
				"http://127.0.0.1:8080",
				" ",
				"http://127.0.0.1:9000",
			},
			want: append(slices.Clone(loopback), "http://127.0.0.1:9000"),
		},
	} {
		var got = allowedOrigins(tc.extra)
		if !slices.Equal(got, tc.want) {
			t.Errorf("%s: got %q, want %q", tc.name, got, tc.want)
		}
	}
}
