package maps

import (
	"fmt"

	C "github.com/cfoust/sour/pkg/game/constants"
)

const (
	blocklandsWorldSize = 1024
	blocklandsGridSize  = 16

	textureGrass uint16 = 2 + iota
	textureDirt
	textureStone
	textureCobblestone
	textureOakLog
	textureOakPlanks
	textureLeaves
	textureGlass
	textureSand
	textureWater
	textureBricks
	textureRoofTiles
	texturePath
	textureFarmland
	textureWheat
	textureDoor
	textureTorch
	textureCyanWool
	textureMagentaWool
	textureCoalOre
	textureIron
	textureSky
)

type blocklandsBox struct {
	minX int
	minY int
	minZ int
	maxX int
	maxY int
	maxZ int
}

func newBlocklandsRoot() *Cube {
	return NewCubes(F_EMPTY, MAT_AIR)
}

func blocklandsBoxesOverlap(area blocklandsBox, origin [3]int, size int) bool {
	return area.minX < origin[0]+size && area.maxX > origin[0] &&
		area.minY < origin[1]+size && area.maxY > origin[1] &&
		area.minZ < origin[2]+size && area.maxZ > origin[2]
}

func blocklandsBoxContainsCube(area blocklandsBox, origin [3]int, size int) bool {
	return area.minX <= origin[0] && area.maxX >= origin[0]+size &&
		area.minY <= origin[1] && area.maxY >= origin[1]+size &&
		area.minZ <= origin[2] && area.maxZ >= origin[2]+size
}

func cloneBlocklandsLeaf(source *Cube) *Cube {
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

func splitBlocklandsCube(cube *Cube) {
	if len(cube.Children) != 0 {
		return
	}

	cube.Children = make([]*Cube, CUBE_FACTOR)
	for index := range cube.Children {
		cube.Children[index] = cloneBlocklandsLeaf(cube)
	}
}

func setBlocklandsSolid(cube *Cube, texture uint16) {
	cube.Children = make([]*Cube, 0)
	cube.SolidFaces()
	cube.Material = MAT_AIR
	for face := range cube.Texture {
		cube.Texture[face] = texture
	}
}

func fillBlocklandsCube(
	cube *Cube,
	origin [3]int,
	size int,
	area blocklandsBox,
	texture uint16,
) {
	if !blocklandsBoxesOverlap(area, origin, size) {
		return
	}
	if blocklandsBoxContainsCube(area, origin, size) || size <= blocklandsGridSize {
		setBlocklandsSolid(cube, texture)
		return
	}

	splitBlocklandsCube(cube)
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
		fillBlocklandsCube(child, childOrigin, childSize, area, texture)
	}
}

func fillBlocklandsBox(root *Cube, area blocklandsBox, texture uint16) {
	childSize := blocklandsWorldSize / 2
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
		fillBlocklandsCube(child, origin, childSize, area, texture)
	}
}

func addBlocklandsBox(
	root *Cube,
	texture uint16,
	minX, minY, minZ, maxX, maxY, maxZ int,
) {
	fillBlocklandsBox(root, blocklandsBox{
		minX: minX,
		minY: minY,
		minZ: minZ,
		maxX: maxX,
		maxY: maxY,
		maxZ: maxZ,
	}, texture)
}

func addBlocklandsEntity(
	gameMap *GameMap,
	entityType C.EntityType,
	x, y, z float32,
	attrs ...int16,
) {
	entity := Entity{
		Position: Vector{X: x, Y: y, Z: z},
		Type:     entityType,
	}
	if len(attrs) > 0 {
		entity.Attr1 = attrs[0]
	}
	if len(attrs) > 1 {
		entity.Attr2 = attrs[1]
	}
	if len(attrs) > 2 {
		entity.Attr3 = attrs[2]
	}
	if len(attrs) > 3 {
		entity.Attr4 = attrs[3]
	}
	if len(attrs) > 4 {
		entity.Attr5 = attrs[4]
	}
	gameMap.Entities = append(gameMap.Entities, entity)
}

var blocklandsGlyphs = map[rune][]string{
	'B': {"110", "101", "110", "101", "110"},
	'C': {"111", "100", "100", "100", "111"},
	'E': {"111", "100", "110", "100", "111"},
	'N': {"101", "111", "111", "111", "101"},
	'O': {"111", "101", "101", "101", "111"},
	'R': {"110", "101", "110", "101", "101"},
	'U': {"101", "101", "101", "101", "111"},
}

