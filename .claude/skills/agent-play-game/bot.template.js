async (page) => {
  const BEHAVIOR = '{{BEHAVIOR}}';
  const SECONDS = {{SECONDS}};
  const OUTPUT_PATH = '{{OUTPUT_PATH}}';

  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 800 },
    deviceScaleFactor: 2,
    hasTouch: true,
    recordVideo: { dir: '/tmp/cascade-video', size: { width: 414, height: 800 } },
  });

  const p = await ctx.newPage();
  await p.goto('http://localhost:5173/');
  await p.waitForTimeout(1200);

  const guestBtn = await p.$('.home .btn.ghost');
  if (guestBtn) {
    await guestBtn.click();
    await p.waitForTimeout(600);
  }

  const video = p.video();

  const start = Date.now();
  let moves = 0;
  let restarts = 0;

  const decideMove = () => p.evaluate((behavior) => {
    if (document.querySelector('.overlay.shown')) return { gameOver: true };

    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (const cell of document.querySelectorAll('.cell.filled')) {
      const r = parseInt(cell.dataset.r);
      const c = parseInt(cell.dataset.c);
      board[r][c] = cell.style.getPropertyValue('--c').trim() || 'x';
    }

    const pieceEls = document.querySelectorAll('.tray-piece');
    const pieces = Array.from(pieceEls).map((el, idx) => {
      const m = el.style.gridTemplateColumns.match(/repeat\((\d+)/);
      const w = m ? parseInt(m[1]) : 1;
      const cells = Array.from(el.querySelectorAll('.tray-cell'));
      const offsets = [];
      let color = 'x';
      cells.forEach((c, i) => {
        if (!c.classList.contains('empty')) {
          offsets.push([Math.floor(i / w), i % w]);
          const col = c.style.getPropertyValue('--c').trim();
          if (col) color = col;
        }
      });
      const h = offsets.length ? Math.max(...offsets.map((o) => o[0])) + 1 : 0;
      return { idx, el, offsets, color, w, h };
    });
    if (!pieces.length) return { noPieces: true };

    const canPlace = (b, pc, r, c) => {
      for (const [dr, dc] of pc.offsets) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) return false;
        if (b[nr][nc] !== null) return false;
      }
      return true;
    };

    const placeOn = (b, pc, r, c) => {
      for (const [dr, dc] of pc.offsets) b[r + dr][c + dc] = pc.color;
    };

    const detectLines = (b) => {
      let lines = 0, mono = 0;
      const toClear = [];
      for (let i = 0; i < 8; i++) {
        if (b[i].every((x) => x !== null)) {
          lines++;
          if (b[i].every((x) => x === b[i][0])) mono++;
          for (let j = 0; j < 8; j++) toClear.push([i, j]);
        }
        const col = b.map((r) => r[i]);
        if (col.every((x) => x !== null)) {
          lines++;
          if (col.every((x) => x === col[0])) mono++;
          for (let j = 0; j < 8; j++) toClear.push([j, i]);
        }
      }
      return { lines, mono, toClear };
    };

    const evaluateBoard = (b) => {
      let bad = 0;
      const heights = Array(8).fill(0);
      for (let cc = 0; cc < 8; cc++) {
        for (let rr = 0; rr < 8; rr++) {
          if (b[rr][cc] !== null) { heights[cc] = 8 - rr; break; }
        }
      }
      const maxH = Math.max(...heights);
      bad += maxH * maxH * 1.5;
      for (let i = 0; i < 7; i++) bad += Math.abs(heights[i] - heights[i + 1]);
      for (let cc = 0; cc < 8; cc++) {
        let seenFilled = false;
        for (let rr = 0; rr < 8; rr++) {
          if (b[rr][cc] !== null) seenFilled = true;
          else if (seenFilled) bad += 12;
        }
      }
      return -bad;
    };

    const scoreGreedy = (b, pc, r, c) => {
      const clone = b.map((row) => row.slice());
      placeOn(clone, pc, r, c);
      const { lines, mono } = detectLines(clone);
      let s = lines * 500 + mono * 400;
      for (const [dr, dc] of pc.offsets) {
        const nr = r + dr, nc = c + dc;
        for (const [ddr, ddc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const ar = nr + ddr, ac = nc + ddc;
          if (ar < 0 || ar >= 8 || ac < 0 || ac >= 8) { s += 2; continue; }
          if (clone[ar][ac] !== null) s += 1;
        }
      }
      let hp = 0;
      for (let cc = 0; cc < 8; cc++) {
        let top = 8;
        for (let rr = 0; rr < 8; rr++) if (clone[rr][cc] !== null) { top = rr; break; }
        hp += (8 - top) * (8 - top);
      }
      s -= hp;
      return s;
    };

    const scoreSmart = (b, pc, r, c) => {
      const clone = b.map((row) => row.slice());
      placeOn(clone, pc, r, c);
      const { lines, mono, toClear } = detectLines(clone);
      for (const [rr, cc] of toClear) clone[rr][cc] = null;
      let s = lines * 600 + mono * 500;
      for (const [dr, dc] of pc.offsets) {
        const nr = r + dr, nc = c + dc;
        for (const [ddr, ddc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const ar = nr + ddr, ac = nc + ddc;
          if (ar < 0 || ar >= 8 || ac < 0 || ac >= 8) { s += 2; continue; }
          if (clone[ar][ac] !== null) s += 1;
        }
      }
      s += evaluateBoard(clone) * 1.2;
      return s;
    };

    let best = null;
    const validMoves = [];

    for (const pc of pieces) {
      if (!pc.offsets.length) continue;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (!canPlace(board, pc, r, c)) continue;
          validMoves.push({ piece: pc, r, c });
        }
      }
    }

    if (!validMoves.length) return { stuck: true };

    if (behavior === 'random') {
      best = validMoves[Math.floor(Math.random() * validMoves.length)];
      best.score = 0;
    } else {
      const scorer = behavior === 'smart' ? scoreSmart : scoreGreedy;
      for (const mv of validMoves) {
        const v = scorer(board, mv.piece, mv.r, mv.c);
        if (!best || v > best.score) best = { ...mv, score: v };
      }
    }

    if (!best) return { stuck: true };

    const pr = best.piece.el.getBoundingClientRect();
    const pieceX = pr.left + pr.width / 2;
    const pieceY = pr.top + pr.height / 2;
    const tc = document.querySelector('.cell[data-r="' + best.r + '"][data-c="' + best.c + '"]');
    const tr = tc.getBoundingClientRect();
    const cs = tr.width;
    const gap = 3;
    const pw = best.piece.w * cs + (best.piece.w - 1) * gap;
    const ph = best.piece.h * cs + (best.piece.h - 1) * gap;
    const tx = tr.left + pw / 2;
    const ty = tr.top + 60 + ph;
    return { pieceX, pieceY, targetX: tx, targetY: ty };
  }, BEHAVIOR);

  while (Date.now() - start < SECONDS * 1000) {
    let d;
    try {
      d = await decideMove();
    } catch {
      break;
    }
    if (d.gameOver) {
      await p.waitForTimeout(2200);
      const card = await p.$('.overlay.shown .card');
      if (card) { await card.click(); restarts++; await p.waitForTimeout(700); }
      continue;
    }
    if (d.noPieces || d.stuck) { await p.waitForTimeout(400); continue; }
    await p.mouse.move(d.pieceX, d.pieceY);
    await p.mouse.down();
    const steps = BEHAVIOR === 'random' ? 10 : 18;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await p.mouse.move(d.pieceX + (d.targetX - d.pieceX) * t, d.pieceY + (d.targetY - d.pieceY) * t);
      await p.waitForTimeout(12);
    }
    await p.mouse.up();
    moves++;
    await p.waitForTimeout(BEHAVIOR === 'random' ? 450 : 650);
  }

  await ctx.close();
  await video.saveAs(OUTPUT_PATH);
  return { moves, restarts, behavior: BEHAVIOR, seconds: SECONDS, videoPath: OUTPUT_PATH };
}
