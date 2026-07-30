package maps

import (
	"fmt"

	C "github.com/cfoust/sour/pkg/game/constants"
)

const (
	neonVaultWorldSize = 1024
	neonVaultGridSize  = 16

	textureGrass uint16 = 2 + iota
	textureDirt
	textureStone
	textureWood
	textureLeaves
	textureGlass
	texturePath
	textureCyan
	textureMagenta
	textureLime
	textureSpeaker
	textureBooth
	textureDoor
	textureRoof
	textureSky
	textureBlackstone
)

type arenaBox struct {
	minX int
	minY int
	minZ int
	maxX int
	maxY int
	maxZ int
}

func newArenaRoot() *Cube {
	return NewCubes(F_EMPTY, MAT_AIR)
}

func boxesOverlap(a arenaBox, origin [3]int, size int) bool {
	return a.minX < origin[0]+size && a.maxX > origin[0] &&
		a.minY < origin[1]+size && a.maxY > origin[1] &&
		a.minZ < origin[2]+size && a.maxZ > origin[2]
}

func boxContainsCube(a arenaBox, origin [3]int, size int) bool {
	return a.minX <= origin[0] && a.maxX >= origin[0]+size &&
		a.minY <= origin[1] && a.maxY >= origin[1]+size &&
		a.minZ <= origin[2] && a.maxZ >= origin[2]+size
}

func cloneLeaf(source *Cube) *Cube {
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

func splitArenaCube(cube *Cube) {
	if len(cube.Children) != 0 {
		return
	}

	cube.Children = make([]*Cube, CUBE_FACTOR)
	for index := range cube.Children {
		cube.Children[index] = cloneLeaf(cube)
	}
}

func setArenaSolid(cube *Cube, texture uint16) {
	cube.Children = make([]*Cube, 0)
	cube.SolidFaces()
	cube.Material = MAT_AIR
	for face := range cube.Texture {
		cube.Texture[face] = texture
	}
}

func fillArenaCube(cube *Cube, origin [3]int, size int, area arenaBox, texture uint16) {
	if !boxesOverlap(area, origin, size) {
		return
	}
	if boxContainsCube(area, origin, size) || size <= neonVaultGridSize {
		setArenaSolid(cube, texture)
		return
	}

	splitArenaCube(cube)
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
		fillArenaCube(child, childOrigin, childSize, area, texture)
	}
}

func fillArenaBox(root *Cube, area arenaBox, texture uint16) {
	childSize := neonVaultWorldSize / 2
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
		fillArenaCube(child, origin, childSize, area, texture)
	}
}

func addArenaBox(root *Cube, texture uint16, minX, minY, minZ, maxX, maxY, maxZ int) {
	fillArenaBox(root, arenaBox{
		minX: minX,
		minY: minY,
		minZ: minZ,
		maxX: maxX,
		maxY: maxY,
		maxZ: maxZ,
	}, texture)
}

