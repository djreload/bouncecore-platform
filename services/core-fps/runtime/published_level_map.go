package maps

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"

	C "github.com/cfoust/sour/pkg/game/constants"
)

type publishedLevelVector struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type publishedLevelTransform struct {
	Position publishedLevelVector `json:"position"`
	Rotation publishedLevelVector `json:"rotation"`
	Scale    publishedLevelVector `json:"scale"`
}

type publishedLevelProperties struct {
	Angle  int `json:"angle"`
	Blue   int `json:"blue"`
	Green  int `json:"green"`
	Radius int `json:"radius"`
	Red    int `json:"red"`
	Tag    int `json:"tag"`
	Team   int `json:"team"`
}

type publishedLevelObject struct {
	EntityKind string                   `json:"entityKind"`
	ID         string                   `json:"id"`
	Kind       string                   `json:"kind"`
	Label      string                   `json:"label"`
	MaterialID string                   `json:"materialId"`
	Properties publishedLevelProperties `json:"properties"`
	Shape      string                   `json:"shape"`
	Transform  publishedLevelTransform  `json:"transform"`
}

type publishedLevelDocument struct {
	GridSize  int                    `json:"gridSize"`
	Objects   []publishedLevelObject `json:"objects"`
	WorldSize int                    `json:"worldSize"`
}

type publishedLevelBundle struct {
	Document publishedLevelDocument `json:"document"`
	Map      struct {
		ID string `json:"id"`
	} `json:"map"`
}

type publishedLevelBox struct {
	MinX int
	MinY int
	MinZ int
	MaxX int
	MaxY int
	MaxZ int
}

var publishedTextureIDs = []string{
	"grass-lush", "grass-night", "dirt-rich", "dirt-rocky", "sand-gold", "sand-black",
	"stone-grey", "stone-dark", "stone-moss", "ice-blue", "lava-crust", "water-deep",
	"oak-planks", "dark-planks", "painted-planks", "red-brick", "charcoal-brick",
	"white-brick", "concrete", "concrete-rave", "marble-white", "roof-slate",
	"ceramic-cyan", "ceramic-pink", "steel-clean", "steel-dark", "steel-rust",
	"diamond-plate", "hazard-yellow", "hazard-red", "vent-dark", "cargo-blue",
	"cargo-red", "tech-floor", "neon-cyan", "neon-pink", "neon-acid", "neon-violet",
	"laser-grid", "dancefloor-cyan", "dancefloor-mix", "speaker-black", "glass-clear",
	"glass-pink", "team-red", "team-blue", "bouncecore", "void",
}

func publishedTextureIndex(id string) uint16 {
	for index, candidate := range publishedTextureIDs {
		if candidate == id {
			return uint16(index + 2)
		}
	}
	return 2
}

func publishedBoxesOverlap(area publishedLevelBox, origin [3]int, size int) bool {
	return area.MinX < origin[0]+size && area.MaxX > origin[0] &&
		area.MinY < origin[1]+size && area.MaxY > origin[1] &&
		area.MinZ < origin[2]+size && area.MaxZ > origin[2]
}

func publishedBoxContainsCube(area publishedLevelBox, origin [3]int, size int) bool {
	return area.MinX <= origin[0] && area.MaxX >= origin[0]+size &&
		area.MinY <= origin[1] && area.MaxY >= origin[1]+size &&
		area.MinZ <= origin[2] && area.MaxZ >= origin[2]+size
}

func clonePublishedLeaf(source *Cube) *Cube {
	clone := &Cube{
		Children: make([]*Cube, 0),
		Material: source.Material,
		Merged:   source.Merged,
		Escaped:  source.Escaped,
	}
	clone.Edges = source.Edges
	clone.Texture = source.Texture
	clone.SurfaceInfo = source.SurfaceInfo
	return clone
}

func splitPublishedCube(cube *Cube) {
	if len(cube.Children) != 0 {
		return
	}
	cube.Children = make([]*Cube, CUBE_FACTOR)
	for index := range cube.Children {
		cube.Children[index] = clonePublishedLeaf(cube)
	}
}

func setPublishedSolid(cube *Cube, texture uint16) {
	cube.Children = make([]*Cube, 0)
	cube.SolidFaces()
	cube.Material = MAT_AIR
	for face := range cube.Texture {
		cube.Texture[face] = texture
	}
}

func fillPublishedCube(
	cube *Cube,
	origin [3]int,
	size int,
	area publishedLevelBox,
	texture uint16,
	gridSize int,
) {
	if !publishedBoxesOverlap(area, origin, size) {
		return
	}
	if publishedBoxContainsCube(area, origin, size) || size <= gridSize {
		setPublishedSolid(cube, texture)
		return
	}

	splitPublishedCube(cube)
	childSize := size / 2
	for index, child := range cube.Children {
		childOrigin := origin
		if index&1 != 0 {
			childOrigin[0] += childSize
		}
		if index&2 != 0 {
			childOrigin[1] += childSize
		}
		if index&4 != 0 {
			childOrigin[2] += childSize
		}
		fillPublishedCube(child, childOrigin, childSize, area, texture, gridSize)
	}
}

