//go:build embedmodel

package source

import _ "embed"

// embedded is the model built into the binary: source/model/ggml-model.bin
// at build time, which `task myw:model` downloads. Build with
// `-tags embedmodel`.
//
//go:embed model/ggml-model.bin
var embedded []byte
