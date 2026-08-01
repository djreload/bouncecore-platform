"use client";

import {
  Box,
  Boxes,
  ChevronDown,
  Circle,
  Copy,
  Crosshair,
  Download,
  FilePlus2,
  Flag,
  Lightbulb,
  MousePointer2,
  PackageOpen,
  Redo2,
  Rotate3D,
  Save,
  Search,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn
} from "lucide-react";
import Link from "next/link";
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import {
  coreLevelEntityCatalog,
  coreLevelGridSizes,
  coreLevelShapeCatalog,
  coreLevelTextureCatalog,
  coreLevelWorldSizes,
  createCoreLevelObject,
  createEmptyCoreLevelDocument,
  normalizeCoreLevelDocument,
  snapCoreLevelValue,
  validateCoreLevelDocument,
  type CoreLevelDocument,
  type CoreLevelEntityKind,
  type CoreLevelObject,
  type CoreLevelShape,
  type CoreLevelTeam,
  type CoreLevelTextureDefinition,
  type CoreLevelTransform
} from "@/lib/games/core-level-builder-core";
import type { CoreLevelProject } from "@/lib/games/core-level-builder-service";

type ProjectSummary = {
  createdAt: string;
  description: string;
  id: string;
  name: string;
  objectCount: number;
  previewUrl: string | null;
  publishedAt: string | null;
  publishedDefinitionUrl: string | null;
  publishedVersion: number;
  slug: string;
  status: "draft" | "published";
  updatedAt: string;
  validation: ReturnType<typeof validateCoreLevelDocument>;
};

type BuilderData = {
  activeProject: CoreLevelProject | null;
  projects: ProjectSummary[];
};

type ToolMode = "rotate" | "scale" | "translate";
type PaletteTab = "entities" | "geometry" | "textures";

type CoreLevelBuilderProps = {
  initialData: BuilderData;
};

type LevelViewportProps = {
  document: CoreLevelDocument;
  onCaptureReady: (capture: () => string | null) => void;
  onSelectionChange: (objectId: string | null) => void;
  onTransformCommit: (objectId: string, transform: CoreLevelTransform) => void;
  selectedObjectId: string | null;
  toolMode: ToolMode;
};

const apiPath = "/api/admin/core-fps/levels";

function cloneDocument(document: CoreLevelDocument) {
  return structuredClone(document);
}

function fileDownload(name: string, body: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function entityColor(object: CoreLevelObject) {
  const team = object.properties?.team ?? 0;
  if (team === 1) return 0xff416c;
  if (team === 2) return 0x22bdf5;
  if (object.entityKind === "health") return 0xb6ff2e;
  if (object.entityKind === "light") return 0xffd56a;
  if (object.entityKind === "flag") return 0xff2bd6;
  return 0x00d5ff;
}

function wedgeGeometry() {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
    -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5,
    -0.5, 0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, -0.5
  ]);
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function materialFor(
  definition: CoreLevelTextureDefinition,
  textureLoader: THREE.TextureLoader
) {
  const texture = textureLoader.load(
    `/games/core/builder/textures/${definition.id}.png`
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 4;

  return new THREE.MeshStandardMaterial({
    color: definition.color,
    map: texture,
    metalness: definition.metalness,
    roughness: definition.roughness
  });
}

function geometryObject(
  object: CoreLevelObject,
  material: THREE.Material
): THREE.Object3D {
  if (object.shape === "stairs") {
    const group = new THREE.Group();
    for (let index = 0; index < 6; index++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1 / 6, 1, (index + 1) / 6), material);
      step.position.set(-0.5 + (index + 0.5) / 6, 0, -0.5 + (index + 1) / 12);
      group.add(step);
    }
    return group;
  }

  if (object.shape === "arch") {
    const group = new THREE.Group();
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1, 0.72), material);
    const right = left.clone();
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1, 0.28), material);
    left.position.set(-0.39, 0, -0.14);
    right.position.set(0.39, 0, -0.14);
    top.position.set(0, 0, 0.36);
    group.add(left, right, top);
    return group;
  }

  const geometry =
    object.shape === "sphere"
      ? new THREE.SphereGeometry(0.5, 28, 18)
      : object.shape === "cylinder"
        ? new THREE.CylinderGeometry(0.5, 0.5, 1, 28)
        : object.shape === "ramp"
          ? wedgeGeometry()
          : new THREE.BoxGeometry(1, 1, 1);
  return new THREE.Mesh(geometry, material);
}

function entityObject(object: CoreLevelObject) {
  const group = new THREE.Group();
  const color = entityColor(object);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.22,
    metalness: 0.35,
    roughness: 0.35
  });

  if (object.entityKind === "player-spawn") {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.08, 10, 30), material);
    ring.rotation.x = Math.PI / 2;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 4), material);
    arrow.position.z = -0.55;
    arrow.rotation.x = -Math.PI / 2;
    group.add(ring, arrow);
  } else if (object.entityKind === "flag") {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 10), material);
    pole.position.y = 0.25;
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.42), material);
    flag.position.set(0.34, 0.72, 0);
    group.add(pole, flag);
  } else if (object.entityKind === "light") {
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 12), material));
    const range = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 18, 12),
      new THREE.MeshBasicMaterial({ color, opacity: 0.1, transparent: true, wireframe: true })
    );
    group.add(range);
  } else if (object.entityKind?.includes("teleporter")) {
    group.add(new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.1, 12, 32), material));
  } else {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.18, 20), material);
    const item = new THREE.Mesh(
      object.entityKind === "health"
        ? new THREE.BoxGeometry(0.38, 0.8, 0.24)
        : new THREE.OctahedronGeometry(0.42),
      material
    );
    item.position.y = 0.45;
    group.add(base, item);
  }

  return group;
}

