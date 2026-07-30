package maps

import (
	"fmt"

	C "github.com/cfoust/sour/pkg/game/constants"
)

const (
	neonVaultWorldSize = 1024
	neonVaultGridSize  = 16

	textureFloor uint16 = 2 + iota
	textureWall
	textureTrim
	textureCyan
	textureMagenta
	textureLime
	textureBrand
	textureDoor
	textureSpeaker
	textureBooth
	textureArch
	textureCeiling
	textureStage
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

func addNightclubArchX(
	root *Cube,
	frameTexture uint16,
	accentTexture uint16,
	minX, maxX, openingMinY, openingMaxY int,
) {
	addArenaBox(root, frameTexture, minX, openingMinY-16, 192, maxX, openingMinY, 304)
	addArenaBox(root, frameTexture, minX, openingMaxY, 192, maxX, openingMaxY+16, 304)
	addArenaBox(root, frameTexture, minX, openingMinY-32, 288, maxX, openingMinY, 320)
	addArenaBox(root, frameTexture, minX, openingMaxY, 288, maxX, openingMaxY+32, 320)
	addArenaBox(root, frameTexture, minX, openingMinY-32, 304, maxX, openingMaxY+32, 336)
	addArenaBox(root, accentTexture, minX, openingMinY, 304, maxX, openingMaxY, 320)
}

func addNightclubArchY(
	root *Cube,
	frameTexture uint16,
	accentTexture uint16,
	minY, maxY, openingMinX, openingMaxX int,
) {
	addArenaBox(root, frameTexture, openingMinX-16, minY, 192, openingMinX, maxY, 304)
	addArenaBox(root, frameTexture, openingMaxX, minY, 192, openingMaxX+16, maxY, 304)
	addArenaBox(root, frameTexture, openingMinX-32, minY, 288, openingMinX, maxY, 320)
	addArenaBox(root, frameTexture, openingMaxX, minY, 288, openingMaxX+32, maxY, 320)
	addArenaBox(root, frameTexture, openingMinX-32, minY, 304, openingMaxX+32, maxY, 336)
	addArenaBox(root, accentTexture, openingMinX, minY, 304, openingMaxX, maxY, 320)
}

func addSpeakerStack(root *Cube, minX, minY, maxX, maxY, maxZ int) {
	addArenaBox(root, textureTrim, minX-8, minY-8, 192, maxX+8, maxY+8, 208)
	addArenaBox(root, textureSpeaker, minX, minY, 208, maxX, maxY, maxZ-16)
	addArenaBox(root, textureTrim, minX-8, minY-8, maxZ-16, maxX+8, maxY+8, maxZ)
}

func addNeonVaultGeometry(root *Cube) {
	// A complete enclosed venue shell: polished club floor, acoustic walls and
	// a lighting-grid ceiling.
	addArenaBox(root, textureFloor, 128, 128, 144, 896, 896, 192)
	addArenaBox(root, textureWall, 128, 128, 192, 152, 896, 456)
	addArenaBox(root, textureWall, 872, 128, 192, 896, 896, 456)
	addArenaBox(root, textureWall, 152, 128, 192, 872, 152, 456)
	addArenaBox(root, textureWall, 152, 872, 192, 872, 896, 456)
	addArenaBox(root, textureCeiling, 128, 128, 440, 896, 896, 464)

	// Mirrored cyan and magenta club rooms make the team bases feel like
	// genuine side lounges. Each room has two playable arched entrances and
	// a locked backstage door on its rear wall.
	addArenaBox(root, textureCyan, 152, 304, 320, 304, 720, 344)
	addArenaBox(root, textureWall, 280, 304, 192, 304, 352, 320)
	addArenaBox(root, textureWall, 280, 464, 192, 304, 560, 320)
	addArenaBox(root, textureWall, 280, 672, 192, 304, 720, 320)
	addArenaBox(root, textureCyan, 152, 304, 192, 168, 720, 336)
	addArenaBox(root, textureDoor, 152, 472, 192, 168, 552, 304)
	addNightclubArchX(root, textureArch, textureCyan, 272, 312, 368, 448)
	addNightclubArchX(root, textureArch, textureCyan, 272, 312, 576, 656)

	addArenaBox(root, textureMagenta, 720, 304, 320, 872, 720, 344)
	addArenaBox(root, textureWall, 720, 304, 192, 744, 352, 320)
	addArenaBox(root, textureWall, 720, 464, 192, 744, 560, 320)
	addArenaBox(root, textureWall, 720, 672, 192, 744, 720, 320)
	addArenaBox(root, textureMagenta, 856, 304, 192, 872, 720, 336)
	addArenaBox(root, textureDoor, 856, 472, 192, 872, 552, 304)
	addNightclubArchX(root, textureArch, textureMagenta, 712, 752, 368, 448)
	addNightclubArchX(root, textureArch, textureMagenta, 712, 752, 576, 656)

	// Branded flag plinths, low lounge dividers and venue speakers protect each
	// base without turning either one into a dead end.
	addArenaBox(root, textureBrand, 192, 472, 192, 256, 552, 208)
	addArenaBox(root, textureBrand, 768, 472, 192, 832, 552, 208)
	addArenaBox(root, textureBooth, 184, 336, 192, 256, 368, 240)
	addArenaBox(root, textureBooth, 184, 656, 192, 256, 688, 240)
	addArenaBox(root, textureBooth, 768, 336, 192, 840, 368, 240)
	addArenaBox(root, textureBooth, 768, 656, 192, 840, 688, 240)

	// The central illuminated dance floor is the primary combat space. Four
	// real speaker stacks mark its corners and provide readable cover.
	addArenaBox(root, textureLime, 336, 336, 192, 688, 688, 208)
	addArenaBox(root, textureTrim, 320, 320, 192, 704, 336, 208)
	addArenaBox(root, textureTrim, 320, 688, 192, 704, 704, 208)
	addArenaBox(root, textureTrim, 320, 336, 192, 336, 688, 208)
	addArenaBox(root, textureTrim, 688, 336, 192, 704, 688, 208)
	addSpeakerStack(root, 304, 304, 344, 352, 304)
	addSpeakerStack(root, 680, 304, 720, 352, 304)
	addSpeakerStack(root, 304, 672, 344, 720, 304)
	addSpeakerStack(root, 680, 672, 720, 720, 304)

	// A raised, branded DJ stage is the visual anchor of the venue. The booth,
	// twin sound systems, backstage doors and broad stairs are all physical.
	addArenaBox(root, textureStage, 336, 168, 192, 688, 288, 224)
	addArenaBox(root, textureBrand, 368, 168, 224, 656, 184, 368)
	addArenaBox(root, textureDoor, 240, 152, 192, 320, 168, 304)
	addArenaBox(root, textureDoor, 704, 152, 192, 784, 168, 304)
	addArenaBox(root, textureBooth, 416, 232, 224, 608, 272, 280)
	addSpeakerStack(root, 304, 176, 360, 240, 352)
	addSpeakerStack(root, 664, 176, 720, 240, 352)
	addNightclubArchY(root, textureArch, textureLime, 200, 232, 384, 640)
	addArenaBox(root, textureTrim, 384, 200, 352, 640, 216, 368)
	for step := 0; step < 2; step++ {
		minY := 288 + step*16
		top := 224 - step*16
		addArenaBox(root, textureStage, 352, minY, 192, 416, minY+16, top)
		addArenaBox(root, textureStage, 608, minY, 192, 672, minY+16, top)
	}

	// A balcony crosses the room like a nightclub lighting gallery. The wide
	// arch below keeps the dance-floor sight line open.
	addArenaBox(root, textureStage, 304, 480, 288, 720, 544, 304)
	addArenaBox(root, textureCyan, 304, 480, 304, 720, 496, 328)
	addArenaBox(root, textureMagenta, 304, 528, 304, 720, 544, 328)
	addNightclubArchY(root, textureArch, textureLime, 480, 496, 368, 656)
	addNightclubArchY(root, textureArch, textureLime, 528, 544, 368, 656)

	// Walkable stairs onto the balcony from both team lounges.
	for step := 0; step < 6; step++ {
		leftX := 256 + step*16
		rightX := 768 - (step+1)*16
		top := 208 + step*16
		addArenaBox(root, textureStage, leftX, 496, 192, leftX+16, 528, top)
		addArenaBox(root, textureStage, rightX, 496, 192, rightX+16, 528, top)
	}

	// The south end reads as a venue entrance: a broad central arch leads into
	// a vestibule, flanked by two service doors and mirrored bar counters.
	addArenaBox(root, textureWall, 152, 808, 192, 416, 832, 336)
	addArenaBox(root, textureWall, 608, 808, 192, 872, 832, 336)
	addNightclubArchY(root, textureArch, textureLime, 800, 840, 432, 592)
	addArenaBox(root, textureDoor, 472, 856, 192, 552, 872, 304)
	addArenaBox(root, textureDoor, 256, 792, 192, 336, 808, 304)
	addArenaBox(root, textureDoor, 688, 792, 192, 768, 808, 304)
	addArenaBox(root, textureBooth, 208, 736, 192, 400, 768, 240)
	addArenaBox(root, textureBooth, 624, 736, 192, 816, 768, 240)

	// Structural ceiling trusses and coloured rails sell the scale of the room
	// while staying above all player movement and projectile lanes.
	addArenaBox(root, textureTrim, 224, 248, 416, 800, 264, 440)
	addArenaBox(root, textureTrim, 224, 760, 416, 800, 776, 440)
	addArenaBox(root, textureTrim, 248, 248, 416, 264, 776, 440)
	addArenaBox(root, textureTrim, 760, 248, 416, 776, 776, 440)
	addArenaBox(root, textureCyan, 384, 248, 424, 400, 776, 440)
	addArenaBox(root, textureMagenta, 624, 248, 424, 640, 776, 440)
}

func addNeonVaultEntities(gameMap *GameMap) {
	// Team starts. Tags 1 and 2 are also valid general spawns in FFA.
	for _, spawn := range []struct {
		x     float32
		y     float32
		angle int16
		team  int16
	}{
		{208, 400, 90, 1}, {208, 512, 90, 1}, {208, 624, 90, 1},
		{272, 352, 90, 1}, {272, 672, 90, 1},
		{816, 400, 270, 2}, {816, 512, 270, 2}, {816, 624, 270, 2},
		{752, 352, 270, 2}, {752, 672, 270, 2},
		{424, 272, 0, 0}, {600, 272, 180, 0},
		{424, 752, 0, 0}, {600, 752, 180, 0},
	} {
		addArenaEntity(gameMap, C.EntityTypePlayerStart, spawn.x, spawn.y, 216, spawn.angle, spawn.team)
	}

	addArenaEntity(gameMap, C.EntityTypeFlag, 224, 512, 216, 90, 1)
	addArenaEntity(gameMap, C.EntityTypeFlag, 800, 512, 216, 270, 2)

	// Weapon and health loops keep all three modes moving through the whole map.
	for _, position := range [][3]float32{
		{432, 384, 216}, {592, 384, 216}, {432, 640, 216}, {592, 640, 216},
	} {
		addArenaEntity(gameMap, C.EntityTypeRockets, position[0], position[1], position[2])
	}
	for _, position := range [][3]float32{
		{288, 256, 216}, {736, 256, 216}, {288, 768, 216}, {736, 768, 216},
	} {
		addArenaEntity(gameMap, C.EntityTypeGrenades, position[0], position[1], position[2])
	}
	for _, position := range [][3]float32{
		{336, 512, 216}, {688, 512, 216}, {512, 288, 216}, {512, 736, 216},
	} {
		addArenaEntity(gameMap, C.EntityTypeHealth, position[0], position[1], position[2])
	}
	addArenaEntity(gameMap, C.EntityTypeQuad, 512, 512, 232)
	addArenaEntity(gameMap, C.EntityTypeGreenArmour, 512, 304, 216)
	addArenaEntity(gameMap, C.EntityTypeYellowArmour, 512, 784, 216)

	// Low-radius coloured lights give the geometry its rave identity without
	// flooding the whole arena or making opponents hard to read.
	for _, light := range []struct {
		x, y, z float32
		r, g, b int16
		radius  int16
	}{
		{224, 512, 288, 0, 180, 255, 176},
		{800, 512, 288, 255, 20, 180, 176},
		{512, 224, 352, 164, 255, 0, 192},
		{512, 352, 320, 80, 255, 0, 160},
		{512, 672, 320, 255, 120, 0, 160},
		{384, 512, 400, 0, 220, 255, 176},
		{640, 512, 400, 255, 30, 220, 176},
		{512, 512, 400, 160, 80, 255, 208},
		{512, 824, 320, 255, 255, 255, 144},
		{272, 512, 304, 0, 160, 255, 144},
		{752, 512, 304, 255, 20, 180, 144},
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

// BuildNeonVault creates a balanced arena for FFA, team deathmatch and CTF.
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