func addArenaEntity(gameMap *GameMap, entityType C.EntityType, x, y, z float32, attrs ...int16) {
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

var blockGlyphs = map[rune][]string{
	'B': {"11110", "10001", "11110", "10001", "11110"},
	'C': {"01111", "10000", "10000", "10000", "01111"},
	'E': {"11111", "10000", "11110", "10000", "11111"},
	'N': {"10001", "11001", "10101", "10011", "10001"},
	'O': {"01110", "10001", "10001", "10001", "01110"},
	'R': {"11110", "10001", "11110", "10100", "10010"},
	'U': {"10001", "10001", "10001", "10001", "01110"},
}

func addBlockWord(
	root *Cube,
	word string,
	startX, wallY, baseZ int,
	textures []uint16,
) {
	for letterIndex, character := range word {
		glyph, ok := blockGlyphs[character]
		if !ok {
			continue
		}
		texture := textures[letterIndex%len(textures)]
		letterX := startX + letterIndex*96
		for row, pixels := range glyph {
			for column, pixel := range pixels {
				if pixel != '1' {
					continue
				}
				x := letterX + column*16
				z := baseZ + (len(glyph)-1-row)*16
				addArenaBox(root, texture, x, wallY, z, x+16, wallY+16, z+16)
			}
		}
	}
}

func addBouncecoreWallMural(root *Cube) {
	// The words are physical voxel lettering rather than a repeating texture.
	addBlockWord(
		root,
		"BOUNCE",
		232,
		176,
		336,
		[]uint16{textureCyan, textureLime, textureMagenta},
	)
	addBlockWord(
		root,
		"CORE",
		328,
		176,
		240,
		[]uint16{textureMagenta, textureCyan, textureLime},
	)

	// A block-built neon frame anchors the mural to the largest venue wall.
	addArenaBox(root, textureLime, 208, 176, 208, 816, 192, 224)
	addArenaBox(root, textureLime, 208, 176, 416, 816, 192, 432)
	addArenaBox(root, textureCyan, 208, 176, 224, 224, 192, 416)
	addArenaBox(root, textureMagenta, 800, 176, 224, 816, 192, 416)
}

func addBlockTree(root *Cube, x, y int) {
	addArenaBox(root, textureDirt, x-16, y-16, 192, x+48, y+48, 208)
	addArenaBox(root, textureWood, x, y, 208, x+32, y+32, 288)
	addArenaBox(root, textureLeaves, x-32, y-32, 272, x+64, y+64, 304)
	addArenaBox(root, textureLeaves, x-16, y-48, 288, x+48, y+80, 320)
	addArenaBox(root, textureLeaves, x-16, y-16, 304, x+48, y+48, 336)
}

func addBlockSpeaker(root *Cube, minX, minY, maxX, maxY, maxZ int) {
	addArenaBox(root, textureStone, minX, minY, 192, maxX, maxY, 208)
	addArenaBox(root, textureSpeaker, minX, minY, 208, maxX, maxY, maxZ)
	addArenaBox(root, textureBlackstone, minX, minY, maxZ, maxX, maxY, maxZ+16)
}

func addWestClubHouse(root *Cube) {
	addArenaBox(root, textureStone, 144, 320, 192, 320, 704, 208)
	addArenaBox(root, textureWood, 152, 336, 208, 176, 688, 320)
	addArenaBox(root, textureWood, 176, 336, 208, 304, 360, 320)
	addArenaBox(root, textureWood, 176, 664, 208, 304, 688, 320)
	addArenaBox(root, textureWood, 288, 336, 208, 304, 400, 320)
	addArenaBox(root, textureWood, 288, 464, 208, 304, 560, 320)
	addArenaBox(root, textureWood, 288, 624, 208, 304, 688, 320)
	addArenaBox(root, textureGlass, 152, 384, 240, 176, 448, 288)
	addArenaBox(root, textureGlass, 152, 576, 240, 176, 640, 288)
	addArenaBox(root, textureDoor, 152, 480, 208, 176, 544, 304)
	addArenaBox(root, textureCyan, 288, 400, 304, 304, 464, 320)
	addArenaBox(root, textureCyan, 288, 560, 304, 304, 624, 320)
	addArenaBox(root, textureRoof, 144, 320, 320, 320, 704, 336)
	addArenaBox(root, textureRoof, 160, 336, 336, 304, 688, 352)
}

func addEastClubHouse(root *Cube) {
	addArenaBox(root, textureStone, 704, 320, 192, 880, 704, 208)
	addArenaBox(root, textureWood, 848, 336, 208, 872, 688, 320)
	addArenaBox(root, textureWood, 720, 336, 208, 848, 360, 320)
	addArenaBox(root, textureWood, 720, 664, 208, 848, 688, 320)
	addArenaBox(root, textureWood, 720, 336, 208, 736, 400, 320)
	addArenaBox(root, textureWood, 720, 464, 208, 736, 560, 320)
	addArenaBox(root, textureWood, 720, 624, 208, 736, 688, 320)
	addArenaBox(root, textureGlass, 848, 384, 240, 872, 448, 288)
	addArenaBox(root, textureGlass, 848, 576, 240, 872, 640, 288)
	addArenaBox(root, textureDoor, 848, 480, 208, 872, 544, 304)
	addArenaBox(root, textureMagenta, 720, 400, 304, 736, 464, 320)
	addArenaBox(root, textureMagenta, 720, 560, 304, 736, 624, 320)
	addArenaBox(root, textureRoof, 704, 320, 320, 880, 704, 336)
	addArenaBox(root, textureRoof, 720, 336, 336, 864, 688, 352)
}

func addNeonVaultGeometry(root *Cube) {
	// Material-correct voxel terrain: dirt supports grass, with stone boundary
	// walls and a block-cloud ceiling that reads as an open night sky.
	addArenaBox(root, textureDirt, 128, 128, 144, 896, 896, 176)
	addArenaBox(root, textureGrass, 128, 128, 176, 896, 896, 192)
	addArenaBox(root, textureStone, 128, 128, 192, 152, 896, 320)
	addArenaBox(root, textureStone, 872, 128, 192, 896, 896, 320)
	addArenaBox(root, textureStone, 152, 128, 192, 872, 152, 320)
	addArenaBox(root, textureStone, 152, 872, 192, 872, 896, 320)
	addArenaBox(root, textureSky, 128, 128, 440, 896, 896, 464)

	// Cobblestone paths join every venue zone. The central plaza uses solid
	// neon blocks in a checker pattern with no repeated wording.
	addArenaBox(root, texturePath, 480, 192, 192, 544, 832, 208)
	addArenaBox(root, texturePath, 304, 480, 192, 720, 544, 208)
	addArenaBox(root, texturePath, 336, 336, 192, 688, 688, 208)
	for row := 0; row < 5; row++ {
		for column := 0; column < 5; column++ {
			texture := []uint16{textureCyan, textureMagenta, textureLime}[(row+column)%3]
			minX := 352 + column*64
			minY := 352 + row*64
			addArenaBox(root, texture, minX, minY, 192, minX+48, minY+48, 208)
		}
	}

	addWestClubHouse(root)
	addEastClubHouse(root)

	// Team flags sit on stone-and-neon plinths inside timber club houses.
	addArenaBox(root, textureStone, 192, 472, 208, 256, 552, 224)
	addArenaBox(root, textureCyan, 208, 488, 224, 240, 536, 240)
	addArenaBox(root, textureStone, 768, 472, 208, 832, 552, 224)
	addArenaBox(root, textureMagenta, 784, 488, 224, 816, 536, 240)

	// The main nightclub is a block-built stone stage and blackstone facade.
	// Its physical BOUNCE / CORE mural spans the largest wall.
	addArenaBox(root, textureBlackstone, 208, 152, 192, 816, 176, 440)
	addArenaBox(root, textureRoof, 192, 144, 432, 832, 192, 448)
	addArenaBox(root, textureStone, 288, 176, 192, 736, 304, 224)
	addArenaBox(root, textureWood, 288, 176, 224, 304, 304, 352)
	addArenaBox(root, textureWood, 720, 176, 224, 736, 304, 352)
	addArenaBox(root, textureDoor, 224, 176, 192, 288, 192, 304)
	addArenaBox(root, textureDoor, 736, 176, 192, 800, 192, 304)
	addArenaBox(root, textureBooth, 400, 240, 224, 624, 288, 288)
	addBlockSpeaker(root, 304, 192, 368, 256, 336)
	addBlockSpeaker(root, 656, 192, 720, 256, 336)
	addBouncecoreWallMural(root)

	// Broad block stairs make the DJ stage playable.
	addArenaBox(root, textureStone, 352, 304, 192, 416, 320, 224)
	addArenaBox(root, textureStone, 352, 320, 192, 416, 336, 208)
	addArenaBox(root, textureStone, 608, 304, 192, 672, 320, 224)
	addArenaBox(root, textureStone, 608, 320, 192, 672, 336, 208)

	// A timber footbridge joins both houses, with stone supports and wooden
	// stairs. It supplies the upper combat route without floating blocks.
	addArenaBox(root, textureWood, 304, 480, 288, 720, 544, 304)
	addArenaBox(root, textureWood, 304, 480, 304, 720, 496, 320)
	addArenaBox(root, textureWood, 304, 528, 304, 720, 544, 320)
	addArenaBox(root, textureStone, 304, 480, 208, 336, 544, 288)
	addArenaBox(root, textureStone, 688, 480, 208, 720, 544, 288)
	for step := 0; step < 6; step++ {
		leftX := 208 + step*16
		rightX := 816 - (step+1)*16
		top := 224 + step*16
		addArenaBox(root, textureWood, leftX, 496, 208, leftX+16, 528, top)
		addArenaBox(root, textureWood, rightX, 496, 208, rightX+16, 528, top)
	}

	// Trees use dirt roots, wooden trunks and leaf canopies. Their placement
	// frames routes and supplies natural cover without blocking spawn doors.
	addBlockTree(root, 176, 256)
	addBlockTree(root, 816, 256)
	addBlockTree(root, 176, 752)
	addBlockTree(root, 816, 752)

	// South-side wooden market bars and a large timber entrance gate complete
	// the outdoor block-party venue.
	addArenaBox(root, textureStone, 224, 736, 192, 400, 784, 208)
	addArenaBox(root, textureWood, 224, 736, 208, 400, 784, 256)
	addArenaBox(root, textureStone, 624, 736, 192, 800, 784, 208)
	addArenaBox(root, textureWood, 624, 736, 208, 800, 784, 256)
	addArenaBox(root, textureWood, 416, 800, 192, 464, 832, 336)
	addArenaBox(root, textureWood, 560, 800, 192, 608, 832, 336)
	addArenaBox(root, textureRoof, 400, 784, 320, 624, 848, 352)
	addArenaBox(root, textureLime, 464, 800, 320, 560, 832, 336)
	addArenaBox(root, textureDoor, 472, 856, 192, 552, 872, 304)
}

func addNeonVaultEntities(gameMap *GameMap) {
	// Team starts face out of their houses. Untagged starts cover the stage and
	// south courtyard for FFA.
	for _, spawn := range []struct {
		x     float32
		y     float32
		angle int16
		team  int16
	}{
		{208, 400, 90, 1}, {208, 512, 90, 1}, {208, 624, 90, 1},
		{272, 384, 90, 1}, {272, 640, 90, 1},
		{816, 400, 270, 2}, {816, 512, 270, 2}, {816, 624, 270, 2},
		{752, 384, 270, 2}, {752, 640, 270, 2},
		{424, 304, 0, 0}, {600, 304, 180, 0},
		{424, 752, 0, 0}, {600, 752, 180, 0},
	} {
		addArenaEntity(gameMap, C.EntityTypePlayerStart, spawn.x, spawn.y, 232, spawn.angle, spawn.team)
	}

	addArenaEntity(gameMap, C.EntityTypeFlag, 224, 512, 256, 90, 1)
	addArenaEntity(gameMap, C.EntityTypeFlag, 800, 512, 256, 270, 2)

	for _, position := range [][3]float32{
		{432, 384, 232}, {592, 384, 232}, {432, 640, 232}, {592, 640, 232},
	} {
		addArenaEntity(gameMap, C.EntityTypeRockets, position[0], position[1], position[2])
	}
	for _, position := range [][3]float32{
		{288, 256, 216}, {736, 256, 216}, {288, 800, 216}, {736, 800, 216},
	} {
		addArenaEntity(gameMap, C.EntityTypeGrenades, position[0], position[1], position[2])
	}
	for _, position := range [][3]float32{
		{336, 512, 232}, {688, 512, 232}, {512, 304, 232}, {512, 752, 216},
	} {
		addArenaEntity(gameMap, C.EntityTypeHealth, position[0], position[1], position[2])
	}
	addArenaEntity(gameMap, C.EntityTypeQuad, 512, 512, 240)
	addArenaEntity(gameMap, C.EntityTypeGreenArmour, 512, 320, 232)
	addArenaEntity(gameMap, C.EntityTypeYellowArmour, 512, 816, 216)

	// A daylight base layer keeps the voxel materials readable. Local coloured
	// lights retain Bouncecore's rave identity around the stage and team rooms.
	for _, light := range []struct {
		x, y, z float32
		r, g, b int16
		radius  int16
	}{
		{512, 512, 400, 185, 210, 255, 420},
		{224, 512, 304, 0, 190, 255, 176},
		{800, 512, 304, 255, 28, 188, 176},
		{384, 256, 352, 0, 220, 255, 176},
		{640, 256, 352, 255, 40, 200, 176},
		{512, 256, 384, 164, 255, 0, 208},
		{512, 640, 352, 255, 120, 32, 176},
		{512, 816, 320, 220, 240, 255, 144},
	} {
		addArenaEntity(gameMap, C.EntityTypeLight, light.x, light.y, light.z, light.radius, light.r, light.g, light.b)
	}
}

func verifyNeonVault(outputPath string) error {
	decoded, err := FromFile(outputPath)
	if err != nil {
		return fmt.Errorf("decode generated arena: %w", err)
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

	if decoded.Header.WorldSize != neonVaultWorldSize {
		return fmt.Errorf("generated arena world size is %d", decoded.Header.WorldSize)
	}
	if playerStarts != 14 || flags != 2 {
		return fmt.Errorf(
			"generated arena has %d player starts and %d flags",
			playerStarts,
			flags,
		)
	}

	return nil
}

// BuildNeonVault creates a balanced voxel arena for FFA, TDM and CTF.
func BuildNeonVault(outputPath string) error {
	gameMap, err := NewMap()
	if err != nil {
		return fmt.Errorf("create map: %w", err)
	}
	defer gameMap.Destroy()

	gameMap.WorldRoot = newArenaRoot()
	gameMap.Entities = make([]Entity, 0, 48)
	addNeonVaultGeometry(gameMap.WorldRoot)
	addNeonVaultEntities(gameMap)

	if err := gameMap.ToFile(outputPath); err != nil {
		return fmt.Errorf("write Neon Vault map: %w", err)
	}
	return verifyNeonVault(outputPath)
}
