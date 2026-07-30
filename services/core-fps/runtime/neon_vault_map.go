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

func addNeonVaultGeometry(root *Cube) {
	// Main floor, roof and arena shell.
	addArenaBox(root, textureFloor, 128, 128, 144, 896, 896, 192)
	addArenaBox(root, textureWall, 128, 128, 192, 152, 896, 456)
	addArenaBox(root, textureWall, 872, 128, 192, 896, 896, 456)
	addArenaBox(root, textureWall, 152, 128, 192, 872, 152, 456)
	addArenaBox(root, textureWall, 152, 872, 192, 872, 896, 456)
	addArenaBox(root, textureWall, 128, 128, 440, 896, 896, 464)

	// Cyan and magenta team clubs, each with two open entrances.
	addArenaBox(root, textureCyan, 152, 288, 192, 248, 312, 344)
	addArenaBox(root, textureCyan, 152, 712, 192, 248, 736, 344)
	addArenaBox(root, textureCyan, 152, 288, 320, 304, 736, 344)
	addArenaBox(root, textureCyan, 280, 312, 192, 304, 424, 288)
	addArenaBox(root, textureCyan, 280, 600, 192, 304, 712, 288)

	addArenaBox(root, textureMagenta, 776, 288, 192, 872, 312, 344)
	addArenaBox(root, textureMagenta, 776, 712, 192, 872, 736, 344)
	addArenaBox(root, textureMagenta, 720, 288, 320, 872, 736, 344)
	addArenaBox(root, textureMagenta, 720, 312, 192, 744, 424, 288)
	addArenaBox(root, textureMagenta, 720, 600, 192, 744, 712, 288)

	// Branded flag plinths and cover inside each base.
	addArenaBox(root, textureBrand, 192, 472, 192, 256, 552, 208)
	addArenaBox(root, textureBrand, 768, 472, 192, 832, 552, 208)
	addArenaBox(root, textureTrim, 224, 360, 192, 248, 408, 248)
	addArenaBox(root, textureTrim, 224, 616, 192, 248, 664, 248)
	addArenaBox(root, textureTrim, 776, 360, 192, 800, 408, 248)
	addArenaBox(root, textureTrim, 776, 616, 192, 800, 664, 248)

	// Central dancefloor and four speaker-stack cover columns.
	addArenaBox(root, textureFloor, 384, 336, 192, 640, 688, 208)
	addArenaBox(root, textureLime, 360, 312, 192, 392, 360, 280)
	addArenaBox(root, textureLime, 632, 312, 192, 664, 360, 280)
	addArenaBox(root, textureLime, 360, 664, 192, 392, 712, 280)
	addArenaBox(root, textureLime, 632, 664, 192, 664, 712, 280)
	addArenaBox(root, textureBrand, 480, 480, 208, 544, 544, 240)

	// Upper catwalk with open sight lines below it.
	addArenaBox(root, textureTrim, 312, 496, 288, 712, 528, 304)
	addArenaBox(root, textureCyan, 312, 488, 304, 712, 496, 328)
	addArenaBox(root, textureMagenta, 312, 528, 304, 712, 536, 328)
	addArenaBox(root, textureWall, 312, 496, 192, 328, 528, 288)
	addArenaBox(root, textureWall, 696, 496, 192, 712, 528, 288)

	// Walkable stairs onto the catwalk from both team sides.
	for step := 0; step < 6; step++ {
		leftX := 256 + step*16
		rightX := 768 - (step+1)*16
		top := 208 + step*16
		addArenaBox(root, textureTrim, leftX, 496, 192, leftX+16, 528, top)
		addArenaBox(root, textureTrim, rightX, 496, 192, rightX+16, 528, top)
	}

	// Side-route stages and low cover, mirrored for competitive balance.
	addArenaBox(root, textureCyan, 304, 184, 192, 424, 216, 224)
	addArenaBox(root, textureMagenta, 600, 184, 192, 720, 216, 224)
	addArenaBox(root, textureCyan, 304, 808, 192, 424, 840, 224)
	addArenaBox(root, textureMagenta, 600, 808, 192, 720, 840, 224)
	addArenaBox(root, textureWall, 488, 232, 192, 536, 264, 256)
	addArenaBox(root, textureWall, 488, 760, 192, 536, 792, 256)

	// Ceiling lighting trusses.
	addArenaBox(root, textureCyan, 248, 248, 416, 776, 256, 440)
	addArenaBox(root, textureMagenta, 248, 768, 416, 776, 776, 440)
	addArenaBox(root, textureLime, 504, 256, 416, 520, 768, 440)
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
		{336, 256, 216}, {688, 256, 216}, {336, 768, 216}, {688, 768, 216},
	} {
		addArenaEntity(gameMap, C.EntityTypeGrenades, position[0], position[1], position[2])
	}
	for _, position := range [][3]float32{
		{336, 512, 216}, {688, 512, 216}, {512, 288, 216}, {512, 736, 216},
	} {
		addArenaEntity(gameMap, C.EntityTypeHealth, position[0], position[1], position[2])
	}
	addArenaEntity(gameMap, C.EntityTypeQuad, 512, 512, 248)
	addArenaEntity(gameMap, C.EntityTypeGreenArmour, 512, 200, 216)
	addArenaEntity(gameMap, C.EntityTypeYellowArmour, 512, 824, 216)

	// Low-radius coloured lights give the geometry its rave identity without
	// flooding the whole arena or making opponents hard to read.
	for _, light := range []struct {
		x, y, z float32
		r, g, b int16
		radius  int16
	}{
		{224, 512, 288, 0, 180, 255, 176},
		{800, 512, 288, 255, 20, 180, 176},
		{512, 336, 320, 80, 255, 0, 160},
		{512, 688, 320, 255, 120, 0, 160},
		{384, 512, 400, 0, 220, 255, 176},
		{640, 512, 400, 255, 30, 220, 176},
		{512, 512, 400, 160, 80, 255, 208},
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