func fillPublishedBox(
	root *Cube,
	area publishedLevelBox,
	texture uint16,
	worldSize int,
	gridSize int,
) {
	childSize := worldSize / 2
	for index, child := range root.Children {
		origin := [3]int{}
		if index&1 != 0 {
			origin[0] = childSize
		}
		if index&2 != 0 {
			origin[1] = childSize
		}
		if index&4 != 0 {
			origin[2] = childSize
		}
		fillPublishedCube(child, origin, childSize, area, texture, gridSize)
	}
}

func rotatePublishedPoint(x, y float64, turns int) (float64, float64) {
	switch ((turns % 4) + 4) % 4 {
	case 1:
		return -y, x
	case 2:
		return -x, -y
	case 3:
		return y, -x
	default:
		return x, y
	}
}

func addPublishedLocalBox(
	root *Cube,
	object publishedLevelObject,
	minX, minY, minZ, maxX, maxY, maxZ float64,
	texture uint16,
	worldSize int,
	gridSize int,
) {
	turns := int(math.Round(object.Transform.Rotation.Z / (math.Pi / 2)))
	corners := [][2]float64{{minX, minY}, {minX, maxY}, {maxX, minY}, {maxX, maxY}}
	worldMinX, worldMinY := math.Inf(1), math.Inf(1)
	worldMaxX, worldMaxY := math.Inf(-1), math.Inf(-1)
	for _, corner := range corners {
		x, y := rotatePublishedPoint(corner[0], corner[1], turns)
		worldMinX = math.Min(worldMinX, x+object.Transform.Position.X)
		worldMinY = math.Min(worldMinY, y+object.Transform.Position.Y)
		worldMaxX = math.Max(worldMaxX, x+object.Transform.Position.X)
		worldMaxY = math.Max(worldMaxY, y+object.Transform.Position.Y)
	}

	snapDown := func(value float64) int {
		return int(math.Floor(value/float64(gridSize))) * gridSize
	}
	snapUp := func(value float64) int {
		return int(math.Ceil(value/float64(gridSize))) * gridSize
	}
	area := publishedLevelBox{
		MinX: snapDown(worldMinX),
		MinY: snapDown(worldMinY),
		MinZ: snapDown(minZ + object.Transform.Position.Z),
		MaxX: snapUp(worldMaxX),
		MaxY: snapUp(worldMaxY),
		MaxZ: snapUp(maxZ + object.Transform.Position.Z),
	}
	fillPublishedBox(root, area, texture, worldSize, gridSize)
}

func addPublishedGeometry(
	root *Cube,
	object publishedLevelObject,
	worldSize int,
	gridSize int,
) {
	texture := publishedTextureIndex(object.MaterialID)
	scale := object.Transform.Scale
	halfX, halfY, halfZ := scale.X/2, scale.Y/2, scale.Z/2

	switch object.Shape {
	case "sphere":
		for x := -halfX; x < halfX; x += float64(gridSize) {
			for y := -halfY; y < halfY; y += float64(gridSize) {
				for z := -halfZ; z < halfZ; z += float64(gridSize) {
					nx := (x + float64(gridSize)/2) / halfX
					ny := (y + float64(gridSize)/2) / halfY
					nz := (z + float64(gridSize)/2) / halfZ
					if nx*nx+ny*ny+nz*nz <= 1 {
						addPublishedLocalBox(root, object, x, y, z, x+float64(gridSize), y+float64(gridSize), z+float64(gridSize), texture, worldSize, gridSize)
					}
				}
			}
		}
	case "cylinder":
		for x := -halfX; x < halfX; x += float64(gridSize) {
			for y := -halfY; y < halfY; y += float64(gridSize) {
				nx := (x + float64(gridSize)/2) / halfX
				ny := (y + float64(gridSize)/2) / halfY
				if nx*nx+ny*ny <= 1 {
					addPublishedLocalBox(root, object, x, y, -halfZ, x+float64(gridSize), y+float64(gridSize), halfZ, texture, worldSize, gridSize)
				}
			}
		}
	case "ramp", "stairs":
		steps := 8
		if object.Shape == "stairs" {
			steps = 6
		}
		stepWidth := scale.X / float64(steps)
		for index := 0; index < steps; index++ {
			height := scale.Z * float64(index+1) / float64(steps)
			minX := -halfX + float64(index)*stepWidth
			addPublishedLocalBox(root, object, minX, -halfY, -halfZ, minX+stepWidth, halfY, -halfZ+height, texture, worldSize, gridSize)
		}
	case "arch":
		pillarWidth := scale.X * 0.22
		openingHeight := scale.Z * 0.72
		addPublishedLocalBox(root, object, -halfX, -halfY, -halfZ, -halfX+pillarWidth, halfY, -halfZ+openingHeight, texture, worldSize, gridSize)
		addPublishedLocalBox(root, object, halfX-pillarWidth, -halfY, -halfZ, halfX, halfY, -halfZ+openingHeight, texture, worldSize, gridSize)
		addPublishedLocalBox(root, object, -halfX, -halfY, -halfZ+openingHeight, halfX, halfY, halfZ, texture, worldSize, gridSize)
	default:
		addPublishedLocalBox(root, object, -halfX, -halfY, -halfZ, halfX, halfY, halfZ, texture, worldSize, gridSize)
	}
}