func addBlocklandsWord(
	root *Cube,
	word string,
	startX, wallY, baseZ int,
	textures []uint16,
) {
	for letterIndex, character := range word {
		glyph, ok := blocklandsGlyphs[character]
		if !ok {
			continue
		}
		texture := textures[letterIndex%len(textures)]
		letterX := startX + letterIndex*64
		for row, pixels := range glyph {
			for column, pixel := range pixels {
				if pixel != '1' {
					continue
				}
				x := letterX + column*16
				z := baseZ + (len(glyph)-1-row)*16
				addBlocklandsBox(root, texture, x, wallY, z, x+16, wallY+16, z+16)
			}
		}
	}
}

func addBlocklandsMural(root *Cube) {
	// The logo is physical coloured block geometry spanning the castle wall.
	addBlocklandsWord(
		root,
		"BOUNCECORE",
		192,
		176,
		304,
		[]uint16{textureCyanWool, textureMagentaWool},
	)
}

func addBlocklandsTree(root *Cube, x, y, groundZ int) {
	addBlocklandsBox(root, textureDirt, x-16, y-16, groundZ-16, x+48, y+48, groundZ)
	addBlocklandsBox(root, textureOakLog, x, y, groundZ, x+32, y+32, groundZ+96)
	addBlocklandsBox(root, textureLeaves, x-48, y-32, groundZ+64, x+80, y+64, groundZ+96)
	addBlocklandsBox(root, textureLeaves, x-32, y-48, groundZ+80, x+64, y+80, groundZ+112)
	addBlocklandsBox(root, textureLeaves, x-16, y-16, groundZ+96, x+48, y+48, groundZ+144)
}

func addBlocklandsTorch(root *Cube, x, y, groundZ int) {
	addBlocklandsBox(root, textureOakLog, x, y, groundZ, x+16, y+16, groundZ+48)
	addBlocklandsBox(root, textureTorch, x-8, y-8, groundZ+48, x+24, y+24, groundZ+64)
}

func addWestVillageHouse(root *Cube) {
	// Stone foundation, oak floor, log frame, plank infill, glass windows,
	// an east-facing doorway and a two-tier brick roof.
	addBlocklandsBox(root, textureStone, 144, 384, 176, 336, 640, 192)
	addBlocklandsBox(root, textureOakPlanks, 160, 400, 192, 320, 624, 208)
	for _, corner := range [][2]int{{160, 400}, {288, 400}, {160, 592}, {288, 592}} {
		addBlocklandsBox(root, textureOakLog, corner[0], corner[1], 208, corner[0]+32, corner[1]+32, 320)
	}
	addBlocklandsBox(root, textureOakPlanks, 192, 400, 208, 288, 416, 304)
	addBlocklandsBox(root, textureOakPlanks, 192, 608, 208, 288, 624, 304)
	addBlocklandsBox(root, textureOakPlanks, 160, 432, 208, 176, 480, 304)
	addBlocklandsBox(root, textureGlass, 160, 480, 240, 176, 544, 288)
	addBlocklandsBox(root, textureOakPlanks, 160, 544, 208, 176, 592, 304)
	addBlocklandsBox(root, textureOakPlanks, 304, 432, 208, 320, 480, 304)
	addBlocklandsBox(root, textureDoor, 304, 480, 208, 320, 544, 288)
	addBlocklandsBox(root, textureOakPlanks, 304, 544, 208, 320, 592, 304)
	addBlocklandsBox(root, textureRoofTiles, 128, 368, 304, 352, 656, 320)
	addBlocklandsBox(root, textureRoofTiles, 144, 384, 320, 336, 640, 336)
	addBlocklandsBox(root, textureRoofTiles, 160, 400, 336, 320, 624, 352)
	addBlocklandsBox(root, textureBricks, 224, 432, 336, 256, 464, 400)
}

func addEastVillageHouse(root *Cube) {
	addBlocklandsBox(root, textureStone, 688, 384, 176, 880, 640, 192)
	addBlocklandsBox(root, textureOakPlanks, 704, 400, 192, 864, 624, 208)
	for _, corner := range [][2]int{{704, 400}, {832, 400}, {704, 592}, {832, 592}} {
		addBlocklandsBox(root, textureOakLog, corner[0], corner[1], 208, corner[0]+32, corner[1]+32, 320)
	}
	addBlocklandsBox(root, textureOakPlanks, 736, 400, 208, 832, 416, 304)
	addBlocklandsBox(root, textureOakPlanks, 736, 608, 208, 832, 624, 304)
	addBlocklandsBox(root, textureOakPlanks, 848, 432, 208, 864, 480, 304)
	addBlocklandsBox(root, textureGlass, 848, 480, 240, 864, 544, 288)
	addBlocklandsBox(root, textureOakPlanks, 848, 544, 208, 864, 592, 304)
	addBlocklandsBox(root, textureOakPlanks, 704, 432, 208, 720, 480, 304)
	addBlocklandsBox(root, textureDoor, 704, 480, 208, 720, 544, 288)
	addBlocklandsBox(root, textureOakPlanks, 704, 544, 208, 720, 592, 304)
	addBlocklandsBox(root, textureRoofTiles, 672, 368, 304, 896, 656, 320)
	addBlocklandsBox(root, textureRoofTiles, 688, 384, 320, 880, 640, 336)
	addBlocklandsBox(root, textureRoofTiles, 704, 400, 336, 864, 624, 352)
	addBlocklandsBox(root, textureBricks, 768, 432, 336, 800, 464, 400)
}

