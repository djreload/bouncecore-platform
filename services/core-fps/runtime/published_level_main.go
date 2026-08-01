package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/cfoust/sour/pkg/maps"
)

func main() {
	inputDirectory := flag.String("input-dir", "/tmp/core-published-levels", "directory containing published level JSON bundles")
	outputDirectory := flag.String("output-dir", "/out/published", "directory for compiled OGZ maps")
	flag.Parse()

	if err := os.MkdirAll(*outputDirectory, 0o755); err != nil {
		log.Fatal(err)
	}
	entries, err := os.ReadDir(*inputDirectory)
	if err != nil {
		log.Fatal(err)
	}
	compiled := 0
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".json") {
			continue
		}
		output, err := maps.BuildPublishedLevel(filepath.Join(*inputDirectory, entry.Name()), *outputDirectory)
		if err != nil {
			log.Fatalf("compile %s: %v", entry.Name(), err)
		}
		fmt.Printf("compiled %s\n", output)
		compiled++
	}
	fmt.Printf("compiled %d published Core levels\n", compiled)
}