function applyCoreTransform(target: THREE.Object3D, transform: CoreLevelTransform) {
  target.position.set(transform.position.x, transform.position.z, transform.position.y);
  target.rotation.set(transform.rotation.x, transform.rotation.z, transform.rotation.y);
  target.scale.set(transform.scale.x, transform.scale.z, transform.scale.y);
}

function readCoreTransform(target: THREE.Object3D): CoreLevelTransform {
  return {
    position: {
      x: target.position.x,
      y: target.position.z,
      z: target.position.y
    },
    rotation: {
      x: target.rotation.x,
      y: target.rotation.z,
      z: target.rotation.y
    },
    scale: {
      x: Math.max(0.25, target.scale.x),
      y: Math.max(0.25, target.scale.z),
      z: Math.max(0.25, target.scale.y)
    }
  };
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial && material.map) {
          material.map.dispose();
        }
        material.dispose();
      });
    }
  });
}

function LevelViewport({
  document,
  onCaptureReady,
  onSelectionChange,
  onTransformCommit,
  selectedObjectId,
  toolMode
}: LevelViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const contextRef = useRef<{
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    grid: THREE.GridHelper;
    levelRoot: THREE.Group;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    transform: TransformControls;
  } | null>(null);
  const objectMapRef = useRef(new Map<string, THREE.Object3D>());
  const documentRef = useRef(document);
  const worldSizeRef = useRef(document.worldSize);
  const selectionCallbackRef = useRef(onSelectionChange);
  const transformCallbackRef = useRef(onTransformCommit);

  useEffect(() => {
    documentRef.current = document;
    selectionCallbackRef.current = onSelectionChange;
    transformCallbackRef.current = onTransformCommit;
  }, [document, onSelectionChange, onTransformCommit]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const initialDocument = documentRef.current;
    scene.background = new THREE.Color(initialDocument.skyColor);
    scene.fog = new THREE.Fog(
      initialDocument.fogColor,
      initialDocument.fog * 0.45,
      initialDocument.fog
    );

    const camera = new THREE.PerspectiveCamera(48, 1, 1, 8_192);
    camera.position.set(
      initialDocument.worldSize * 1.3,
      initialDocument.worldSize * 0.96,
      initialDocument.worldSize * 1.3
    );

    const renderer = new THREE.WebGLRenderer({
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance"
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 3_500;
    controls.minDistance = 60;
    controls.target.set(
      initialDocument.worldSize / 2,
      80,
      initialDocument.worldSize / 2
    );

    const transform = new TransformControls(camera, renderer.domElement);
    transform.setTranslationSnap(initialDocument.gridSize);
    transform.setRotationSnap(THREE.MathUtils.degToRad(90));
    transform.setScaleSnap(initialDocument.gridSize / 4);
    transform.addEventListener("dragging-changed", (event) => {
      controls.enabled = !event.value;
    });
    transform.addEventListener("mouseUp", () => {
      const object = transform.object;
      const id = typeof object?.userData.levelObjectId === "string" ? object.userData.levelObjectId : null;
      if (object && id) {
        transformCallbackRef.current(id, readCoreTransform(object));
      }
    });
    scene.add(transform.getHelper());

    const levelRoot = new THREE.Group();
    scene.add(levelRoot);

    const grid = new THREE.GridHelper(
      initialDocument.worldSize,
      initialDocument.worldSize / initialDocument.gridSize,
      0x00d5ff,
      0x243149
    );
    grid.position.set(
      initialDocument.worldSize / 2,
      0,
      initialDocument.worldSize / 2
    );
    (grid.material as THREE.Material).opacity = 0.34;
    (grid.material as THREE.Material).transparent = true;
    scene.add(grid);

    const hemisphere = new THREE.HemisphereLight(0xd8efff, 0x1b2530, 1.6);
    scene.add(hemisphere);
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(350, 850, 500);
    key.castShadow = true;
    scene.add(key);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointerDown = { x: 0, y: 0 };

    const onPointerDown = (event: PointerEvent) => {
      pointerDown.x = event.clientX;
      pointerDown.y = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (
        Math.abs(event.clientX - pointerDown.x) > 5 ||
        Math.abs(event.clientY - pointerDown.y) > 5
      ) {
        return;
      }

      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersections = raycaster.intersectObjects([...objectMapRef.current.values()], true);
      let current: THREE.Object3D | null = intersections[0]?.object ?? null;
      while (current && typeof current.userData.levelObjectId !== "string") {
        current = current.parent;
      }
      selectionCallbackRef.current(
        current && typeof current.userData.levelObjectId === "string"
          ? current.userData.levelObjectId
          : null
      );
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    let frame = 0;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    render();

    contextRef.current = { camera, controls, grid, levelRoot, renderer, scene, transform };
    onCaptureReady(() => {
      renderer.render(scene, camera);
      try {
        return renderer.domElement.toDataURL("image/png");
      } catch {
        return null;
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      transform.detach();
      transform.dispose();
      controls.dispose();
      levelRoot.children.forEach(disposeObject);
      const activeGrid = contextRef.current?.grid;
      if (activeGrid) {
        activeGrid.geometry.dispose();
        const materials = Array.isArray(activeGrid.material)
          ? activeGrid.material
          : [activeGrid.material];
        materials.forEach((material) => material.dispose());
      }
      renderer.dispose();
      renderer.domElement.remove();
      contextRef.current = null;
    };
  }, [onCaptureReady]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;

    context.scene.remove(context.grid);
    context.grid.geometry.dispose();
    const oldMaterials = Array.isArray(context.grid.material)
      ? context.grid.material
      : [context.grid.material];
    oldMaterials.forEach((material) => material.dispose());

    const grid = new THREE.GridHelper(
      document.worldSize,
      document.worldSize / document.gridSize,
      0x00d5ff,
      0x243149
    );
    grid.position.set(document.worldSize / 2, 0, document.worldSize / 2);
    const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
    materials.forEach((material) => {
      material.opacity = 0.34;
      material.transparent = true;
    });
    context.scene.add(grid);
    context.grid = grid;
    context.controls.target.set(document.worldSize / 2, 80, document.worldSize / 2);
    if (worldSizeRef.current !== document.worldSize) {
      context.camera.position.set(
        document.worldSize * 1.3,
        document.worldSize * 0.96,
        document.worldSize * 1.3
      );
      worldSizeRef.current = document.worldSize;
    }
    context.transform.setTranslationSnap(document.gridSize);
    context.transform.setScaleSnap(document.gridSize / 4);
  }, [document.gridSize, document.worldSize]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;

    context.scene.background = new THREE.Color(document.skyColor);
    context.scene.fog = new THREE.Fog(document.fogColor, document.fog * 0.45, document.fog);
    context.transform.detach();
    context.levelRoot.children.forEach(disposeObject);
    context.levelRoot.clear();
    objectMapRef.current.clear();
    const loader = new THREE.TextureLoader();
    const materialCache = new Map<string, THREE.Material>();

    for (const object of document.objects) {
      let rendered: THREE.Object3D;
      if (object.kind === "geometry") {
        const texture =
          coreLevelTextureCatalog.find((entry) => entry.id === object.materialId) ??
          coreLevelTextureCatalog[0];
        let material = materialCache.get(texture.id);
        if (!material) {
          material = materialFor(texture, loader);
          materialCache.set(texture.id, material);
        }
        rendered = geometryObject(object, material);
      } else {
        rendered = entityObject(object);
      }

      rendered.userData.levelObjectId = object.id;
      rendered.traverse((child) => {
        child.userData.levelObjectId = object.id;
        if (child instanceof THREE.Mesh) {
          child.castShadow = object.kind === "geometry";
          child.receiveShadow = object.kind === "geometry";
        }
      });
      applyCoreTransform(rendered, object.transform);
      context.levelRoot.add(rendered);
      objectMapRef.current.set(object.id, rendered);
    }

    const selected = selectedObjectId ? objectMapRef.current.get(selectedObjectId) : null;
    if (selected) context.transform.attach(selected);
  }, [document, selectedObjectId]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    context.transform.setMode(toolMode);
    context.transform.setSpace(toolMode === "scale" ? "local" : "world");
  }, [toolMode]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    context.transform.setTranslationSnap(document.gridSize);
    context.transform.setScaleSnap(document.gridSize / 4);
  }, [document.gridSize]);

  return (
    <div
      className="h-full min-h-0 w-full overflow-hidden bg-[#0b1119]"
      data-testid="core-level-builder-viewport"
      ref={hostRef}
    />
  );
}

