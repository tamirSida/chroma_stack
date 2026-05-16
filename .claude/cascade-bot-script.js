async (page) => {
  const BEHAVIOR = 'smart';
  const SECONDS = 60;
  const OUTPUT_PATH = '/Users/tamirsida/dev/game/playwright-media/cascade-smart-260516-194756.webm';

  // Node built-ins are available via require in the MCP server process
  const fs = require('fs/promises');
  const nodePath = require('path');
  const nodeOs = require('os');
  const { spawn } = require('child_process');

  const findFfmpeg = async () => {
    const cache = nodePath.join(nodeOs.homedir(), 'Library', 'Caches', 'ms-playwright');
    try {
      const dirs = await fs.readdir(cache);
      const ver = dirs.find((d) => d.startsWith('ffmpeg-'));
      if (!ver) return null;
      const binName =
        process.platform === 'darwin' ? 'ffmpeg-mac'
        : process.platform === 'linux' ? 'ffmpeg-linux'
        : 'ffmpeg-win.exe';
      const full = nodePath.join(cache, ver, binName);
      await fs.access(full);
      return full;
    } catch { return null; }
  };

  const muxVideoAudio = (ffmpegPath, videoIn, audioIn, out) =>
    new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, [
        '-y', '-i', videoIn, '-i', audioIn,
        '-c:v', 'copy', '-c:a', 'libopus', '-shortest', out,
      ], { stdio: 'ignore' });
      proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
      proc.on('error', reject);
    });

  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 800 },
    deviceScaleFactor: 2,
    hasTouch: true,
    recordVideo: { dir: '/tmp/cascade-video', size: { width: 414, height: 800 } },
  });

  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('cascade.bgm.v1', '1');
      localStorage.setItem('cascade.audio.v1', '1');
    } catch {}
  });

  const p = await ctx.newPage();
  await p.goto('http://localhost:5173/');
  await p.waitForTimeout(1200);

  const guestBtn = await p.$('.home .btn.ghost');
  if (guestBtn) { await guestBtn.click(); await p.waitForTimeout(900); }

  const video = p.video();

  await p.evaluate(() => {
    const c = window.__cascade?.ctx?.();
    const mix = window.__cascade?.mix?.();
    if (!c || !mix) { window.__audioRecError = 'audio context not exposed'; return; }
    if (c.state === 'suspended') c.resume();
    try {
      const dest = c.createMediaStreamDestination();
      mix.connect(dest);
      const chunks = [];
      const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm; codecs=opus' });
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      rec.start(1000);
      window.__audioChunks = chunks;
      window.__audioRec = rec;
    } catch (err) { window.__audioRecError = String(err); }
  });

  const start = Date.now();
  let moves = 0, restarts = 0, powersUsed = 0;

  const decideAction = () => p.evaluate((behavior) => {
    if (document.querySelector('.overlay.shown')) return { type: 'gameover' };
    const coinsEl = document.getElementById('coins-num');
    const coins = parseInt(coinsEl?.textContent || '0') || 0;
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (const cell of document.querySelectorAll('.cell.filled')) {
      const r = parseInt(cell.dataset.r), c = parseInt(cell.dataset.c);
      board[r][c] = cell.style.getPropertyValue('--c').trim() || 'x';
    }
    const pieceEls = document.querySelectorAll('.tray-piece');
    const pieces = Array.from(pieceEls).map((el, idx) => {
      const m = el.style.gridTemplateColumns.match(/repeat\((\d+)/);
      const w = m ? parseInt(m[1]) : 1;
      const cells = Array.from(el.querySelectorAll('.tray-cell'));
      const offsets = []; let color = 'x';
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
    if (!pieces.length) return { type: 'wait' };
    const canPlace = (b, pc, r, c) => {
      for (const [dr, dc] of pc.offsets) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) return false;
        if (b[nr][nc] !== null) return false;
      }
      return true;
    };
    const placeOn = (b, pc, r, c) => { for (const [dr, dc] of pc.offsets) b[r+dr][c+dc] = pc.color; };
    const detectLines = (b) => {
      let lines = 0, mono = 0; const toClear = [];
      for (let i = 0; i < 8; i++) {
        if (b[i].every((x) => x !== null)) { lines++; if (b[i].every((x) => x === b[i][0])) mono++; for (let j = 0; j < 8; j++) toClear.push([i, j]); }
        const col = b.map((r) => r[i]);
        if (col.every((x) => x !== null)) { lines++; if (col.every((x) => x === col[0])) mono++; for (let j = 0; j < 8; j++) toClear.push([j, i]); }
      }
      return { lines, mono, toClear };
    };
    const evaluateBoard = (b) => {
      let bad = 0; const heights = Array(8).fill(0);
      for (let cc = 0; cc < 8; cc++) for (let rr = 0; rr < 8; rr++) { if (b[rr][cc] !== null) { heights[cc] = 8 - rr; break; } }
      const maxH = Math.max(...heights);
      bad += maxH * maxH * 1.5;
      for (let i = 0; i < 7; i++) bad += Math.abs(heights[i] - heights[i+1]);
      for (let cc = 0; cc < 8; cc++) { let seenFilled = false; for (let rr = 0; rr < 8; rr++) { if (b[rr][cc] !== null) seenFilled = true; else if (seenFilled) bad += 12; } }
      return -bad;
    };
    const scoreSmart = (b, pc, r, c) => {
      const clone = b.map((row) => row.slice()); placeOn(clone, pc, r, c);
      const { lines, mono, toClear } = detectLines(clone);
      for (const [rr, cc] of toClear) clone[rr][cc] = null;
      let s = lines * 600 + mono * 500;
      for (const [dr, dc] of pc.offsets) { const nr = r+dr, nc = c+dc; for (const [ddr, ddc] of [[1,0],[-1,0],[0,1],[0,-1]]) { const ar = nr+ddr, ac = nc+ddc; if (ar<0||ar>=8||ac<0||ac>=8) { s+=2; continue; } if (clone[ar][ac]!==null) s+=1; } }
      s += evaluateBoard(clone) * 1.2;
      return s;
    };
    const validMoves = [];
    for (const pc of pieces) { if (!pc.offsets.length) continue; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (canPlace(board, pc, r, c)) validMoves.push({ piece: pc, r, c }); }
    if (validMoves.length === 0) {
      if (behavior !== 'random' && coins >= 80) return { type: 'power', power: 'shufflePieces' };
      if (behavior !== 'random' && coins >= 250) return { type: 'power', power: 'clearBoard' };
      return { type: 'wait' };
    }
    if (behavior === 'smart' && coins >= 120) {
      const findPaintOpp = (b) => {
        let bestOpp = null;
        const considerLine = (cells, axis, index) => {
          const filled = cells.filter((x) => x !== null); if (filled.length < 7) return;
          const counts = {}; filled.forEach((cc) => { counts[cc] = (counts[cc]||0)+1; });
          let maj = null; for (const [k, n] of Object.entries(counts)) { if (!maj || n > maj.n) maj = { c: k, n }; }
          if (!maj || maj.n >= filled.length || maj.n < 5) return;
          const opp = { axis, index, color: maj.c, score: maj.n*2+filled.length };
          if (!bestOpp || opp.score > bestOpp.score) bestOpp = opp;
        };
        for (let r = 0; r < 8; r++) considerLine(b[r], 'row', r);
        for (let c = 0; c < 8; c++) considerLine(b.map((row) => row[c]), 'col', c);
        return bestOpp;
      };
      const opp = findPaintOpp(board);
      if (opp) return { type: 'power', power: 'colorLine', axis: opp.axis, index: opp.index, color: opp.color };
    }
    let best = null;
    for (const mv of validMoves) { const v = scoreSmart(board, mv.piece, mv.r, mv.c); if (!best || v > best.score) best = { ...mv, score: v }; }
    if (!best) return { type: 'wait' };
    const pr = best.piece.el.getBoundingClientRect();
    const pieceX = pr.left + pr.width/2, pieceY = pr.top + pr.height/2;
    const tc = document.querySelector('.cell[data-r="'+best.r+'"][data-c="'+best.c+'"]');
    const tr = tc.getBoundingClientRect(); const cs = tr.width; const gap = 3;
    const pw = best.piece.w*cs + (best.piece.w-1)*gap, ph = best.piece.h*cs + (best.piece.h-1)*gap;
    const tx = tr.left + pw/2, ty = tr.top + 60 + ph;
    return { type: 'place', pieceX, pieceY, targetX: tx, targetY: ty };
  }, BEHAVIOR);

  while (Date.now() - start < SECONDS * 1000) {
    let d;
    try { d = await decideAction(); } catch { break; }
    if (d.type === 'gameover') {
      await p.waitForTimeout(2200);
      const card = await p.$('.overlay.shown .card');
      if (card) { await card.click(); restarts++; await p.waitForTimeout(700); }
      continue;
    }
    if (d.type === 'wait') { await p.waitForTimeout(400); continue; }
    if (d.type === 'power') {
      if (d.power === 'colorLine') {
        await p.click('.power-btn[data-power-id="colorLine"]'); await p.waitForTimeout(180);
        if (d.axis === 'col') { await p.click('.targeting-bar .axis button:nth-child(2)'); await p.waitForTimeout(80); }
        const colorIdx = ['r','b','g','y'].indexOf(d.color);
        if (colorIdx > 0) { await p.click(`.targeting-bar .swatches .swatch:nth-child(${colorIdx+1})`); await p.waitForTimeout(80); }
        const cellSel = d.axis === 'row' ? `.cell[data-r="${d.index}"][data-c="0"]` : `.cell[data-r="0"][data-c="${d.index}"]`;
        await p.click(cellSel); await p.waitForTimeout(700);
      } else { await p.click(`.power-btn[data-power-id="${d.power}"]`); await p.waitForTimeout(700); }
      powersUsed++; continue;
    }
    await p.mouse.move(d.pieceX, d.pieceY); await p.mouse.down();
    const steps = 18;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await p.mouse.move(d.pieceX + (d.targetX - d.pieceX)*t, d.pieceY + (d.targetY - d.pieceY)*t);
      await p.waitForTimeout(12);
    }
    await p.mouse.up(); moves++; await p.waitForTimeout(650);
  }

  const audioDataUrl = await p.evaluate(() => new Promise((resolve) => {
    const rec = window.__audioRec;
    if (!rec) { resolve(window.__audioRecError ? `error:${window.__audioRecError}` : null); return; }
    if (rec.state === 'inactive') { resolve(null); return; }
    rec.onstop = () => {
      try {
        const blob = new Blob(window.__audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      } catch { resolve(null); }
    };
    rec.stop();
  }));

  await ctx.close();
  const tempVideo = OUTPUT_PATH.replace(/\.webm$/, '.video.webm');
  const tempAudio = OUTPUT_PATH.replace(/\.webm$/, '.audio.webm');
  await video.saveAs(tempVideo);

  let audioSaved = false, muxed = false, muxError = null;
  if (typeof audioDataUrl === 'string' && audioDataUrl.startsWith('data:audio')) {
    try {
      const base64 = audioDataUrl.split(',')[1];
      await fs.writeFile(tempAudio, Buffer.from(base64, 'base64'));
      audioSaved = true;
    } catch (err) { muxError = `audio write failed: ${err.message}`; }
  } else if (typeof audioDataUrl === 'string' && audioDataUrl.startsWith('error:')) {
    muxError = audioDataUrl;
  }

  if (audioSaved) {
    const ffmpegBin = await findFfmpeg();
    if (ffmpegBin) {
      try {
        await muxVideoAudio(ffmpegBin, tempVideo, tempAudio, OUTPUT_PATH);
        muxed = true;
        await fs.unlink(tempVideo).catch(()=>{});
        await fs.unlink(tempAudio).catch(()=>{});
      } catch (err) { muxError = `ffmpeg failed: ${err.message}`; }
    } else { muxError = 'ffmpeg not found'; }
  }

  if (!muxed) { await fs.rename(tempVideo, OUTPUT_PATH).catch(()=>{}); }

  return {
    moves, restarts, powersUsed, behavior: BEHAVIOR, seconds: SECONDS,
    videoPath: OUTPUT_PATH, audioCaptured: audioSaved, muxed,
    audioFallbackPath: muxed ? null : (audioSaved ? tempAudio : null),
    muxError,
  };
}
