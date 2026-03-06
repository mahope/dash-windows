import { useRef, useEffect, useCallback } from 'react';
import { CharacterState, Direction, TILE_SIZE, TileType } from '@pixel-agents/office/types.js';
import type {
  Character,
  Seat,
  TileType as TileTypeVal,
  SpriteData,
} from '@pixel-agents/office/types.js';
import { getCharacterSprites } from '@pixel-agents/office/sprites/spriteData.js';
import { getCachedSprite } from '@pixel-agents/office/sprites/spriteCache.js';
import {
  createCharacter,
  updateCharacter,
  getCharacterSprite,
} from '@pixel-agents/office/engine/characters.js';
import { startGameLoop } from '@pixel-agents/office/engine/gameLoop.js';
import { getWalkableTiles } from '@pixel-agents/office/layout/tileMap.js';
import { CHARACTER_SITTING_OFFSET_PX, CHARACTER_Z_SORT_OFFSET } from '@pixel-agents/constants.js';
import {
  DESK_SQUARE_SPRITE,
  CHAIR_SPRITE,
  PLANT_SPRITE,
  BOOKSHELF_SPRITE,
  COOLER_SPRITE,
  BUBBLE_WAITING_SPRITE,
} from '@pixel-agents/office/sprites/spriteData.js';

// ── Small office layout ─────────────────────────────────────────
const COLS = 12;
const ROWS = 8;

// F = floor, W = wall
const W = TileType.WALL;
const F = TileType.FLOOR_1;

const TILE_MAP: TileTypeVal[][] = [
  [W, W, W, W, W, W, W, W, W, W, W, W],
  [W, F, F, F, F, F, F, F, F, F, F, W],
  [W, F, F, F, F, F, F, F, F, F, F, W],
  [W, F, F, F, F, F, F, F, F, F, F, W],
  [W, F, F, F, F, F, F, F, F, F, F, W],
  [W, F, F, F, F, F, F, F, F, F, F, W],
  [W, F, F, F, F, F, F, F, F, F, F, W],
  [W, W, W, W, W, W, W, W, W, W, W, W],
];

// Furniture instances (pre-computed pixel positions)
interface FurnitureInst {
  sprite: SpriteData;
  x: number;
  y: number;
  zY: number;
  footW: number;
  footH: number;
}

const FURNITURE: FurnitureInst[] = [
  // Desk at (2,1) - 2x2 tiles
  {
    sprite: DESK_SQUARE_SPRITE,
    x: 2 * TILE_SIZE,
    y: 1 * TILE_SIZE,
    zY: 3 * TILE_SIZE,
    footW: 2,
    footH: 2,
  },
  // Desk at (7,1) - 2x2 tiles
  {
    sprite: DESK_SQUARE_SPRITE,
    x: 7 * TILE_SIZE,
    y: 1 * TILE_SIZE,
    zY: 3 * TILE_SIZE,
    footW: 2,
    footH: 2,
  },
  // Desk at (2,4) - 2x2 tiles
  {
    sprite: DESK_SQUARE_SPRITE,
    x: 2 * TILE_SIZE,
    y: 4 * TILE_SIZE,
    zY: 6 * TILE_SIZE,
    footW: 2,
    footH: 2,
  },
  // Desk at (7,4) - 2x2 tiles
  {
    sprite: DESK_SQUARE_SPRITE,
    x: 7 * TILE_SIZE,
    y: 4 * TILE_SIZE,
    zY: 6 * TILE_SIZE,
    footW: 2,
    footH: 2,
  },
  // Plant at (1,1)
  {
    sprite: PLANT_SPRITE,
    x: 1 * TILE_SIZE,
    y: 1 * TILE_SIZE,
    zY: 1 * TILE_SIZE + TILE_SIZE,
    footW: 1,
    footH: 1,
  },
  // Bookshelf at (10,1) - 1x2 tiles
  {
    sprite: BOOKSHELF_SPRITE,
    x: 10 * TILE_SIZE,
    y: 1 * TILE_SIZE,
    zY: 3 * TILE_SIZE,
    footW: 1,
    footH: 2,
  },
  // Cooler at (5,6)
  {
    sprite: COOLER_SPRITE,
    x: 5 * TILE_SIZE,
    y: 6 * TILE_SIZE,
    zY: 6 * TILE_SIZE + TILE_SIZE,
    footW: 1,
    footH: 1,
  },
];

