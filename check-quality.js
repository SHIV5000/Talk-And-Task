#!/usr/bin/env node
const { execSync } = require('child_process');
const { createServer } = require('http');
const { readFileSync, existsSync, writeFileSync } = require('fs');
const { join, resolve } = require('path');
let LinkChecker;
try {
  LinkChecker = require('linkinator').LinkChecker;
} catch (e) {
  console.error('linkinator not installed. Install with: npm install --save-dev linkinator');
  process.exit(1);
}

// ---------- CONFIGURATION ----------
const BUILD_DIR = process.argv[2] || './build';
const CSS_FILE = 'src/index.css';          // change if your main CSS is elsewhere
const LIGHT_SELECTOR = ':root';
const DARK_SELECTOR = '.dark';             // or [data-theme="dark"]
const I18N_RULE = 'i18next/no-literal-string'; // use 'formatjs/no-literal-string-in-jsx' for react-intl
const REPORT_FILE = 'quality-report.txt';
// ------------------------------------

const report = [];
function addLine(line) { report.push(line); }

// --- 1. Broken links ---
async function checkBrokenLinks() {
  addLine('=== BROKEN LINKS ===');
  const buildPath = resolve(BUILD_DIR);
  if (!existsSync(buildPath)) {
    addLine('❌ Build folder not found. Run npm run build first.');
    return;
  }

  const server = createServer((req, res) => {
    let urlPath = req.url === '/' ? '/index.html' : req.url;
    let filePath = join(buildPath, urlPath);
    try {
      res.writeHead(200);
      res.end(readFileSync(filePath));
    } catch (e) {
      // For SPA fallback: serve index.html for all unknown routes
      try {
        res.writeHead(200);
        res.end(readFileSync(join(buildPath, 'index.html')));
      } catch (e2) {
        res.writeHead(404);
        res.end('Not found');
      }
    }
  });

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    const checker = new LinkChecker();
    const result = await checker.check({ path: baseUrl, recurse: true });
    const broken = result.links.filter(l => l.state === 'BROKEN');
    if (broken.length === 0) {
      addLine('✅ No broken internal links found.');
    } else {
      addLine(`❌ ${broken.length} broken link(s) found:`);
      broken.forEach(l => addLine(`   - ${l.url} (status: ${l.status}) on page: ${l.parent || 'unknown'}`));
    }
  } catch (err) {
    addLine('❌ Link check failed: ' + err.message);
  } finally {
    server.close();
  }
}

// --- 2. Hardcoded colours (stylelint) ---
function checkHardcodedColors() {
  addLine('\n=== DARK MODE: HARDCODED COLOURS ===');
  try {
    execSync('npx stylelint "src/**/*.css" "src/**/*.scss" --formatter json 2>/dev/null', { stdio: 'pipe' });
  } catch (e) {
    // stylelint exits with code 2 for lint errors, stdout still contains JSON.
    if (e.stdout) {
      try {
        const output = JSON.parse(e.stdout);
        let found = false;
        output.forEach(file => {
          file.warnings.forEach(w => {
            found = true;
            addLine(`❌ Hardcoded colour in ${file.source}:${w.line} – ${w.text}`);
          });
        });
        if (!found) addLine('✅ All colour properties use CSS variables.');
      } catch (_) {
        addLine('❌ Could not parse stylelint output.');
      }
    } else {
      addLine('⚠️  stylelint not installed or no CSS files found. Skipping.');
    }
  }
}

// --- 3. Theme variable mapping ---
function checkThemeMapping() {
  addLine('\n=== DARK MODE: THEME VARIABLE MAPPING ===');
  const cssPath = resolve(CSS_FILE);
  if (!existsSync(cssPath)) {
    addLine(`❌ CSS file not found: ${CSS_FILE}. Skipping theme mapping.`);
    return;
  }
  try {
    const css = readFileSync(cssPath, 'utf8');
    const extractVars = (block) => {
      const matches = block.match(/--[\w-]+/g);
      return new Set(matches || []);
    };
    const getBlock = (selector) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's');
      const match = css.match(regex);
      return match ? match[1] : '';
    };
    const lightBlock = getBlock(LIGHT_SELECTOR);
    const darkBlock = getBlock(DARK_SELECTOR);
    if (!lightBlock || !darkBlock) {
      addLine('⚠️  Could not find both theme blocks. Check LIGHT/DARK_SELECTOR values.');
      return;
    }
    const lightVars = extractVars(lightBlock);
    const darkVars = extractVars(darkBlock);
    const missingInDark = [...lightVars].filter(v => !darkVars.has(v));
    const missingInLight = [...darkVars].filter(v => !lightVars.has(v));
    if (missingInDark.length === 0 && missingInLight.length === 0) {
      addLine('✅ All theme variables are present in both light and dark blocks.');
    } else {
      if (missingInDark.length) {
        addLine(`❌ Variables in "${LIGHT_SELECTOR}" missing in "${DARK_SELECTOR}":`);
        missingInDark.forEach(v => addLine(`   - ${v}`));
      }
      if (missingInLight.length) {
        addLine(`❌ Variables in "${DARK_SELECTOR}" missing in "${LIGHT_SELECTOR}":`);
        missingInLight.forEach(v => addLine(`   - ${v}`));
      }
    }
  } catch (err) {
    addLine('❌ Error parsing CSS: ' + err.message);
  }
}

// --- 4. Universal labels ---
function checkI18n() {
  addLine('\n=== UNIVERSAL LABELS (i18n) ===');
  try {
    execSync('npx eslint src --ext .js,.jsx,.ts,.tsx --format json --rule "{\\"' + I18N_RULE + '\\": \\"error\\"}"', { stdio: 'pipe' });
  } catch (e) {
    if (e.stdout) {
      try {
        const output = JSON.parse(e.stdout);
        let found = false;
        output.forEach(file => {
          file.messages.forEach(msg => {
            if (msg.ruleId === I18N_RULE) {
              found = true;
              addLine(`❌ Hardcoded text in ${file.filePath}:${msg.line} – ${msg.message}`);
            }
          });
        });
        if (!found) addLine('✅ No hardcoded strings found.');
      } catch (_) {
        addLine('❌ Could not parse ESLint output.');
      }
    } else {
      addLine('⚠️  ESLint not installed or no JS files found. Skipping.');
    }
  }
}

// --- Main ---
(async () => {
  console.log('Running quality checks...');
  await checkBrokenLinks();
  checkHardcodedColors();
  checkThemeMapping();
  checkI18n();

  const fullReport = report.join('\n');
  writeFileSync(REPORT_FILE, fullReport, 'utf8');
  console.log(`Report written to ${REPORT_FILE}`);
})();
