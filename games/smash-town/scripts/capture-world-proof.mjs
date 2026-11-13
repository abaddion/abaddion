#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPuppeteer, chromeLaunchOpts } from '../../../scripts/lib/puppeteer-launch.mjs';
import { createStaticServer } from '../../../scripts/lib/static-server.mjs';

const gameRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.join(gameRoot, '../..');
const outDir = path.join(gameRoot, 'proof');

const VEHICLES = ['city', 'monster', 'bulldozer', 'fire', 'dump', 'race'];
const DRIVE = [
  { x: 0, z: 0 },
  { x: 75, z: -5 },
  { x: 15, z: 70 },
  { x: -85, z: 5 }
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const { baseUrl, server } = await createStaticServer(repoRoot);
  const url = `${baseUrl}/games/smash-town/`;
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({ ...chromeLaunchOpts(), protocolTimeout: 300000 });

  const areas = [
    { name: 'town', x: 0, z: 0 },
    { name: 'forest', x: 95, z: -10 },
    { name: 'river', x: 0, z: 72 },
    { name: 'mountains', x: -95, z: 10 }
  ];

  const report = { capturedAt: new Date().toISOString(), shots: {}, stats: {}, notes: [] };

  for (const [w, h, tag] of [
    [390, 844, '390'],
    [1024, 768, '1024']
  ]) {
    for (const a of areas) {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: h });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
      await page.waitForFunction(() => window.Smash && window.Smash.debug, { timeout: 30000 });
      await page.evaluate((pt) => {
        const c = window.Smash.debug.car;
        c.x = pt.x;
        c.z = pt.z;
        c.target = { x: pt.x + 8, z: pt.z + 8 };
        c._pointerDown = true;
      }, a);
      await new Promise((r) => setTimeout(r, 900));
      const st = await page.evaluate(() => ({
        fps: window.Smash.debug.stats.fps,
        draws: window.Smash.debug.stats.draws,
        zone: window.Smash.debug.world.zoneAt(window.Smash.debug.car.x, window.Smash.debug.car.z)
      }));
      const file = `${a.name}-${tag}.png`;
      await page.screenshot({ path: path.join(outDir, file), type: 'png' });
      report.shots[`${a.name}-${tag}`] = file;
      report.stats[`${a.name}-${tag}`] = st;
      await page.close();
    }
  }

  const treePage = await browser.newPage();
  await treePage.setViewport({ width: 390, height: 844 });
  await treePage.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  await treePage.waitForFunction(() => window.Smash && window.Smash.debug);
  await treePage.evaluate(() => {
    const c = window.Smash.debug.car;
    c.x = 100;
    c.z = 0;
    c.speed = 14;
    c.vx = 14;
    c.vz = 0;
    c.dirX = 1;
    c.dirZ = 0;
    c._pointerDown = true;
  });
  for (let f = 1; f <= 3; f++) {
    await new Promise((r) => setTimeout(r, 350));
    await treePage.screenshot({ path: path.join(outDir, `tree-fall-f${f}-390.png`), type: 'png' });
  }
  await treePage.close();

  const splashPage = await browser.newPage();
  await splashPage.setViewport({ width: 390, height: 844 });
  await splashPage.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  await splashPage.waitForFunction(() => window.Smash && window.Smash.debug);
  await splashPage.evaluate(() => {
    const c = window.Smash.debug.car;
    c.x = 0;
    c.z = 72;
    c.target = { x: 0, z: 90 };
    c._pointerDown = true;
  });
  for (let f = 1; f <= 3; f++) {
    await new Promise((r) => setTimeout(r, 500));
    await splashPage.screenshot({ path: path.join(outDir, `splash-f${f}-390.png`), type: 'png' });
  }
  await splashPage.close();

  const drivePage = await browser.newPage();
  await drivePage.setViewport({ width: 390, height: 844 });
  await drivePage.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  await drivePage.waitForFunction(() => window.Smash && window.Smash.debug);
  for (let i = 0; i < DRIVE.length; i++) {
    await drivePage.evaluate((pt) => {
      const c = window.Smash.debug.car;
      c.x = pt.x;
      c.z = pt.z;
      c.target = { x: pt.x + 12, z: pt.z + 12 };
      c._pointerDown = true;
    }, DRIVE[i]);
    await new Promise((r) => setTimeout(r, 5000));
    const file = `drive-seg${i + 1}-390.png`;
    await drivePage.screenshot({ path: path.join(outDir, file), type: 'png' });
    report.shots[file.replace('.png', '')] = file;
  }
  await drivePage.close();

  for (const vid of VEHICLES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
    await page.waitForFunction(() => window.Smash && window.Smash.debug);
    await page.evaluate((id) => {
      window.Smash.debug.car.swapTo(id, () => {});
      const c = window.Smash.debug.car;
      c.x = 8;
      c.z = 8;
    }, vid);
    await new Promise((r) => setTimeout(r, 600));
    const file = `vehicle-${vid}-390.png`;
    await page.screenshot({ path: path.join(outDir, file), type: 'png' });
    report.shots[`vehicle-${vid}`] = file;
    await page.close();
  }

  const pickerPage = await browser.newPage();
  await pickerPage.setViewport({ width: 390, height: 844 });
  await pickerPage.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  await pickerPage.waitForFunction(() => window.Smash && window.Smash.debug);
  await pickerPage.click('#car-pick-toggle');
  await new Promise((r) => setTimeout(r, 400));
  await pickerPage.screenshot({ path: path.join(outDir, 'picker-open-390.png'), type: 'png' });
  report.shots['picker-open'] = 'picker-open-390.png';
  await pickerPage.close();

  for (const act of [
    { id: 'fire', frame: 'action-fire-spray-390.png', fn: () => window.Smash.debug.car.triggerAction() },
    { id: 'dump', frame: 'action-dump-tip-390.png', fn: () => { const c = window.Smash.debug.car; c.dumpCargo = 0.8; c.triggerAction(); } }
  ]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
    await page.waitForFunction(() => window.Smash && window.Smash.debug);
    await page.evaluate((id) => window.Smash.debug.car.swapTo(id, () => {}), act.id);
    await page.evaluate(act.fn);
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: path.join(outDir, act.frame), type: 'png' });
    report.shots[act.frame.replace('.png', '')] = act.frame;
    await page.close();
  }

  report.notes.push('FPS/draws from Puppeteer+SwiftShader; not verified on physical iPhone/Android.');
  report.notes.push('20s drive approximated as 4×5s waypoint segments (town→forest→river→mountains).');

  await browser.close();
  server.close();
  fs.writeFileSync(path.join(outDir, 'proof-summary.json'), JSON.stringify(report, null, 2));
  console.log(report.stats);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