// Blocked tiles (furniture footprints)
const BLOCKED = new Set<string>();
for (const f of FURNITURE) {
  const startCol = Math.floor(f.x / TILE_SIZE);
  const startRow = Math.floor(f.y / TILE_SIZE);
  for (let r = 0; r < f.footH; r++) {
    for (let c = 0; c < f.footW; c++) {
      BLOCKED.add(`${startCol + c},${startRow + r}`);
    }
  }
}

// Seats (chairs in front of desks)
const SEATS = new Map<string, Seat>([
  ['s1', { uid: 's1', seatCol: 2, seatRow: 3, facingDir: Direction.UP, assigned: false }],
  ['s2', { uid: 's2', seatCol: 3, seatRow: 3, facingDir: Direction.UP, assigned: false }],
  ['s3', { uid: 's3', seatCol: 7, seatRow: 3, facingDir: Direction.UP, assigned: false }],
  ['s4', { uid: 's4', seatCol: 8, seatRow: 3, facingDir: Direction.UP, assigned: false }],
  ['s5', { uid: 's5', seatCol: 2, seatRow: 6, facingDir: Direction.UP, assigned: false }],
  ['s6', { uid: 's6', seatCol: 3, seatRow: 6, facingDir: Direction.UP, assigned: false }],
]);
// Also block seat tiles for others
for (const [, seat] of SEATS) {
  BLOCKED.add(`${seat.seatCol},${seat.seatRow}`);
}

const WALKABLE = getWalkableTiles(TILE_MAP, new Set());

// ── Colors ──────────────────────────────────────────────────────
const WALL_COLOR = '#2a2a3e';
const FLOOR_COLOR = '#3d3d50';
const FLOOR_ALT_COLOR = '#3a3a4d';

// ── Renderer ────────────────────────────────────────────────────

function renderOffice(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  characters: Character[],
  zoom: number,
) {
  ctx.clearRect(0, 0, width, height);

  const mapW = COLS * TILE_SIZE * zoom;
  const mapH = ROWS * TILE_SIZE * zoom;
  const ox = Math.floor((width - mapW) / 2);
  const oy = Math.floor((height - mapH) / 2);
  const s = TILE_SIZE * zoom;

  // Draw floor + walls
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = TILE_MAP[r][c];
      if (tile === TileType.WALL) {
        ctx.fillStyle = WALL_COLOR;
      } else {
        ctx.fillStyle = (r + c) % 2 === 0 ? FLOOR_COLOR : FLOOR_ALT_COLOR;
      }
      ctx.fillRect(ox + c * s, oy + r * s, s, s);
    }
  }

  // Z-sorted drawables
  const drawables: Array<{ zY: number; draw: (c: CanvasRenderingContext2D) => void }> = [];

  // Furniture
  for (const f of FURNITURE) {
    const cached = getCachedSprite(f.sprite, zoom);
    const fx = ox + f.x * zoom;
    const fy = oy + f.y * zoom;
    drawables.push({
      zY: f.zY,
      draw: (c) => c.drawImage(cached, fx, fy),
    });
  }

  // Chair sprites at seat positions
  for (const [, seat] of SEATS) {
    const cached = getCachedSprite(CHAIR_SPRITE, zoom);
    const cx = ox + seat.seatCol * TILE_SIZE * zoom;
    const cy = oy + seat.seatRow * TILE_SIZE * zoom;
    drawables.push({
      zY: (seat.seatRow + 1) * TILE_SIZE,
      draw: (c) => c.drawImage(cached, cx, cy),
    });
  }

  // Characters
  for (const ch of characters) {
    const sprites = getCharacterSprites(ch.palette, ch.hueShift);
    const spriteData = getCharacterSprite(ch, sprites);
    const cached = getCachedSprite(spriteData, zoom);
    const sittingOffset = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
    const drawX = Math.round(ox + ch.x * zoom - cached.width / 2);
    const drawY = Math.round(oy + (ch.y + sittingOffset) * zoom - cached.height);
    const charZY = ch.y + TILE_SIZE / 2 + CHARACTER_Z_SORT_OFFSET;

    drawables.push({
      zY: charZY,
      draw: (c) => c.drawImage(cached, drawX, drawY),
    });

    // Waiting bubble
    if (ch.bubbleType === 'waiting') {
      const bubbleSprite = BUBBLE_WAITING_SPRITE;
      const bubbleCached = getCachedSprite(bubbleSprite, zoom);
      const sOff = ch.state === CharacterState.TYPE ? 10 : 0;
      const bx = Math.round(ox + ch.x * zoom - bubbleCached.width / 2);
      const by = Math.round(oy + (ch.y + sOff - 24) * zoom - bubbleCached.height - zoom);
      drawables.push({
        zY: charZY + 0.01,
        draw: (c) => c.drawImage(bubbleCached, bx, by),
      });
    }
  }

  drawables.sort((a, b) => a.zY - b.zY);
  for (const d of drawables) {
    d.draw(ctx);
  }
}

