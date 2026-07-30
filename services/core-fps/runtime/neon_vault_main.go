package main

import (
	"flag"
	"log"

	"github.com/cfoust/sour/pkg/maps"
)

func main() {
	output := flag.String("output", "/out/neonvault.ogz", "output path for the generated OGZ map")
	flag.Parse()

	if err := maps.BuildNeonVault(*output); err != nil {
		log.Fatal(err)
	}
}