func addPublishedEntity(gameMap *GameMap, object publishedLevelObject) {
	entityTypes := map[string]C.EntityType{
		"armour-green":           C.EntityTypeGreenArmour,
		"armour-yellow":          C.EntityTypeYellowArmour,
		"bullets":                C.EntityTypeBullets,
		"flag":                   C.EntityTypeFlag,
		"grenades":               C.EntityTypeGrenades,
		"health":                 C.EntityTypeHealth,
		"light":                  C.EntityTypeLight,
		"player-spawn":           C.EntityTypePlayerStart,
		"quad":                   C.EntityTypeQuad,
		"rifle-rounds":           C.EntityTypeRounds,
		"rockets":                C.EntityTypeRockets,
		"shotgun-shells":         C.EntityTypeShells,
		"teleporter":             C.EntityTypeTeleport,
		"teleporter-destination": C.EntityTypeTeledest,
	}
	entityType, ok := entityTypes[object.EntityKind]
	if !ok {
		return
	}
	entity := Entity{
		Position: Vector{
			X: float32(object.Transform.Position.X),
			Y: float32(object.Transform.Position.Y),
			Z: float32(object.Transform.Position.Z),
		},
		Type: entityType,
	}
	switch object.EntityKind {
	case "player-spawn", "flag":
		entity.Attr1 = int16(object.Properties.Angle)
		entity.Attr2 = int16(object.Properties.Team)
	case "light":
		entity.Attr1 = int16(object.Properties.Radius)
		entity.Attr2 = int16(object.Properties.Red)
		entity.Attr3 = int16(object.Properties.Green)
		entity.Attr4 = int16(object.Properties.Blue)
	case "teleporter":
		entity.Attr3 = int16(object.Properties.Tag)
	case "teleporter-destination":
		entity.Attr1 = int16(object.Properties.Angle)
		entity.Attr2 = int16(object.Properties.Tag)
	}
	gameMap.Entities = append(gameMap.Entities, entity)
}

func readPublishedLevel(path string) (publishedLevelBundle, error) {
	var bundle publishedLevelBundle
	body, err := os.ReadFile(path)
	if err != nil {
		return bundle, err
	}
	if err := json.Unmarshal(body, &bundle); err != nil {
		return bundle, fmt.Errorf("decode level definition: %w", err)
	}
	if bundle.Document.WorldSize != 512 && bundle.Document.WorldSize != 1024 && bundle.Document.WorldSize != 2048 {
		return bundle, fmt.Errorf("unsupported world size %d", bundle.Document.WorldSize)
	}
	if bundle.Document.GridSize < 4 || bundle.Document.GridSize > 64 {
		return bundle, fmt.Errorf("unsupported grid size %d", bundle.Document.GridSize)
	}
	if len(bundle.Document.Objects) > 2000 {
		return bundle, fmt.Errorf("level has too many objects")
	}
	if bundle.Map.ID == "" {
		return bundle, fmt.Errorf("level map id is empty")
	}
	return bundle, nil
}

// BuildPublishedLevel compiles a validated level-builder bundle into a Cube 2 OGZ.
func BuildPublishedLevel(inputPath string, outputDirectory string) (string, error) {
	bundle, err := readPublishedLevel(inputPath)
	if err != nil {
		return "", err
	}
	gameMap, err := NewMap()
	if err != nil {
		return "", fmt.Errorf("create published level map: %w", err)
	}
	defer gameMap.Destroy()

	gameMap.Header.WorldSize = int32(bundle.Document.WorldSize)
	gameMap.WorldRoot = NewCubes(F_EMPTY, MAT_AIR)
	gameMap.Entities = make([]Entity, 0, len(bundle.Document.Objects))
	for _, object := range bundle.Document.Objects {
		if object.Kind == "geometry" {
			addPublishedGeometry(gameMap.WorldRoot, object, bundle.Document.WorldSize, bundle.Document.GridSize)
		} else if object.Kind == "entity" {
			addPublishedEntity(gameMap, object)
		}
	}

	if err := os.MkdirAll(outputDirectory, 0o755); err != nil {
		return "", err
	}
	outputPath := filepath.Join(outputDirectory, bundle.Map.ID+".ogz")
	if err := gameMap.ToFile(outputPath); err != nil {
		return "", fmt.Errorf("write published level: %w", err)
	}
	decoded, err := FromFile(outputPath)
	if err != nil {
		return "", fmt.Errorf("verify published level: %w", err)
	}
	defer decoded.Destroy()
	if decoded.Header.WorldSize != int32(bundle.Document.WorldSize) {
		return "", fmt.Errorf("compiled world size mismatch")
	}
	return outputPath, nil
}