func addBlocklandsCastle(root *Cube) {
	// A proper stone keep closes the north edge. The gate is a real opening,
	// while the two towers and battlements provide readable upper routes.
	addBlocklandsBox(root, textureStone, 160, 128, 176, 864, 176, 208)
	addBlocklandsBox(root, textureCobblestone, 176, 144, 208, 464, 176, 416)
	addBlocklandsBox(root, textureCobblestone, 560, 144, 208, 848, 176, 416)
	addBlocklandsBox(root, textureCobblestone, 464, 144, 288, 560, 176, 416)
	addBlocklandsBox(root, textureStone, 160, 128, 208, 240, 208, 432)
	addBlocklandsBox(root, textureStone, 784, 128, 208, 864, 208, 432)
	addBlocklandsBox(root, textureIron, 480, 144, 208, 544, 160, 288)

	for x := 176; x < 848; x += 64 {
		addBlocklandsBox(root, textureStone, x, 144, 416, x+32, 176, 448)
	}
	for _, towerX := range []int{160, 784} {
		for x := towerX; x < towerX+80; x += 48 {
			addBlocklandsBox(root, textureStone, x, 128, 432, x+32, 176, 464)
		}
	}

	addBlocklandsMural(root)
}

func addBlocklandsBridge(root *Cube) {
	addBlocklandsBox(root, textureOakLog, 448, 448, 176, 464, 576, 224)
	addBlocklandsBox(root, textureOakLog, 560, 448, 176, 576, 576, 224)
	addBlocklandsBox(root, textureOakPlanks, 448, 448, 208, 576, 576, 224)
	addBlocklandsBox(root, textureOakLog, 448, 448, 224, 464, 576, 256)
	addBlocklandsBox(root, textureOakLog, 560, 448, 224, 576, 576, 256)
	for y := 448; y < 576; y += 48 {
		addBlocklandsBox(root, textureOakLog, 448, y, 224, 464, y+16, 272)
		addBlocklandsBox(root, textureOakLog, 560, y, 224, 576, y+16, 272)
	}
}

func addBlocklandsFarm(root *Cube) {
	addBlocklandsBox(root, textureOakLog, 144, 688, 176, 416, 704, 208)
	addBlocklandsBox(root, textureOakLog, 144, 848, 176, 416, 864, 208)
	addBlocklandsBox(root, textureOakLog, 144, 704, 176, 160, 848, 208)
	addBlocklandsBox(root, textureOakLog, 400, 704, 176, 416, 848, 208)
	addBlocklandsBox(root, textureFarmland, 160, 704, 176, 272, 848, 192)
	addBlocklandsBox(root, textureWater, 272, 704, 176, 304, 848, 192)
	addBlocklandsBox(root, textureFarmland, 304, 704, 176, 400, 848, 192)
	for y := 720; y < 832; y += 48 {
		addBlocklandsBox(root, textureWheat, 176, y, 192, 256, y+16, 224)
		addBlocklandsBox(root, textureWheat, 320, y, 192, 384, y+16, 224)
	}
}

func addBlocklandsMine(root *Cube) {
	// The southern mine is embedded in stone rather than a freestanding label.
	addBlocklandsBox(root, textureStone, 416, 800, 176, 608, 912, 208)
	addBlocklandsBox(root, textureStone, 416, 816, 208, 448, 912, 320)
	addBlocklandsBox(root, textureStone, 576, 816, 208, 608, 912, 320)
	addBlocklandsBox(root, textureStone, 448, 816, 288, 576, 912, 320)
	addBlocklandsBox(root, textureCoalOre, 432, 816, 240, 448, 864, 288)
	addBlocklandsBox(root, textureCoalOre, 576, 848, 224, 592, 896, 272)
	addBlocklandsBox(root, textureOakLog, 448, 816, 208, 464, 832, 288)
	addBlocklandsBox(root, textureOakLog, 560, 816, 208, 576, 832, 288)
	addBlocklandsBox(root, textureOakLog, 448, 816, 288, 576, 832, 304)
}