function ToolbarButton({
  active = false,
  children,
  disabled = false,
  label,
  onClick
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={classNames(
        "bc-focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition",
        active
          ? "border-bc-electric bg-bc-electric/15 text-bc-electric"
          : "border-bc-line bg-bc-ink text-bc-muted hover:border-bc-electric/50 hover:text-white",
        disabled && "cursor-not-allowed opacity-40"
      )}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function NumericField({
  label,
  onChange,
  step = 1,
  value
}: {
  label: string;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-[10px] font-bold uppercase text-bc-muted">{label}</span>
      <input
        className="h-8 min-w-0 rounded border border-bc-line bg-bc-void px-2 text-xs text-white"
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="number"
        value={Number.isFinite(value) ? Number(value.toFixed(2)) : 0}
      />
    </label>
  );
}

function TransformFields({
  onChange,
  transform
}: {
  onChange: (transform: CoreLevelTransform) => void;
  transform: CoreLevelTransform;
}) {
  const update = (
    group: keyof CoreLevelTransform,
    axis: "x" | "y" | "z",
    value: number
  ) => {
    const storedValue =
      group === "rotation" ? THREE.MathUtils.degToRad(value) : value;
    onChange({
      ...transform,
      [group]: {
        ...transform[group],
        [axis]: Number.isFinite(storedValue) ? storedValue : transform[group][axis]
      }
    });
  };

  return (
    <div className="grid gap-3">
      {(["position", "rotation", "scale"] as const).map((group) => (
        <div key={group}>
          <p className="mb-1 text-xs font-semibold capitalize">
            {group === "rotation" ? "Rotation (degrees)" : group}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(["x", "y", "z"] as const).map((axis) => (
              <NumericField
                key={axis}
                label={axis}
                onChange={(value) => update(group, axis, value)}
                step={group === "rotation" ? 90 : 1}
                value={
                  group === "rotation"
                    ? Math.round(THREE.MathUtils.radToDeg(transform[group][axis]))
                    : transform[group][axis]
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CoreLevelBuilder({ initialData }: CoreLevelBuilderProps) {
  const [desktopViewport, setDesktopViewport] = useState(false);
  const initialDocument =
    initialData.activeProject?.document ?? createEmptyCoreLevelDocument();
  const [document, setDocument] = useState(() => cloneDocument(initialDocument));
  const [projectId, setProjectId] = useState<string | null>(
    initialData.activeProject?.id ?? null
  );
  const [projects, setProjects] = useState(initialData.projects);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
    initialDocument.objects[0]?.id ?? null
  );
  const [paletteTab, setPaletteTab] = useState<PaletteTab>("geometry");
  const [toolMode, setToolMode] = useState<ToolMode>("translate");
  const [search, setSearch] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState("stone-grey");
  const [busy, setBusy] = useState<"delete" | "publish" | "save" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [hierarchyOpen, setHierarchyOpen] = useState(true);
  const captureRef = useRef<() => string | null>(() => null);
  const undoRef = useRef<CoreLevelDocument[]>([]);
  const redoRef = useRef<CoreLevelDocument[]>([]);
  const documentRef = useRef(document);
  const [historyState, setHistoryState] = useState({ canRedo: false, canUndo: false });

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktopViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  const selectedObject = useMemo(
    () => document.objects.find((object) => object.id === selectedObjectId) ?? null,
    [document.objects, selectedObjectId]
  );
  const validation = useMemo(() => validateCoreLevelDocument(document), [document]);

  const registerCapture = useCallback((capture: () => string | null) => {
    captureRef.current = capture;
  }, []);

  const commitDocument = useCallback(
    (nextDocument: CoreLevelDocument, recordHistory = true) => {
      if (recordHistory) {
        undoRef.current = [...undoRef.current.slice(-49), cloneDocument(documentRef.current)];
        redoRef.current = [];
        setHistoryState({ canRedo: false, canUndo: true });
      }
      const normalized = normalizeCoreLevelDocument(nextDocument);
      documentRef.current = normalized;
      setDocument(normalized);
      setDirty(true);
      setMessage(null);
      setError(null);
    },
    []
  );

  const undo = useCallback(() => {
    const previous = undoRef.current.pop();
    if (!previous) return;
    redoRef.current.push(cloneDocument(documentRef.current));
    documentRef.current = previous;
    setDocument(previous);
    setDirty(true);
    setHistoryState({
      canRedo: true,
      canUndo: undoRef.current.length > 0
    });
  }, []);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(cloneDocument(documentRef.current));
    documentRef.current = next;
    setDocument(next);
    setDirty(true);
    setHistoryState({
      canRedo: redoRef.current.length > 0,
      canUndo: true
    });
  }, []);

  const updateObject = useCallback(
    (objectId: string, updater: (object: CoreLevelObject) => CoreLevelObject) => {
      commitDocument({
        ...documentRef.current,
        objects: documentRef.current.objects.map((object) =>
          object.id === objectId ? updater(structuredClone(object)) : object
        )
      });
    },
    [commitDocument]
  );

  const commitTransform = useCallback(
    (objectId: string, transform: CoreLevelTransform) => {
      const gridSize = documentRef.current.gridSize;
      updateObject(objectId, (object) => ({
        ...object,
        transform: {
          position: {
            x: snapCoreLevelValue(transform.position.x, gridSize),
            y: snapCoreLevelValue(transform.position.y, gridSize),
            z: snapCoreLevelValue(transform.position.z, gridSize)
          },
          rotation: transform.rotation,
          scale: {
            x: Math.max(gridSize / 4, snapCoreLevelValue(transform.scale.x, gridSize / 4)),
            y: Math.max(gridSize / 4, snapCoreLevelValue(transform.scale.y, gridSize / 4)),
            z: Math.max(gridSize / 4, snapCoreLevelValue(transform.scale.z, gridSize / 4))
          }
        }
      }));
    },
    [updateObject]
  );

  const addObject = useCallback(
    (kind: "entity" | "geometry", subtype: CoreLevelEntityKind | CoreLevelShape) => {
      const object = createCoreLevelObject(kind, subtype, Date.now());
      object.transform.position = {
        x: documentRef.current.worldSize / 2,
        y: documentRef.current.worldSize / 2,
        z: kind === "geometry" ? object.transform.scale.z / 2 : 96
      };
      if (kind === "geometry") object.materialId = selectedMaterialId;
      commitDocument({
        ...documentRef.current,
        objects: [...documentRef.current.objects, object]
      });
      setSelectedObjectId(object.id);
      setToolMode("translate");
    },
    [commitDocument, selectedMaterialId]
  );

  const removeSelected = useCallback(() => {
    if (!selectedObjectId) return;
    const selectedIndex = documentRef.current.objects.findIndex(
      (object) => object.id === selectedObjectId
    );
    commitDocument({
      ...documentRef.current,
      objects: documentRef.current.objects.filter(
        (object) => object.id !== selectedObjectId
      )
    });
    const next =
      documentRef.current.objects[selectedIndex + 1] ??
      documentRef.current.objects[selectedIndex - 1] ??
      null;
    setSelectedObjectId(next?.id ?? null);
  }, [commitDocument, selectedObjectId]);

  const duplicateSelected = useCallback(() => {
    if (!selectedObject) return;
    const copy = structuredClone(selectedObject);
    copy.id = `level-object-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    copy.label = `${copy.label} copy`;
    copy.transform.position.x += documentRef.current.gridSize;
    copy.transform.position.y += documentRef.current.gridSize;
    commitDocument({
      ...documentRef.current,
      objects: [...documentRef.current.objects, copy]
    });
    setSelectedObjectId(copy.id);
  }, [commitDocument, selectedObject]);

  const loadProject = useCallback(
    async (id: string) => {
      if (dirty && !window.confirm("Discard the unsaved changes and open another project?")) {
        return;
      }
      setBusy("save");
      setError(null);
      try {
        const response = await fetch(`${apiPath}?project=${encodeURIComponent(id)}`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as BuilderData & { error?: string };
        if (!response.ok || !payload.activeProject) {
          throw new Error(payload.error ?? "The level project could not be opened.");
        }
        const nextDocument = cloneDocument(payload.activeProject.document);
        undoRef.current = [];
        redoRef.current = [];
        setHistoryState({ canRedo: false, canUndo: false });
        setProjectId(payload.activeProject.id);
        setProjects(payload.projects);
        setDocument(nextDocument);
        documentRef.current = nextDocument;
        setSelectedObjectId(nextDocument.objects[0]?.id ?? null);
        setDirty(false);
        setMessage(`Opened ${payload.activeProject.name}.`);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "The level project could not be opened."
        );
      } finally {
        setBusy(null);
      }
    },
    [dirty]
  );

  const newProject = useCallback(() => {
    if (dirty && !window.confirm("Discard the unsaved changes and create a new arena?")) {
      return;
    }
    const next = createEmptyCoreLevelDocument();
    undoRef.current = [];
    redoRef.current = [];
    setHistoryState({ canRedo: false, canUndo: false });
    setProjectId(null);
    setDocument(next);
    documentRef.current = next;
    setSelectedObjectId(next.objects[0]?.id ?? null);
    setDirty(false);
    setMessage("New arena ready.");
    setError(null);
  }, [dirty]);

  const saveProject = useCallback(async () => {
    setBusy("save");
    setError(null);
    try {
      const response = await fetch(apiPath, {
        body: JSON.stringify({
          action: "save",
          description: documentRef.current.description,
          document: documentRef.current,
          name: documentRef.current.name,
          projectId
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as {
        error?: string;
        project?: CoreLevelProject;
        summary?: ProjectSummary;
      };
      if (!response.ok || !payload.project || !payload.summary) {
        throw new Error(payload.error ?? "The level project could not be saved.");
      }
      setProjectId(payload.project.id);
      setProjects((current) => [
        payload.summary!,
        ...current.filter((project) => project.id !== payload.summary!.id)
      ]);
      setDirty(false);
      setMessage("Draft saved.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The level project could not be saved."
      );
    } finally {
      setBusy(null);
    }
  }, [projectId]);

  const publishProject = useCallback(async () => {
    if (!projectId) {
      setError("Save the draft before publishing it.");
      return;
    }
    if (!validation.valid) {
      setError(
        validation.issues.find((issue) => issue.severity === "error")?.message ??
          "Fix validation errors before publishing."
      );
      return;
    }
    if (
      !window.confirm(
        "Publish an immutable Core level definition and preview? You can keep editing and publish another version later."
      )
    ) {
      return;
    }

    setBusy("publish");
    setError(null);
    try {
      const response = await fetch(apiPath, {
        body: JSON.stringify({
          action: "publish",
          document: documentRef.current,
          previewDataUrl: captureRef.current(),
          projectId
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as {
        error?: string;
        project?: CoreLevelProject;
        summary?: ProjectSummary;
      };
      if (!response.ok || !payload.project || !payload.summary) {
        throw new Error(payload.error ?? "The level could not be published.");
      }
      setProjects((current) => [
        payload.summary!,
        ...current.filter((project) => project.id !== payload.summary!.id)
      ]);
      setDirty(false);
      setMessage(
        `Version ${payload.project.publishedVersion} published for the Core install pipeline.`
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The level could not be published."
      );
    } finally {
      setBusy(null);
    }
  }, [projectId, validation]);

  const deleteProject = useCallback(async () => {
    if (!projectId || !window.confirm("Delete this level project? Published files remain immutable for audit and recovery.")) {
      return;
    }
    setBusy("delete");
    setError(null);
    try {
      const response = await fetch(apiPath, {
        body: JSON.stringify({ action: "delete", projectId }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The level project could not be deleted.");
      setProjects((current) => current.filter((project) => project.id !== projectId));
      const next = createEmptyCoreLevelDocument();
      setProjectId(null);
      setDocument(next);
      documentRef.current = next;
      setSelectedObjectId(next.objects[0]?.id ?? null);
      setDirty(false);
      setMessage("Level project deleted.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The level project could not be deleted.");
    } finally {
      setBusy(null);
    }
  }, [projectId]);

  const importProject = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        const value = JSON.parse(await file.text()) as unknown;
        const record =
          value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {};
        const next = normalizeCoreLevelDocument(record.document ?? value);
        commitDocument(next);
        setProjectId(null);
        setSelectedObjectId(next.objects[0]?.id ?? null);
        setMessage("Level JSON imported as a new unsaved project.");
      } catch {
        setError("That file is not a valid Bouncecore Core level document.");
      }
    },
    [commitDocument]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeSelected();
      } else if (event.key.toLowerCase() === "w") {
        setToolMode("translate");
      } else if (event.key.toLowerCase() === "e") {
        setToolMode("rotate");
      } else if (event.key.toLowerCase() === "r") {
        setToolMode("scale");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, removeSelected, undo]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredShapes = coreLevelShapeCatalog.filter((entry) =>
    `${entry.displayName} ${entry.description}`.toLowerCase().includes(normalizedSearch)
  );
  const filteredEntities = coreLevelEntityCatalog.filter((entry) =>
    `${entry.displayName} ${entry.description}`.toLowerCase().includes(normalizedSearch)
  );
  const filteredTextures = coreLevelTextureCatalog.filter((entry) =>
    `${entry.displayName} ${entry.category}`.toLowerCase().includes(normalizedSearch)
  );
  const activeProject = projects.find((project) => project.id === projectId) ?? null;

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-bc-void text-white lg:min-h-[680px]">
      {desktopViewport ? (
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-bc-line bg-bc-panel px-3">
        <Link
          className="bc-focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-bc-line bg-bc-ink px-3 text-sm font-semibold hover:border-bc-electric/50"
          href="/admin/core-fps"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Core admin
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{document.name}</p>
          <p className="text-[11px] text-bc-muted">
            {projectId
              ? dirty
                ? "Unsaved changes"
                : activeProject?.status === "published"
                  ? `Published v${activeProject.publishedVersion}`
                  : "Draft saved"
              : "New project"}
          </p>
        </div>
        <div className="mx-auto hidden items-center gap-1 lg:flex">
          <ToolbarButton active={toolMode === "translate"} label="Move selected object (W)" onClick={() => setToolMode("translate")}>
            <MousePointer2 className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton active={toolMode === "rotate"} label="Rotate selected object (E)" onClick={() => setToolMode("rotate")}>
            <Rotate3D className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton active={toolMode === "scale"} label="Resize selected object (R)" onClick={() => setToolMode("scale")}>
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <span className="mx-1 h-6 w-px bg-bc-line" />
          <ToolbarButton disabled={!historyState.canUndo} label="Undo" onClick={undo}>
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton disabled={!historyState.canRedo} label="Redo" onClick={redo}>
            <Redo2 className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton disabled={!selectedObject} label="Duplicate object" onClick={duplicateSelected}>
            <Copy className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton disabled={!selectedObject} label="Delete object" onClick={removeSelected}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="bc-button bc-button-ghost inline-flex h-9 items-center gap-2 px-3 text-sm"
            disabled={Boolean(busy)}
            onClick={() =>
              fileDownload(
                `${document.slug}.core-level.json`,
                `${JSON.stringify({ document, exportedAt: new Date().toISOString() }, null, 2)}\n`
              )
            }
            type="button"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span className="hidden xl:inline">Export</span>
          </button>
          <button
            className="bc-button bc-button-ghost inline-flex h-9 items-center gap-2 px-3 text-sm"
            disabled={Boolean(busy)}
            onClick={() => void saveProject()}
            type="button"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {busy === "save" ? "Saving" : "Save"}
          </button>
          <button
            className="bc-button inline-flex h-9 items-center gap-2 px-3 text-sm"
            disabled={Boolean(busy) || !projectId}
            onClick={() => void publishProject()}
            type="button"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {busy === "publish" ? "Publishing" : "Publish"}
          </button>
        </div>
      </header>
      ) : null}

      {desktopViewport ? (
      <div className="grid min-h-0 flex-1 grid-cols-[284px_minmax(0,1fr)_310px]">
        <aside className="flex min-h-0 flex-col border-r border-bc-line bg-bc-panel">
          <div className="border-b border-bc-line p-3">
            <div className="flex gap-2">
              <button className="bc-button bc-button-ghost flex-1 text-xs" onClick={newProject} type="button">
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                New
              </button>
              <label className="bc-button bc-button-ghost flex-1 cursor-pointer text-xs">
                <Upload className="h-4 w-4" aria-hidden="true" />
                Import
                <input accept=".json,application/json" className="sr-only" onChange={(event) => void importProject(event)} type="file" />
              </label>
            </div>
            <label className="mt-3 block text-[10px] font-bold uppercase text-bc-muted" htmlFor="core-level-project">
              Saved projects
            </label>
            <select
              className="mt-1 h-9 w-full rounded border border-bc-line bg-bc-ink px-2 text-xs text-white"
              id="core-level-project"
              onChange={(event) => event.target.value && void loadProject(event.target.value)}
              value={projectId ?? ""}
            >
              <option value="">Unsaved project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} {project.status === "published" ? `(v${project.publishedVersion})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 border-b border-bc-line p-2">
            {(
              [
                ["geometry", Boxes, "Build"],
                ["entities", Crosshair, "Gameplay"],
                ["textures", Sparkles, "Textures"]
              ] as const
            ).map(([tab, Icon, label]) => (
              <button
                className={classNames(
                  "bc-focus-ring flex min-h-12 flex-col items-center justify-center gap-1 rounded text-[10px] font-bold",
                  paletteTab === tab ? "bg-bc-electric/12 text-bc-electric" : "text-bc-muted hover:text-white"
                )}
                key={tab}
                onClick={() => setPaletteTab(tab)}
                type="button"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          <div className="border-b border-bc-line p-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-bc-muted" aria-hidden="true" />
              <input
                className="h-9 w-full rounded border border-bc-line bg-bc-void pl-8 pr-2 text-xs text-white"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find blocks, items, textures"
                value={search}
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {paletteTab === "geometry" ? (
              <div className="grid grid-cols-2 gap-2">
                {filteredShapes.map((entry) => (
                  <button
                    className="bc-focus-ring grid min-h-20 place-items-center rounded-md border border-bc-line bg-bc-ink p-2 text-center hover:border-bc-electric/60"
                    key={entry.shape}
                    onClick={() => addObject("geometry", entry.shape)}
                    title={entry.description}
                    type="button"
                  >
                    {entry.shape === "sphere" ? <Circle className="h-6 w-6 text-bc-electric" /> : <Box className="h-6 w-6 text-bc-electric" />}
                    <span className="text-xs font-semibold">{entry.displayName}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {paletteTab === "entities" ? (
              <div className="grid gap-2">
                {filteredEntities.map((entry) => (
                  <button
                    className="bc-focus-ring flex min-h-14 items-center gap-3 rounded-md border border-bc-line bg-bc-ink p-2 text-left hover:border-bc-pink/60"
                    key={entry.entityKind}
                    onClick={() => addObject("entity", entry.entityKind)}
                    type="button"
                  >
                    {entry.entityKind === "flag" ? (
                      <Flag className="h-5 w-5 shrink-0 text-bc-pink" />
                    ) : entry.entityKind === "light" ? (
                      <Lightbulb className="h-5 w-5 shrink-0 text-bc-amber" />
                    ) : (
                      <Crosshair className="h-5 w-5 shrink-0 text-bc-electric" />
                    )}
                    <span>
                      <span className="block text-xs font-semibold">{entry.displayName}</span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-bc-muted">{entry.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {paletteTab === "textures" ? (
              <div className="grid grid-cols-2 gap-2">
                {filteredTextures.map((entry) => (
                  <button
                    className={classNames(
                      "bc-focus-ring overflow-hidden rounded-md border bg-bc-ink text-left",
                      selectedMaterialId === entry.id ? "border-bc-electric" : "border-bc-line hover:border-bc-electric/50"
                    )}
                    key={entry.id}
                    onClick={() => {
                      setSelectedMaterialId(entry.id);
                      if (selectedObject?.kind === "geometry") {
                        updateObject(selectedObject.id, (object) => ({ ...object, materialId: entry.id }));
                      }
                    }}
                    type="button"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" className="aspect-square w-full object-cover" loading="lazy" src={`/games/core/builder/textures/${entry.id}.png`} />
                    <span className="block truncate px-2 py-1.5 text-[10px] font-semibold">{entry.displayName}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </aside>

        <section className="relative min-h-0 min-w-0">
          <LevelViewport
            document={document}
            onCaptureReady={registerCapture}
            onSelectionChange={setSelectedObjectId}
            onTransformCommit={commitTransform}
            selectedObjectId={selectedObjectId}
            toolMode={toolMode}
          />
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
            <span className="rounded border border-bc-line bg-bc-void/90 px-2 py-1 text-[10px] font-bold text-bc-muted">
              {document.worldSize} world
            </span>
            <span className="rounded border border-bc-line bg-bc-void/90 px-2 py-1 text-[10px] font-bold text-bc-muted">
              {document.gridSize} snap
            </span>
            <span className="rounded border border-bc-line bg-bc-void/90 px-2 py-1 text-[10px] font-bold text-bc-muted">
              {document.objects.length} objects
            </span>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded border border-bc-line bg-bc-void/90 px-3 py-1.5 text-[10px] text-bc-muted">
            Left click selects · drag gizmo transforms · right drag orbits · wheel zooms · Delete removes
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-l border-bc-line bg-bc-panel">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <section className="border-b border-bc-line p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black">Inspector</h2>
                <Settings2 className="h-4 w-4 text-bc-muted" aria-hidden="true" />
              </div>
              {selectedObject ? (
                <div className="mt-3 grid gap-4">
                  <label className="grid gap-1 text-xs font-semibold">
                    Object name
                    <input
                      className="h-9 rounded border border-bc-line bg-bc-void px-2 text-xs"
                      onChange={(event) =>
                        updateObject(selectedObject.id, (object) => ({
                          ...object,
                          label: event.target.value
                        }))
                      }
                      value={selectedObject.label}
                    />
                    <span className="font-normal text-[10px] text-bc-muted">Used in the hierarchy and validation messages.</span>
                  </label>
                  <TransformFields
                    onChange={(transform) =>
                      updateObject(selectedObject.id, (object) => ({ ...object, transform }))
                    }
                    transform={selectedObject.transform}
                  />
                  {selectedObject.kind === "geometry" ? (
                    <label className="grid gap-1 text-xs font-semibold">
                      Surface texture
                      <select
                        className="h-9 rounded border border-bc-line bg-bc-void px-2 text-xs"
                        onChange={(event) =>
                          updateObject(selectedObject.id, (object) => ({
                            ...object,
                            materialId: event.target.value
                          }))
                        }
                        value={selectedObject.materialId}
                      >
                        {coreLevelTextureCatalog.map((texture) => (
                          <option key={texture.id} value={texture.id}>{texture.displayName}</option>
                        ))}
                      </select>
                      <span className="font-normal text-[10px] text-bc-muted">Compiled into the Core map configuration by safe texture ID.</span>
                    </label>
                  ) : null}
                  {selectedObject.kind === "entity" ? (
                    <div className="grid gap-3">
                      {["player-spawn", "flag"].includes(selectedObject.entityKind ?? "") ? (
                        <label className="grid gap-1 text-xs font-semibold">
                          Team
                          <select
                            className="h-9 rounded border border-bc-line bg-bc-void px-2 text-xs"
                            onChange={(event) =>
                              updateObject(selectedObject.id, (object) => ({
                                ...object,
                                properties: {
                                  ...object.properties,
                                  team: Number(event.target.value) as CoreLevelTeam
                                }
                              }))
                            }
                            value={selectedObject.properties?.team ?? 0}
                          >
                            <option value={0}>Neutral / Free For All</option>
                            <option value={1}>Red team</option>
                            <option value={2}>Blue team</option>
                          </select>
                          <span className="font-normal text-[10px] text-bc-muted">Flags must use red or blue; spawns may be neutral or team-specific.</span>
                        </label>
                      ) : null}
                      {selectedObject.entityKind === "light" ? (
                        <>
                          <NumericField
                            label="Light radius"
                            onChange={(radius) =>
                              updateObject(selectedObject.id, (object) => ({
                                ...object,
                                properties: { ...object.properties, radius }
                              }))
                            }
                            value={selectedObject.properties?.radius ?? 192}
                          />
                          <div className="grid grid-cols-3 gap-2">
                            {(["red", "green", "blue"] as const).map((channel) => (
                              <NumericField
                                key={channel}
                                label={channel}
                                onChange={(value) =>
                                  updateObject(selectedObject.id, (object) => ({
                                    ...object,
                                    properties: { ...object.properties, [channel]: value }
                                  }))
                                }
                                value={selectedObject.properties?.[channel] ?? 255}
                              />
                            ))}
                          </div>
                        </>
                      ) : null}
                      {selectedObject.entityKind?.includes("teleporter") ? (
                        <NumericField
                          label="Link tag"
                          onChange={(tag) =>
                            updateObject(selectedObject.id, (object) => ({
                              ...object,
                              properties: { ...object.properties, tag }
                            }))
                          }
                          value={selectedObject.properties?.tag ?? 0}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <button className="bc-button bc-button-ghost text-xs" onClick={duplicateSelected} type="button">
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      Duplicate
                    </button>
                    <button className="bc-button bc-button-danger text-xs" onClick={removeSelected} type="button">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-bc-muted">Select an object in the scene or hierarchy to edit it.</p>
              )}
            </section>

            <section className="border-b border-bc-line p-4">
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setHierarchyOpen((current) => !current)}
                type="button"
              >
                <span className="text-sm font-black">Scene hierarchy</span>
                <ChevronDown className={classNames("h-4 w-4 transition", hierarchyOpen && "rotate-180")} />
              </button>
              {hierarchyOpen ? (
                <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                  {document.objects.map((object) => (
                    <button
                      className={classNames(
                        "flex min-h-8 w-full items-center gap-2 rounded px-2 text-left text-xs",
                        selectedObjectId === object.id ? "bg-bc-electric/12 text-bc-electric" : "text-bc-muted hover:bg-bc-ink hover:text-white"
                      )}
                      key={object.id}
                      onClick={() => setSelectedObjectId(object.id)}
                      type="button"
                    >
                      {object.kind === "geometry" ? <Box className="h-3.5 w-3.5 shrink-0" /> : <Crosshair className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">{object.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="p-4">
              <h2 className="text-sm font-black">Arena settings</h2>
              <div className="mt-3 grid gap-3">
                <label className="grid gap-1 text-xs font-semibold">
                  Arena name
                  <input
                    className="h-9 rounded border border-bc-line bg-bc-void px-2 text-xs"
                    maxLength={60}
                    onChange={(event) => commitDocument({ ...documentRef.current, name: event.target.value })}
                    value={document.name}
                  />
                  <span className="font-normal text-[10px] text-bc-muted">Public display name shown in map voting.</span>
                </label>
                <label className="grid gap-1 text-xs font-semibold">
                  Description
                  <textarea
                    className="min-h-20 resize-y rounded border border-bc-line bg-bc-void p-2 text-xs"
                    maxLength={500}
                    onChange={(event) => commitDocument({ ...documentRef.current, description: event.target.value })}
                    value={document.description}
                  />
                  <span className="font-normal text-[10px] text-bc-muted">Short public summary included with the map bundle.</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-xs font-semibold">
                    World size
                    <select
                      className="h-9 rounded border border-bc-line bg-bc-void px-2 text-xs"
                      onChange={(event) => commitDocument({ ...documentRef.current, worldSize: Number(event.target.value) as CoreLevelDocument["worldSize"] })}
                      value={document.worldSize}
                    >
                      {coreLevelWorldSizes.map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-semibold">
                    Grid snap
                    <select
                      className="h-9 rounded border border-bc-line bg-bc-void px-2 text-xs"
                      onChange={(event) => commitDocument({ ...documentRef.current, gridSize: Number(event.target.value) as CoreLevelDocument["gridSize"] })}
                      value={document.gridSize}
                    >
                      {coreLevelGridSizes.map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </label>
                </div>
                <fieldset>
                  <legend className="text-xs font-semibold">Supported modes</legend>
                  <div className="mt-1 grid gap-1">
                    {(
                      [
                        ["ffa", "Free For All"],
                        ["teamplay", "Team Deathmatch"],
                        ["ctf", "Capture the Flag"]
                      ] as const
                    ).map(([mode, label]) => (
                      <label className="flex items-center gap-2 text-xs" key={mode}>
                        <input
                          checked={document.modes.includes(mode)}
                          onChange={(event) => {
                            const modes = event.target.checked
                              ? [...new Set([...documentRef.current.modes, mode])]
                              : documentRef.current.modes.filter((candidate) => candidate !== mode);
                            commitDocument({ ...documentRef.current, modes });
                          }}
                          type="checkbox"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </section>
          </div>
        </aside>
      </div>
      ) : null}

      {!desktopViewport ? (
      <section className="grid min-h-0 flex-1 place-items-center p-6 text-center">
        <div className="max-w-md">
          <PackageOpen className="mx-auto h-10 w-10 text-bc-electric" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-black">Desktop Level Builder</h1>
          <p className="mt-2 text-sm text-bc-muted">
            This professional 3D editor needs a desktop viewport, mouse, and keyboard. Open it on a laptop or desktop browser to build safely.
          </p>
          <Link className="bc-button mt-5 inline-flex" href="/admin/core-fps">Back to Core admin</Link>
        </div>
      </section>
      ) : null}

      {desktopViewport ? (
      <footer className="flex min-h-10 shrink-0 items-center gap-3 border-t border-bc-line bg-bc-panel px-3 text-[11px]">
        <span className={classNames("font-semibold", validation.valid ? "text-bc-acid" : "text-bc-amber")}>
          {validation.valid
            ? "Ready to publish"
            : `${validation.issues.filter((issue) => issue.severity === "error").length} errors`}
        </span>
        <span className="text-bc-muted">
          {validation.stats.geometry} geometry · {validation.stats.entities} entities · {validation.stats.playerSpawns} spawns
        </span>
        <span className="min-w-0 flex-1 truncate text-right text-bc-muted">
          {error ? <span className="text-red-300">{error}</span> : message ?? validation.issues[0]?.message ?? "Core level document v1"}
        </span>
        {activeProject?.publishedDefinitionUrl ? (
          <a
            className="inline-flex items-center gap-1 text-bc-electric hover:text-white"
            download
            href={activeProject.publishedDefinitionUrl}
          >
            <Download className="h-3 w-3" aria-hidden="true" />
            Published bundle
          </a>
        ) : null}
        {projectId ? (
          <button
            className="inline-flex items-center gap-1 text-red-300 hover:text-red-200"
            disabled={Boolean(busy)}
            onClick={() => void deleteProject()}
            type="button"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
            Delete project
          </button>
        ) : null}
      </footer>
      ) : null}
    </main>
  );
}
