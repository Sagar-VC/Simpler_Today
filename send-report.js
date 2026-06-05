const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function formatDuration(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// Recursively collects all specs — test.describe blocks add a nesting level
function collectSpecs(suites, parentFile) {
  const entries = [];
  for (const suite of suites || []) {
    const file = suite.file || parentFile || suite.title || '—';
    if (suite.suites && suite.suites.length > 0) {
      entries.push(...collectSpecs(suite.suites, file));
    }
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        entries.push({ file, specTitle: spec.title, suiteName: suite.title, test });
      }
    }
  }
  return entries;
}

// SVG solid pie chart with white donut center
function buildPieChart(passed, failed, skipped, flaky, total) {
  const cx = 100, cy = 100, r = 85;

  if (total === 0) {
    return `<svg viewBox="0 0 200 200" width="170" height="170" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#e2e8f0"/>
      <circle cx="${cx}" cy="${cy}" r="48" fill="white"/>
      <text x="100" y="95" text-anchor="middle" font-size="20" font-weight="800" fill="#94a3b8" font-family="Arial">0%</text>
      <text x="100" y="113" text-anchor="middle" font-size="11" fill="#94a3b8" font-family="Arial">No Tests</text>
    </svg>`;
  }

  const segs = [
    { value: passed,  color: '#16a34a' },
    { value: failed,  color: '#e11d48' },
    { value: skipped, color: '#d97706' },
    { value: flaky,   color: '#a855f7' },
  ].filter(s => s.value > 0);

  function point(angleDeg) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return [+(cx + r * Math.cos(rad)).toFixed(2), +(cy + r * Math.sin(rad)).toFixed(2)];
  }

  let paths = '';
  let start = 0;

  if (segs.length === 1) {
    paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${segs[0].color}"/>`;
  } else {
    for (const seg of segs) {
      const sweep = (seg.value / total) * 360;
      const end   = start + sweep;
      const [x1, y1] = point(start);
      const [x2, y2] = point(end);
      const large = sweep > 180 ? 1 : 0;
      paths += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${seg.color}"/>`;
      start = end;
    }
  }

  const passRate = Math.round((passed / total) * 100);

  return `<svg viewBox="0 0 200 200" width="170" height="170" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;">
    ${paths}
    <circle cx="${cx}" cy="${cy}" r="52" fill="white"/>
    <text x="100" y="93" text-anchor="middle" font-size="24" font-weight="800" fill="#1e293b" font-family="Arial,sans-serif">${passRate}%</text>
    <text x="100" y="111" text-anchor="middle" font-size="11" fill="#94a3b8" font-family="Arial,sans-serif">PASSED</text>
  </svg>`;
}