func addBlocklandsGeometry(root *Cube) {
	// Deep dirt under a grass surface makes the terrain read as a coherent
	// block landscape. Stone cliffs close the playable edge.
	addBlocklandsBox(root, textureDirt, 112, 112, 96, 912, 912, 160)
	addBlocklandsBox(root, textureGrass, 112, 112, 160, 912, 912, 176)
	addBlocklandsBox(root, textureStone, 96, 96, 96, 112, 928, 320)
	addBlocklandsBox(root, textureStone, 912, 96, 96, 928, 928, 320)
	addBlocklandsBox(root, textureStone, 112, 96, 96, 912, 112, 320)
	addBlocklandsBox(root, textureStone, 112, 912, 96, 912, 928, 320)
	addBlocklandsBox(root, textureSky, 96, 96, 480, 928, 928, 496)

	// Raised dirt-and-grass terraces shape the world instead of one flat box.
	for _, terrace := range []blocklandsBox{
		{112, 112, 176, 336, 352, 208},
		{688, 112, 176, 912, 352, 208},
		{112, 656, 176, 336, 912, 208},
		{688, 656, 176, 912, 912, 208},
	} {
		fillBlocklandsBox(root, terrace, textureDirt)
		addBlocklandsBox(
			root,
			textureGrass,
			terrace.minX,
			terrace.minY,
			terrace.maxZ,
			terrace.maxX,
			terrace.maxY,
			terrace.maxZ+16,
		)
	}

	// A north-south river has sand banks and a timber bridge at the village.
	addBlocklandsBox(root, textureSand, 432, 176, 176, 464, 896, 192)
	addBlocklandsBox(root, textureWater, 464, 176, 176, 560, 896, 192)
	addBlocklandsBox(root, textureSand, 560, 176, 176, 592, 896, 192)
	addBlocklandsBridge(root)

	// Cobblestone paths connect both bases, castle, farm, bridge and mine.
	addBlocklandsBox(root, texturePath, 320, 480, 176, 448, 544, 192)
	addBlocklandsBox(root, texturePath, 576, 480, 176, 704, 544, 192)
	addBlocklandsBox(root, texturePath, 384, 208, 176, 432, 480, 192)
	addBlocklandsBox(root, texturePath, 592, 208, 176, 640, 480, 192)
	addBlocklandsBox(root, texturePath, 384, 544, 176, 432, 816, 192)
	addBlocklandsBox(root, texturePath, 592, 544, 176, 640, 816, 192)

	addWestVillageHouse(root)
	addEastVillageHouse(root)
	addBlocklandsCastle(root)
	addBlocklandsFarm(root)
	addBlocklandsMine(root)

	// Team flags stand on wool-topped cobblestone plinths inside each house.
	addBlocklandsBox(root, textureCobblestone, 208, 480, 208, 272, 544, 224)
	addBlocklandsBox(root, textureCyanWool, 224, 496, 224, 256, 528, 240)
	addBlocklandsBox(root, textureCobblestone, 752, 480, 208, 816, 544, 224)
	addBlocklandsBox(root, textureMagentaWool, 768, 496, 224, 800, 528, 240)

	// A stone village well and material-correct forest complete the overworld.
	addBlocklandsBox(root, textureCobblestone, 608, 688, 176, 688, 768, 208)
	addBlocklandsBox(root, textureWater, 624, 704, 208, 672, 752, 224)
	addBlocklandsBox(root, textureOakLog, 608, 688, 208, 624, 704, 272)
	addBlocklandsBox(root, textureOakLog, 672, 752, 208, 688, 768, 272)
	addBlocklandsBox(root, textureRoofTiles, 592, 672, 272, 704, 784, 288)

	addBlocklandsTree(root, 176, 240, 224)
	addBlocklandsTree(root, 752, 240, 224)
	addBlocklandsTree(root, 816, 288, 224)
	addBlocklandsTree(root, 720, 704, 224)
	addBlocklandsTree(root, 816, 752, 224)
	addBlocklandsTree(root, 736, 832, 224)
	addBlocklandsTree(root, 848, 848, 224)

	for _, torch := range [][3]int{
		{368, 448, 176}, {640, 448, 176}, {368, 560, 176}, {640, 560, 176},
		{448, 416, 176}, {560, 608, 176}, {384, 752, 208}, {624, 784, 176},
	} {
		addBlocklandsTorch(root, torch[0], torch[1], torch[2])
	}
}

