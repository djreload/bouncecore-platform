package main

import (
	"flag"
	"log"

	"github.com/cfoust/sour/pkg/maps"
)

func main() {
	output := flag.String("output", "/out/blocklands.ogz", "output path for the generated Blocklands OGZ map")
	flag.Parse()

	if err := maps.BuildBlocklands(*output); err != nil {
		log.Fatal(err)
	}
}