function buildEmailHTML(resultsData, env) {
  const stats     = resultsData.stats || {};
  // stats.expected = tests that ran as expected (= passed)
  // stats.unexpected = tests that failed unexpectedly (= failed)
  const passed    = stats.expected   || 0;
  const failed    = stats.unexpected || 0;
  const skipped   = stats.skipped    || 0;
  const flaky     = stats.flaky      || 0;
  const total     = passed + failed + skipped + flaky;
  const passRate  = total > 0 ? Math.round((passed / total) * 100) : 0;
  const duration  = formatDuration(stats.duration || 0);
  const startTime = stats.startTime
    ? new Date(stats.startTime).toLocaleString()
    : new Date().toLocaleString();

  // Group entries by file and assign T-IDs
  const entries = collectSpecs(resultsData.suites, '');
  const fileGroups = {};
  let idx = 1;
  for (const e of entries) {
    if (!fileGroups[e.file]) fileGroups[e.file] = [];
    fileGroups[e.file].push({ ...e, testId: `T${String(idx++).padStart(3, '0')}` });
  }

  // Legend item helper
  function legendCell(label, color, count) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `<td style="padding:8px 10px;vertical-align:top;width:50%;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top;padding-right:8px;padding-top:2px;">
          <div style="width:11px;height:11px;border-radius:50%;background:${color};margin-top:2px;"></div>
        </td>
        <td>
          <div style="font-size:13px;font-weight:700;color:#1e293b;">${count} ${label}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:1px;">${pct}% set to ${label}</div>
        </td>
      </tr></table>
    </td>`;
  }

  // Build file-grouped test rows
  let tableRows = '';
  for (const [file, tests] of Object.entries(fileGroups)) {
    // File header row
    tableRows += `
    <tr>
      <td colspan="3" style="padding:10px 16px 8px;background:#f8fafc;border-top:2px solid #e2e8f0;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td>
            <span style="background:#0f766e;color:#fff;padding:4px 12px;border-radius:5px;font-size:12px;font-weight:700;letter-spacing:.3px;">${file}</span>
            <span style="background:#e2e8f0;color:#64748b;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;margin-left:8px;">${tests.length}</span>
          </td>
        </tr></table>
      </td>
    </tr>`;

    // Test rows
    for (const t of tests) {
      const result   = t.test.results?.[0] || {};
      const status   = result.status || 'unknown';
      const isPassed = status === 'passed';
      const isFailed = status === 'failed' || status === 'timedOut';
      const rowBg    = isPassed ? '#ffffff' : isFailed ? '#fff5f5' : '#fffbeb';
      const dotColor = isPassed ? '#16a34a' : isFailed ? '#e11d48' : '#d97706';
      const label    = isPassed ? 'Passed' : isFailed ? 'Failed' : 'Skipped';
      const badgeBg  = isPassed ? '#dcfce7' : isFailed ? '#fee2e2' : '#fef3c7';
      const badgeFg  = isPassed ? '#15803d' : isFailed ? '#b91c1c' : '#b45309';

      tableRows += `
      <tr style="background:${rowBg};border-bottom:1px solid #f1f5f9;">
        <td style="padding:11px 16px;font-size:12px;color:#94a3b8;white-space:nowrap;width:60px;">${t.testId}</td>
        <td style="padding:11px 16px;font-size:13px;color:#1e293b;">${t.specTitle}</td>
        <td style="padding:11px 16px;text-align:right;white-space:nowrap;">
          <table cellpadding="0" cellspacing="0" style="display:inline-table;">
            <tr>
              <td style="vertical-align:middle;padding-right:6px;">
                <div style="width:8px;height:8px;border-radius:50%;background:${dotColor};"></div>
              </td>
              <td>
                <span style="background:${badgeBg};color:${badgeFg};padding:4px 12px;border-radius:5px;font-size:11px;font-weight:700;">${label}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    }
  }

  if (!tableRows) {
    tableRows = `<tr><td colspan="3" style="padding:24px;text-align:center;color:#94a3b8;font-size:13px;">No test data available</td></tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 16px;">
<tr><td align="center">
<table width="660" cellpadding="0" cellspacing="0" style="max-width:660px;width:100%;">

  <!-- HEADER -->
  <tr>
    <td style="background:linear-gradient(135deg,#0f766e 0%,#134e4a 100%);padding:28px 36px 24px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:.5px;">SimplerToday.ai</div>
      <div style="font-size:11px;color:#99f6e4;margin-top:5px;letter-spacing:1px;text-transform:uppercase;">Automated QA Test Report</div>
      <div style="margin-top:14px;font-size:12px;color:#ccfbf1;">
        📅 ${startTime} &nbsp;·&nbsp; 🌐 ${env}
      </div>
    </td>
  </tr>

  <!-- PIE CHART + LEGEND -->
  <tr>
    <td style="background:#ffffff;padding:28px 36px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <!-- Pie chart -->
          <td style="vertical-align:middle;text-align:center;width:190px;">
            ${buildPieChart(passed, failed, skipped, flaky, total)}
          </td>
          <!-- Legend grid -->
          <td style="vertical-align:middle;padding-left:16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                ${legendCell('Passed',      '#16a34a', passed)}
                ${legendCell('In Progress', '#3b82f6', 0)}
              </tr>
              <tr>
                ${legendCell('Blocked',     '#374151', 0)}
                ${legendCell('Timed Out',   '#f97316', 0)}
              </tr>
              <tr>
                ${legendCell('Flaky',       '#a855f7', flaky)}
                ${legendCell('Failed',      '#e11d48', failed)}
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- PASS RATE TEXT -->
  <tr>
    <td style="background:#ffffff;padding:4px 36px 24px;text-align:center;border-bottom:1px solid #e2e8f0;">
      <div style="font-size:26px;font-weight:800;color:#1e293b;">${passRate}% Passed</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px;">
        ${total - passed} / ${total} not passed (${100 - passRate}%)
        &nbsp;·&nbsp; ⏱ ${duration}
      </div>
    </td>
  </tr>

  <!-- SUMMARY BAR -->
  <tr>
    <td style="background:#f8fafc;padding:10px 36px;border-bottom:1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:12px;color:#64748b;">
            Total: <strong style="color:#334155;">${total}</strong>
            &nbsp;&nbsp;
            Passed: <strong style="color:#15803d;">${passed}</strong>
            &nbsp;&nbsp;
            Failed: <strong style="color:#b91c1c;">${failed}</strong>
            &nbsp;&nbsp;
            Skipped: <strong style="color:#b45309;">${skipped}</strong>
          </td>
          <td align="right">
            <span style="background:${passRate === 100 ? '#dcfce7' : passRate >= 70 ? '#fef3c7' : '#fee2e2'};
                         color:${passRate === 100 ? '#15803d' : passRate >= 70 ? '#b45309' : '#b91c1c'};
                         padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;">
              ${passRate === 100 ? '✅ All Passed' : passRate >= 70 ? '⚠️ Some Failed' : '❌ Tests Failed'}
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- TEST RESULTS TABLE -->
  <tr>
    <td style="background:#ffffff;padding:0 0 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background:#f8fafc;">
          <th style="padding:10px 16px;text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;border-bottom:2px solid #e2e8f0;width:60px;">ID</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;border-bottom:2px solid #e2e8f0;">Title</th>
          <th style="padding:10px 16px;text-align:right;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;border-bottom:2px solid #e2e8f0;width:110px;">Status</th>
        </tr>
        ${tableRows}
      </table>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#0f766e;padding:18px 36px;border-radius:0 0 12px 12px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#99f6e4;">Generated by Playwright Automation &bull; SimplerToday.ai QA Team</p>
      <p style="margin:5px 0 0;font-size:11px;color:#5eead4;">Full interactive HTML report is attached.</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendReport() {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const resultsPath = path.join(__dirname, 'test-results', 'results.json');
      if (!fs.existsSync(resultsPath)) {
        console.error('❌ No test results found. Make sure tests were run first.');
        process.exit(1);
      }

      let transportConfig;
      if (process.env.EMAIL_SERVICE === 'outlook') {
        transportConfig = {
          host: 'smtp.office365.com',
          port: 587,
          secure: false,
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
        };
      } else {
        transportConfig = {
          service: process.env.EMAIL_SERVICE || 'gmail',
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
        };
      }

      const transporter = nodemailer.createTransport(transportConfig);

      await Promise.race([
        transporter.verify(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        ),
      ]);
      console.log('✅ Email connection verified');

      const reportPath  = path.join(__dirname, 'playwright-report', 'index.html');
      const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
      const env         = process.env.BASE_URL || 'Development (Demo)';

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TO,
        subject: `SimplerToday QA Report — ${new Date().toLocaleDateString()} | ${resultsData.stats?.unexpected ? '❌ Failures detected' : '✅ All Passed'}`,
        html: buildEmailHTML(resultsData, env),
        attachments: [],
      };

      if (fs.existsSync(reportPath)) {
        mailOptions.attachments.push({
          filename: 'playwright-report.html',
          path: reportPath,
        });
      }

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Report sent successfully!');
      console.log('Message ID:', info.messageId);
      process.exit(0);

    } catch (error) {
      retryCount++;
      console.error(`❌ Error sending report (attempt ${retryCount}/${maxRetries}):`, error.message);

      if (retryCount < maxRetries) {
        const waitTime = 2000 * retryCount;
        console.log(`⏳ Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error('❌ Max retries exceeded. Unable to send report.');
        console.error('Full error:', error);
        process.exit(1);
      }
    }
  }
}

sendReport();