func addBlocklandsEntities(gameMap *GameMap) {
	for _, spawn := range []struct {
		x     float32
		y     float32
		z     float32
		angle int16
		team  int16
	}{
		{192, 448, 208, 90, 1}, {192, 512, 208, 90, 1}, {192, 576, 208, 90, 1},
		{272, 448, 208, 90, 1}, {272, 576, 208, 90, 1},
		{832, 448, 208, 270, 2}, {832, 512, 208, 270, 2}, {832, 576, 208, 270, 2},
		{752, 448, 208, 270, 2}, {752, 576, 208, 270, 2},
		{400, 352, 208, 0, 0}, {624, 352, 208, 180, 0},
		{400, 672, 208, 0, 0}, {624, 672, 208, 180, 0},
	} {
		addBlocklandsEntity(
			gameMap,
			C.EntityTypePlayerStart,
			spawn.x,
			spawn.y,
			spawn.z,
			spawn.angle,
			spawn.team,
		)
	}

	addBlocklandsEntity(gameMap, C.EntityTypeFlag, 240, 512, 256, 90, 1)
	addBlocklandsEntity(gameMap, C.EntityTypeFlag, 784, 512, 256, 270, 2)

	for _, position := range [][3]float32{
		{400, 416, 208}, {624, 416, 208}, {400, 608, 208}, {624, 608, 208},
	} {
		addBlocklandsEntity(gameMap, C.EntityTypeRockets, position[0], position[1], position[2])
	}
	for _, position := range [][3]float32{
		{352, 256, 240}, {672, 256, 240}, {352, 768, 224}, {672, 768, 224},
	} {
		addBlocklandsEntity(gameMap, C.EntityTypeGrenades, position[0], position[1], position[2])
	}
	for _, position := range [][3]float32{
		{336, 512, 208}, {688, 512, 208}, {400, 704, 224}, {640, 736, 224},
	} {
		addBlocklandsEntity(gameMap, C.EntityTypeHealth, position[0], position[1], position[2])
	}
	addBlocklandsEntity(gameMap, C.EntityTypeQuad, 512, 512, 240)
	addBlocklandsEntity(gameMap, C.EntityTypeGreenArmour, 512, 256, 208)
	addBlocklandsEntity(gameMap, C.EntityTypeYellowArmour, 512, 784, 208)

	for _, light := range []struct {
		x, y, z float32
		r, g, b int16
		radius  int16
	}{
		{512, 512, 432, 210, 225, 255, 480},
		{240, 512, 304, 0, 190, 255, 176},
		{784, 512, 304, 255, 36, 180, 176},
		{512, 224, 400, 255, 214, 142, 240},
		{368, 448, 256, 255, 176, 74, 128},
		{640, 448, 256, 255, 176, 74, 128},
		{368, 560, 256, 255, 176, 74, 128},
		{640, 560, 256, 255, 176, 74, 128},
		{512, 832, 320, 150, 185, 255, 176},
	} {
		addBlocklandsEntity(
			gameMap,
			C.EntityTypeLight,
			light.x,
			light.y,
			light.z,
			light.radius,
			light.r,
			light.g,
			light.b,
		)
	}
}

func verifyBlocklands(outputPath string) error {
	decoded, err := FromFile(outputPath)
	if err != nil {
		return fmt.Errorf("decode generated Blocklands arena: %w", err)
	}
	defer decoded.Destroy()

	playerStarts := 0
	flags := 0
	for _, entity := range decoded.Entities {
		switch entity.Type {
		case C.EntityTypePlayerStart:
			playerStarts++
		case C.EntityTypeFlag:
			flags++
		}
	}

	if decoded.Header.WorldSize != blocklandsWorldSize {
		return fmt.Errorf("generated Blocklands world size is %d", decoded.Header.WorldSize)
	}
	if playerStarts != 14 || flags != 2 {
		return fmt.Errorf(
			"generated Blocklands arena has %d player starts and %d flags",
			playerStarts,
			flags,
		)
	}

	return nil
}

// BuildBlocklands creates the original Bouncecore block-world arena.
func BuildBlocklands(outputPath string) error {
	gameMap, err := NewMap()
	if err != nil {
		return fmt.Errorf("create Blocklands map: %w", err)
	}
	defer gameMap.Destroy()

	gameMap.WorldRoot = newBlocklandsRoot()
	gameMap.Entities = make([]Entity, 0, 52)
	addBlocklandsGeometry(gameMap.WorldRoot)
	addBlocklandsEntities(gameMap)

	if err := gameMap.ToFile(outputPath); err != nil {
		return fmt.Errorf("write Blocklands map: %w", err)
	}
	return verifyBlocklands(outputPath)
}