// ── Component ───────────────────────────────────────────────────

interface PixelAgentPanelProps {
  /** Map of taskId → activity state */
  taskActivity: Record<string, 'busy' | 'idle' | 'waiting'>;
  /** Currently active task IDs (to show as characters) */
  activeTaskIds: string[];
}

export function PixelAgentPanel({ taskActivity, activeTaskIds }: PixelAgentPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    characters: Map<number, Character>;
    taskToChar: Map<string, number>;
    nextId: number;
    zoom: number;
  }>({
    characters: new Map(),
    taskToChar: new Map(),
    nextId: 0,
    zoom: 3,
  });

  // Sync characters with active tasks
  useEffect(() => {
    const state = stateRef.current;
    const currentTaskIds = new Set(activeTaskIds);

    // Remove characters for tasks that no longer exist
    for (const [taskId, charId] of state.taskToChar) {
      if (!currentTaskIds.has(taskId)) {
        state.characters.delete(charId);
        state.taskToChar.delete(taskId);
        // Free seat
        for (const [, seat] of SEATS) {
          const ch = [...state.characters.values()].find((c) => c.seatId === seat.uid);
          if (!ch) seat.assigned = false;
        }
      }
    }

    // Add characters for new tasks
    const seatIds = [...SEATS.keys()];
    for (const taskId of activeTaskIds) {
      if (state.taskToChar.has(taskId)) continue;

      // Find free seat
      let freeSeatId: string | null = null;
      for (const sid of seatIds) {
        const seat = SEATS.get(sid)!;
        if (!seat.assigned) {
          freeSeatId = sid;
          seat.assigned = true;
          break;
        }
      }

      const charId = state.nextId++;
      const seat = freeSeatId ? SEATS.get(freeSeatId)! : null;
      const ch = createCharacter(charId, charId % 6, freeSeatId, seat);
      state.characters.set(charId, ch);
      state.taskToChar.set(taskId, charId);
    }
  }, [activeTaskIds]);

  // Update activity states
  useEffect(() => {
    const state = stateRef.current;
    for (const [taskId, charId] of state.taskToChar) {
      const ch = state.characters.get(charId);
      if (!ch) continue;
      const activity = taskActivity[taskId];
      ch.isActive = activity === 'busy';
      ch.bubbleType = activity === 'waiting' ? 'waiting' : null;
    }
  }, [taskActivity]);

  // Canvas resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // Calculate zoom to fit
    const zoomX = rect.width / (COLS * TILE_SIZE);
    const zoomY = rect.height / (ROWS * TILE_SIZE);
    stateRef.current.zoom = Math.max(1, Math.floor(Math.min(zoomX, zoomY) * dpr));
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    const stop = startGameLoop(canvas, {
      update: (dt) => {
        const state = stateRef.current;
        for (const ch of state.characters.values()) {
          // Build blocked set excluding this character's own seat
          const blockedForChar = new Set(BLOCKED);
          if (ch.seatId) {
            blockedForChar.delete(
              `${SEATS.get(ch.seatId)!.seatCol},${SEATS.get(ch.seatId)!.seatRow}`,
            );
          }
          updateCharacter(ch, dt, WALKABLE, SEATS, TILE_MAP, blockedForChar);
        }
      },
      render: (ctx) => {
        const state = stateRef.current;
        renderOffice(ctx, canvas.width, canvas.height, [...state.characters.values()], state.zoom);
      },
    });

    return () => {
      stop();
      resizeObserver.disconnect();
    };
  }, [handleResize]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[120px] flex items-center justify-center overflow-hidden"
      style={{ background: '#1a1a2e' }}
    >
      <canvas ref={canvasRef} className="block" style={{ imageRendering: 'pixelated' }} />
    </div>
  );
}
