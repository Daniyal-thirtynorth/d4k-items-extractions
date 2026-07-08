const path = require("path");
const puppeteer = require("puppeteer-core");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FILE = "file://" + path.join(__dirname, "leicht_units__562_.html");
const OUT = process.argv[2] || "panel.png";
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu"], defaultViewport:{width:560,height:1500} });
  const p = await b.newPage();
  // allow images this time so the panel looks real
  await p.goto(FILE, { waitUntil: "domcontentloaded", timeout: 180000 });
  await p.waitForFunction(() => typeof window.goFam === "function" && document.getElementById("panel"), { timeout: 180000 });
  await p.evaluate(() => { window.goFam("TK6080BZ2"); });
  // open the panel + select the Visible Sides tab
  await p.evaluate(() => {
    const panel = document.getElementById("panel");
    panel.classList.add("open"); document.getElementById("scrim") && document.getElementById("scrim").classList.add("show");
    const btns = [...document.querySelectorAll("#pin .alttab")];
    const vs = btns.find(b => /Visible Sides/.test(b.textContent));
    if (vs) vs.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  const el = await p.$("#panel");
  await el.screenshot({ path: path.join(__dirname, OUT) });
  console.log("wrote", OUT);
  await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
