import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const outDir = path.join(repoRoot, 'test-artifacts', 'video-intro')
const framesDir = path.join(outDir, 'frames')
const outputFile = path.join(outDir, 'judge-and-jury-intro.mp4')
const posterFile = path.join(outDir, 'poster.png')

const width = 1920
const height = 1080
const fps = 24
const durationSeconds = 7
const totalFrames = fps * durationSeconds

mkdirSync(outDir, { recursive: true })
if (existsSync(framesDir)) rmSync(framesDir, { recursive: true, force: true })
mkdirSync(framesDir, { recursive: true })

function framePath(index) {
  return path.join(framesDir, `frame_${String(index).padStart(4, '0')}.png`)
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', windowsHide: true })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code}`))
    })
  })
}

const html = String.raw`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    :root {
      --navy: #0f172a;
      --primary: #1e3a8a;
      --secondary: #1e40af;
      --accent: #b45309;
      --success: #047857;
      --paper: #f8fafc;
      --panel: #ffffff;
      --muted: #e9eef5;
      --border: #cbd5e1;
      --ink: #0f172a;
      --soft: #f1f5f9;
      --t: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      background: var(--paper);
      height: 100%;
      margin: 0;
      overflow: hidden;
      width: 100%;
    }

    body {
      color: var(--ink);
      font-family: Arial, sans-serif;
      letter-spacing: 0;
    }

    .frame {
      background:
        linear-gradient(135deg, rgba(30, 58, 138, 0.09), transparent 34%),
        radial-gradient(circle at 83% 18%, rgba(180, 83, 9, 0.11), transparent 25%),
        var(--paper);
      height: 1080px;
      overflow: hidden;
      position: relative;
      width: 1920px;
    }

    .court-lines {
      inset: 0;
      opacity: 0.24;
      position: absolute;
    }

    .court-lines::before,
    .court-lines::after {
      border: 2px solid rgba(30, 58, 138, 0.18);
      content: "";
      position: absolute;
      transform: rotate(-13deg);
    }

    .court-lines::before {
      height: 850px;
      left: -180px;
      top: -310px;
      width: 1480px;
    }

    .court-lines::after {
      height: 680px;
      right: -150px;
      top: 150px;
      width: 1220px;
    }

    .topbar,
    .workspace,
    .title-lockup,
    .final-lockup,
    .stage-story,
    .evidence-story {
      position: absolute;
    }

    .topbar {
      align-items: center;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 22px 52px rgba(15, 23, 42, 0.1);
      display: flex;
      height: 86px;
      justify-content: space-between;
      left: 54px;
      padding: 0 22px;
      top: 42px;
      width: 1812px;
    }

    .brand {
      align-items: center;
      display: flex;
      gap: 16px;
    }

    .mark {
      align-items: center;
      background: var(--primary);
      border-radius: 8px;
      color: #ffffff;
      display: inline-flex;
      font-family: Georgia, serif;
      font-size: 31px;
      font-weight: 700;
      height: 58px;
      justify-content: center;
      width: 58px;
    }

    .brand strong,
    .panel h2,
    .title-lockup h1,
    .final-lockup h1 {
      font-family: Georgia, serif;
      letter-spacing: 0;
    }

    .brand strong {
      display: block;
      font-size: 29px;
      line-height: 1.05;
    }

    .brand small {
      color: #475569;
      display: block;
      font-size: 16px;
      margin-top: 6px;
    }

    .pills {
      display: flex;
      gap: 10px;
    }

    .pill {
      background: var(--soft);
      border: 1px solid var(--border);
      border-radius: 999px;
      color: #334155;
      font-size: 13px;
      font-weight: 900;
      padding: 9px 12px;
      text-transform: uppercase;
    }

    .workspace {
      bottom: 52px;
      display: grid;
      gap: 18px;
      grid-template-columns: 455px 790px 455px;
      left: 54px;
      opacity: var(--workspace-opacity);
      right: 54px;
      top: 168px;
      transform: translateY(var(--workspace-y)) scale(var(--workspace-scale));
      transform-origin: center;
    }

    .stack {
      display: grid;
      gap: 18px;
    }

    .panel {
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
      overflow: hidden;
    }

    .panel-head {
      align-items: center;
      border-bottom: 1px solid var(--border);
      display: flex;
      height: 58px;
      justify-content: space-between;
      padding: 0 16px;
    }

    .panel h2 {
      color: var(--primary);
      font-size: 25px;
      margin: 0;
    }

    .role-list,
    .matter,
    .runtime,
    .binder,
    .verdict,
    .transcript {
      display: grid;
      gap: 12px;
      padding: 14px;
    }

    .role-row,
    .turn,
    .evidence-item {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
    }

    .role-row {
      align-items: center;
      display: grid;
      gap: 12px;
      grid-template-columns: 42px 1fr;
    }

    .role-row.active {
      background: #eff6ff;
      border-color: #93c5fd;
    }

    .role-icon {
      align-items: center;
      background: var(--muted);
      border-radius: 8px;
      color: var(--primary);
      display: inline-flex;
      font-size: 20px;
      font-weight: 900;
      height: 42px;
      justify-content: center;
      width: 42px;
    }

    .role-row strong,
    .matter strong,
    .evidence-item strong,
    .turn strong {
      display: block;
      font-size: 18px;
      font-weight: 900;
    }

    .role-row small,
    .matter small,
    .metric,
    .evidence-item p,
    .turn p,
    .verdict p {
      color: #334155;
      font-size: 15px;
      line-height: 1.45;
    }

    .matter {
      min-height: 290px;
    }

    .matter p {
      color: #334155;
      font-size: 16px;
      line-height: 1.56;
      margin: 0;
    }

    .stage-rail {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(13, minmax(0, 1fr));
      left: 54px;
      opacity: var(--stage-opacity);
      position: absolute;
      right: 54px;
      top: 136px;
      transform: translateY(var(--stage-y));
    }

    .stage-pill {
      align-items: center;
      background: #ecfdf5;
      border: 1px solid #86efac;
      border-radius: 999px;
      color: #166534;
      display: flex;
      font-size: 13px;
      font-weight: 900;
      gap: 7px;
      height: 38px;
      justify-content: center;
      padding: 0 9px;
    }

    .stage-pill.active {
      background: #dbeafe;
      border-color: var(--primary);
      color: var(--primary);
    }

    .stage-pill span:first-child {
      border: 2px solid currentColor;
      border-radius: 999px;
      height: 13px;
      width: 13px;
    }

    .turn {
      border-left: 5px solid var(--primary);
      min-height: 110px;
    }

    .turn.accent {
      border-left-color: var(--accent);
    }

    .turn.success {
      border-left-color: var(--success);
    }

    .turn .meta {
      align-items: center;
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .turn time {
      color: #64748b;
      font-size: 13px;
    }

    .runtime {
      min-height: 202px;
    }

    .metric {
      align-items: center;
      display: flex;
      gap: 10px;
    }

    .metric b {
      color: var(--success);
    }

    .binder {
      max-height: 360px;
      overflow: hidden;
    }

    .evidence-item {
      display: grid;
      gap: 8px;
    }

    .evidence-title {
      align-items: center;
      display: flex;
      justify-content: space-between;
    }

    .tag {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 999px;
      color: #92400e;
      font-size: 12px;
      font-weight: 900;
      padding: 5px 8px;
    }

    .verdict {
      grid-template-columns: 36px 1fr;
      min-height: 170px;
    }

    .check {
      color: var(--success);
      font-size: 28px;
      font-weight: 900;
    }

    .title-lockup {
      align-items: center;
      display: grid;
      justify-items: center;
      left: 0;
      opacity: var(--title-opacity);
      right: 0;
      top: 274px;
      transform: translateY(var(--title-y)) scale(var(--title-scale));
    }

    .large-mark {
      align-items: center;
      background: var(--primary);
      border-radius: 8px;
      box-shadow: 0 26px 80px rgba(30, 58, 138, 0.3);
      color: #ffffff;
      display: flex;
      font-family: Georgia, serif;
      font-size: 76px;
      font-weight: 700;
      height: 142px;
      justify-content: center;
      margin-bottom: 34px;
      width: 142px;
    }

    .title-lockup h1,
    .final-lockup h1 {
      color: var(--primary);
      font-size: 84px;
      line-height: 0.98;
      margin: 0;
      text-align: center;
    }

    .title-lockup p,
    .final-lockup p {
      color: #334155;
      font-size: 25px;
      line-height: 1.35;
      margin: 18px 0 0;
      text-align: center;
    }

    .evidence-story {
      align-items: center;
      display: grid;
      gap: 28px;
      grid-template-columns: 520px 520px 520px;
      left: 180px;
      opacity: var(--evidence-opacity);
      top: 292px;
      transform: translateY(var(--evidence-y));
    }

    .story-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
      min-height: 280px;
      padding: 26px;
      transform: scale(var(--story-scale));
    }

    .story-card h2 {
      color: var(--primary);
      font-family: Georgia, serif;
      font-size: 33px;
      margin: 0 0 18px;
    }

    .story-card p {
      color: #334155;
      font-size: 21px;
      line-height: 1.44;
      margin: 0;
    }

    .story-card .mini {
      background: var(--soft);
      border: 1px solid var(--border);
      border-radius: 999px;
      color: #334155;
      display: inline-block;
      font-size: 14px;
      font-weight: 900;
      margin-bottom: 18px;
      padding: 8px 11px;
      text-transform: uppercase;
    }

    .stage-story {
      left: 210px;
      opacity: var(--process-opacity);
      right: 210px;
      top: 276px;
      transform: translateY(var(--process-y));
    }

    .process-grid {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(4, 1fr);
    }

    .process-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.11);
      min-height: 278px;
      padding: 25px;
    }

    .process-card strong {
      color: var(--primary);
      display: block;
      font-family: Georgia, serif;
      font-size: 31px;
      margin-bottom: 18px;
    }

    .process-card p {
      color: #334155;
      font-size: 20px;
      line-height: 1.44;
      margin: 0;
    }

    .final-lockup {
      align-items: center;
      bottom: 68px;
      display: grid;
      justify-items: center;
      left: 0;
      padding: 46px 0 38px;
      opacity: var(--final-opacity);
      right: 0;
      transform: translateY(var(--final-y));
      z-index: 12;
    }

    .final-lockup::before {
      background: rgba(248, 250, 252, 0.9);
      border-bottom: 1px solid rgba(203, 213, 225, 0.75);
      border-top: 1px solid rgba(203, 213, 225, 0.75);
      bottom: 0;
      box-shadow: 0 -24px 70px rgba(15, 23, 42, 0.1);
      content: "";
      left: 0;
      position: absolute;
      right: 0;
      top: 0;
      z-index: -1;
    }

    .final-lockup .pills {
      margin-top: 28px;
    }

    .wipe {
      background: var(--primary);
      bottom: 0;
      left: 0;
      opacity: var(--wipe-opacity);
      position: absolute;
      top: 0;
      transform: translateX(var(--wipe-x));
      width: 100%;
      z-index: 20;
    }
  </style>
</head>
<body>
  <div class="frame">
    <div class="court-lines"></div>

    <div class="topbar">
      <div class="brand">
        <span class="mark">J&J</span>
        <span>
          <strong>Judge & Jury</strong>
          <small>Hermes courtroom simulation powered by MiniMax-M3</small>
        </span>
      </div>
      <div class="pills">
        <span class="pill">ready</span>
        <span class="pill">Hermes profiles</span>
      </div>
    </div>

    <div class="stage-rail">
      <div class="stage-pill"><span></span>Intake</div>
      <div class="stage-pill"><span></span>Evidence</div>
      <div class="stage-pill"><span></span>Elements</div>
      <div class="stage-pill"><span></span>Openings</div>
      <div class="stage-pill"><span></span>Defence</div>
      <div class="stage-pill"><span></span>Witnesses</div>
      <div class="stage-pill active"><span></span>Cross</div>
      <div class="stage-pill"><span></span>Motions</div>
      <div class="stage-pill"><span></span>Closings</div>
      <div class="stage-pill"><span></span>Charge</div>
      <div class="stage-pill"><span></span>Votes</div>
      <div class="stage-pill"><span></span>Jury</div>
      <div class="stage-pill"><span></span>Verdict</div>
    </div>

    <div class="title-lockup">
      <div class="large-mark">J&J</div>
      <h1>Judge & Jury</h1>
      <p>Turn disclosure into a live courtroom simulation.</p>
    </div>

    <div class="evidence-story">
      <div class="story-card">
        <span class="mini">Matter intake</span>
        <h2>Start with the record</h2>
        <p>Create a matter, name the jurisdiction, and frame the allegations before the first turn begins.</p>
      </div>
      <div class="story-card">
        <span class="mini">Evidence binder</span>
        <h2>Upload exhibits</h2>
        <p>Disclosure, witness notes, and text exhibits become cited material the roles can reason from.</p>
      </div>
      <div class="story-card">
        <span class="mini">Court controls</span>
        <h2>Intervene live</h2>
        <p>Object, ask for a ruling, call a witness, or steer the simulation from the action bar.</p>
      </div>
    </div>

    <div class="stage-story">
      <div class="process-grid">
        <div class="process-card">
          <strong>Seven roles</strong>
          <p>Crown, defence, judge, clerk, witness, evidence clerk, and jury each operate through isolated courtroom profiles.</p>
        </div>
        <div class="process-card">
          <strong>Live transcript</strong>
          <p>Every stage produces a court record with objections, rulings, citations, and streaming agent turns.</p>
        </div>
        <div class="process-card">
          <strong>Evidence gates</strong>
          <p>Marked and admitted exhibits define what each role can see, test, and rely on.</p>
        </div>
        <div class="process-card">
          <strong>Verdict report</strong>
          <p>The jury deliberation resolves into a decision-support verdict grounded in the simulated record.</p>
        </div>
      </div>
    </div>

    <div class="workspace">
      <div class="stack">
        <section class="panel">
          <div class="panel-head">
            <h2>Courtroom</h2>
            <span class="pill">cross</span>
          </div>
          <div class="role-list">
            <div class="role-row"><span class="role-icon">C</span><span><strong>Crown</strong><small>matter-record</small></span></div>
            <div class="role-row"><span class="role-icon">D</span><span><strong>Defence</strong><small>matter-record</small></span></div>
            <div class="role-row active"><span class="role-icon">J</span><span><strong>Judge</strong><small>admitted-only</small></span></div>
            <div class="role-row"><span class="role-icon">Y</span><span><strong>Jury</strong><small>admitted-only</small></span></div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <h2>Matter Intake</h2>
            <span class="pill">active</span>
          </div>
          <div class="matter">
            <strong>R. v. Sample Accused</strong>
            <small>Ontario / Canada</small>
            <p>Decision-support courtroom simulation with contested intent, reliance, causation, and disclosure completeness.</p>
          </div>
        </section>
      </div>

      <main class="panel">
        <div class="panel-head">
          <h2>Judge & Jury</h2>
          <span class="pill">live court record</span>
        </div>
        <div class="transcript">
          <article class="turn">
            <div class="meta"><strong>Evidence</strong><time>now</time></div>
            <p>Exhibits E-001 and E-002 are marked. Defence disputes reliance and intent.</p>
          </article>
          <article class="turn accent">
            <div class="meta"><strong>Objection</strong><time>now</time></div>
            <p>Foundation is unclear. Defence requests a ruling before the witness proceeds.</p>
          </article>
          <article class="turn success">
            <div class="meta"><strong>Ruling</strong><time>now</time></div>
            <p>The objection is partly sustained. The next question must anchor to admitted material.</p>
          </article>
          <article class="turn success">
            <div class="meta"><strong>Verdict synthesis</strong><time>soon</time></div>
            <p>Jurors compare the record against charge elements and generate a decision-support report.</p>
          </article>
        </div>
      </main>

      <div class="stack">
        <section class="panel">
          <div class="panel-head">
            <h2>Runtime</h2>
            <span class="pill">Hermes</span>
          </div>
          <div class="runtime">
            <div class="metric">CPU <span>Hermes courtroom profiles</span></div>
            <div class="metric">Shield <span>Strict role isolation</span></div>
            <div class="metric">Pulse <span><b>7 endpoints configured</b></span></div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <h2>Evidence Binder</h2>
            <span class="pill">2 exhibits</span>
          </div>
          <div class="binder">
            <article class="evidence-item">
              <div class="evidence-title"><strong>E-001</strong><span class="tag">marked</span></div>
              <p>Crown theory and disclosure summary for courtroom simulation.</p>
            </article>
            <article class="evidence-item">
              <div class="evidence-title"><strong>E-002</strong><span class="tag">admitted</span></div>
              <p>Witness account and record excerpts available to admitted-only roles.</p>
            </article>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <h2>Verdict</h2>
            <span class="pill">ready</span>
          </div>
          <div class="verdict">
            <span class="check">OK</span>
            <p>Final decision-support report grounded in citations, rulings, and jury deliberation.</p>
          </div>
        </section>
      </div>
    </div>

    <div class="final-lockup">
      <h1>Simulate the courtroom.<br />Stress-test the record.</h1>
      <p>Judge & Jury brings evidence, roles, objections, and verdict reasoning into one controlled workspace.</p>
      <div class="pills">
        <span class="pill">Evidence-aware</span>
        <span class="pill">Hermes-isolated</span>
        <span class="pill">Decision-support only</span>
      </div>
    </div>

    <div class="wipe"></div>
  </div>

  <script>
    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function ease(value) {
      const x = clamp(value, 0, 1);
      return x * x * (3 - 2 * x);
    }

    function segment(t, start, end) {
      return ease((t - start) / (end - start));
    }

    window.renderIntroFrame = function renderIntroFrame(t) {
      const titleIn = segment(t, 0.1, 0.9);
      const titleOut = 1 - segment(t, 1.35, 1.85);
      const evidenceIn = segment(t, 1.55, 2.15);
      const evidenceOut = 1 - segment(t, 3.0, 3.45);
      const processIn = segment(t, 3.05, 3.65);
      const processOut = 1 - segment(t, 4.7, 5.08);
      const workspaceIn = segment(t, 4.85, 5.55);
      const finalIn = segment(t, 5.7, 6.35);
      const wipeOut = 1 - segment(t, 0, 0.45);

      document.documentElement.style.setProperty('--title-opacity', titleIn * titleOut);
      document.documentElement.style.setProperty('--title-y', String(42 - titleIn * 42 - segment(t, 1.35, 1.85) * 60) + 'px');
      document.documentElement.style.setProperty('--title-scale', 0.92 + titleIn * 0.08);

      document.documentElement.style.setProperty('--evidence-opacity', evidenceIn * evidenceOut);
      document.documentElement.style.setProperty('--evidence-y', String(46 - evidenceIn * 46 - segment(t, 3.0, 3.45) * 50) + 'px');
      document.documentElement.style.setProperty('--story-scale', 0.94 + evidenceIn * 0.06);

      document.documentElement.style.setProperty('--process-opacity', processIn * processOut);
      document.documentElement.style.setProperty('--process-y', String(44 - processIn * 44 - segment(t, 4.7, 5.08) * 50) + 'px');

      document.documentElement.style.setProperty('--workspace-opacity', workspaceIn * (1 - finalIn * 0.36));
      document.documentElement.style.setProperty('--workspace-y', String(72 - workspaceIn * 72) + 'px');
      document.documentElement.style.setProperty('--workspace-scale', 0.94 + workspaceIn * 0.06);
      document.documentElement.style.setProperty('--stage-opacity', workspaceIn);
      document.documentElement.style.setProperty('--stage-y', String(38 - workspaceIn * 38) + 'px');

      document.documentElement.style.setProperty('--final-opacity', finalIn);
      document.documentElement.style.setProperty('--final-y', String(54 - finalIn * 54) + 'px');

      document.documentElement.style.setProperty('--wipe-opacity', wipeOut);
      document.documentElement.style.setProperty('--wipe-x', String(-100 + segment(t, 0, 0.45) * 100) + '%');
    }
  </script>
</body>
</html>
`

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'domcontentloaded' })

for (let frame = 0; frame < totalFrames; frame += 1) {
  const t = frame / fps
  await page.evaluate((seconds) => window.renderIntroFrame(seconds), t)
  await page.screenshot({ path: framePath(frame), animations: 'disabled' })
}

await page.evaluate((seconds) => window.renderIntroFrame(seconds), durationSeconds - 0.4)
await page.screenshot({ path: posterFile, animations: 'disabled' })
await browser.close()

await run('ffmpeg', [
  '-y',
  '-framerate',
  String(fps),
  '-i',
  path.join(framesDir, 'frame_%04d.png'),
  '-c:v',
  'libx264',
  '-preset',
  'medium',
  '-crf',
  '18',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  outputFile,
])

console.log(`Rendered ${outputFile}`)
console.log(`Poster ${posterFile}`)
