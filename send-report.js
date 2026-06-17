const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
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

function buildEmailHTML(resultsData, env, summaryUrl, emailOnly) {
  summaryUrl = summaryUrl || '';
  emailOnly  = !!emailOnly;
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

  const entries = collectSpecs(resultsData.suites, '');
  const fileGroups = {};
  let idx = 1;
  for (const e of entries) {
    if (!fileGroups[e.file]) fileGroups[e.file] = [];
    fileGroups[e.file].push({ ...e, testId: `T${String(idx++).padStart(3, '0')}` });
  }

  function legendRow(color, label, count) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `<tr>
      <td style="padding:6px 0;vertical-align:middle;white-space:nowrap;">
        <div style="width:9px;height:9px;border-radius:3px;background:${color};display:inline-block;"></div>
        <span style="font-size:13px;color:var(--tx-2,#475569);font-weight:500;margin-left:9px;">${label}</span>
      </td>
      <td style="padding:6px 0 6px 16px;text-align:right;white-space:nowrap;">
        <span style="font-size:13px;font-weight:700;color:var(--tx-1,#0f172a);">${count}</span>
        <span style="font-size:11px;color:var(--tx-3,#64748b);margin-left:6px;font-weight:500;">${pct}%</span>
      </td>
    </tr>`;
  }

  const bannerBg     = passRate === 100 ? '#f0fdf4' : passRate >= 70 ? '#fefce8' : '#fff1f2';
  const bannerBorder = passRate === 100 ? '#bbf7d0' : passRate >= 70 ? '#fde68a' : '#fecdd3';
  const bannerColor  = passRate === 100 ? '#15803d' : passRate >= 70 ? '#a16207' : '#be123c';
  const bannerText   = passRate === 100
    ? '&#x2705;&nbsp; All tests passed successfully'
    : passRate >= 70
    ? '&#x26A0;&#xFE0F;&nbsp; Some tests failed'
    : '&#x274C;&nbsp; Tests failed';

  // Build file-grouped test rows with data attributes for JS filtering
  let tableRows = '';
  if (!emailOnly) {
  let fileIdx = 0;
  for (const [file, tests] of Object.entries(fileGroups)) {
    const fid = `f${fileIdx++}`;
    const filePassed  = tests.filter(t => (t.test.results?.[0]?.status || '') === 'passed').length;
    const fileFailed  = tests.filter(t => { const s = t.test.results?.[0]?.status || ''; return s === 'failed' || s === 'timedOut'; }).length;
    const fileSkipped = tests.length - filePassed - fileFailed;

    const passedBadge  = filePassed  > 0
      ? `<a href="${summaryUrl}#passed"  onclick="filterTests('passed');return false;"  title="Show Passed only"  style="cursor:pointer;text-decoration:none;background:#dcfce7;color:#15803d;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;margin-left:6px;display:inline-block;">&#10003; ${filePassed} Passed</a>`
      : `<span style="opacity:.35;background:#f1f5f9;color:#94a3b8;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;margin-left:6px;display:inline-block;">&#10003; 0 Passed</span>`;
    const failedBadge  = fileFailed  > 0
      ? `<a href="${summaryUrl}#failed"  onclick="filterTests('failed');return false;"  title="Show Failed only"  style="cursor:pointer;text-decoration:none;background:#fee2e2;color:#b91c1c;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;margin-left:6px;display:inline-block;">&#10007; ${fileFailed} Failed</a>`
      : `<span style="opacity:.35;background:#f1f5f9;color:#94a3b8;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;margin-left:6px;display:inline-block;">&#10007; 0 Failed</span>`;
    const skippedBadge = fileSkipped > 0
      ? `<a href="${summaryUrl}#skipped" onclick="filterTests('skipped');return false;" title="Show Skipped only" style="cursor:pointer;text-decoration:none;background:#fef3c7;color:#b45309;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;margin-left:6px;display:inline-block;">&#8212; ${fileSkipped} Skipped</a>`
      : `<span style="opacity:.35;background:#f1f5f9;color:#94a3b8;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;margin-left:6px;display:inline-block;">&#8212; 0 Skipped</span>`;

    tableRows += `
    <tr id="fh-${fid}" class="file-header" data-fid="${fid}">
      <td colspan="4" class="td-fhdr" style="padding:13px 20px 12px;background:linear-gradient(90deg,#f0fdfa,#f8fafc);border-top:3px solid var(--bd,#e2e8f0);border-bottom:1px solid #ccfbf1;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;">
            <span style="background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;padding:5px 14px;border-radius:8px;font-size:11px;font-weight:700;letter-spacing:.4px;box-shadow:0 2px 6px rgba(15,118,110,.25);">${file}</span>
            <span style="font-size:11px;color:var(--fc,#64748b);margin-left:10px;font-weight:600;">${tests.length} test${tests.length !== 1 ? 's' : ''}</span>
          </td>
          <td align="right" style="vertical-align:middle;white-space:nowrap;">
            ${passedBadge}${failedBadge}${skippedBadge}
          </td>
        </tr></table>
      </td>
    </tr>`;

    for (const t of tests) {
      const result    = t.test.results?.[0] || {};
      const status    = result.status || 'unknown';
      const testDur   = result.duration ? formatDuration(result.duration) : '&mdash;';
      const isPassed  = status === 'passed';
      const isFailed  = status === 'failed' || status === 'timedOut';
      const isFlaky   = status === 'flaky';
      const statusKey = isPassed ? 'passed' : isFailed ? 'failed' : isFlaky ? 'flaky' : 'skipped';
      const rowBg     = isPassed ? 'var(--row-p,#ffffff)' : isFailed ? 'var(--row-f,#fff5f5)' : isFlaky ? 'var(--row-k,#faf5ff)' : 'var(--row-s,#fffbeb)';
      const label     = isPassed ? 'Passed'
        : isFailed ? (status === 'timedOut' ? 'Timed Out' : 'Failed')
        : isFlaky ? 'Flaky'
        : 'Skipped';
      const badgeBg   = isPassed ? '#dcfce7' : isFailed ? '#fee2e2' : isFlaky ? '#f3e8ff' : '#fef3c7';
      const badgeFg   = isPassed ? '#15803d' : isFailed ? '#b91c1c' : isFlaky ? '#7e22ce' : '#b45309';

      tableRows += `
      <tr class="test-row" data-status="${statusKey}" data-fid="${fid}" style="background:${rowBg};border-bottom:1px solid var(--row-bd,#f1f5f9);">
        <td style="padding:13px 20px;font-size:11px;color:var(--tx-3,#64748b);font-weight:700;white-space:nowrap;width:58px;letter-spacing:.3px;">${t.testId}</td>
        <td style="padding:13px 20px;font-size:13px;color:var(--tx-1,#0f172a);font-weight:500;line-height:1.4;">${t.specTitle}</td>
        <td style="padding:13px 20px;font-size:12px;color:var(--tx-2,#475569);text-align:center;white-space:nowrap;width:85px;font-variant-numeric:tabular-nums;">${testDur}</td>
        <td style="padding:13px 20px;text-align:right;white-space:nowrap;width:115px;">
          <span style="background:${badgeBg};color:${badgeFg};padding:5px 13px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;letter-spacing:.2px;">${label}</span>
        </td>
      </tr>`;
    }
  }

  if (!tableRows) {
    tableRows = `<tr><td colspan="4" style="padding:32px;text-align:center;color:#94a3b8;font-size:13px;">No test data available</td></tr>`;
  }
  } // end if (!emailOnly)

  // Email body: show a "View in browser" CTA instead of the full test table.
  // Browser report (summary-report.html): show the full filterable table.
  const testResultsSection = emailOnly
    ? `  <!-- VIEW FULL REPORT CTA (email body only) -->
  <tr>
    <td style="padding:32px 44px 36px;text-align:center;background:linear-gradient(180deg,var(--bg-sec,#f8fafc),var(--bg-tint,#f1f5f9));border-top:2px solid var(--bd,#e2e8f0);">
      <div style="font-size:10px;color:var(--tx-lbl,#334155);margin-bottom:6px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Interactive Test Results</div>
      <div style="font-size:14px;color:var(--tx-1,#0f172a);margin-bottom:24px;line-height:1.6;font-weight:400;">
        Open the <strong style="color:#0f766e;">Summary Report</strong> attachment in your browser for the full filterable test list.
      </div>
      <table cellpadding="0" cellspacing="0" align="center"><tr>
        <td style="padding:0 6px;">
          <a href="${summaryUrl}#all" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:10px;font-weight:700;font-size:13px;letter-spacing:.2px;border:2px solid #0f766e;">&#9654;&nbsp; View All&nbsp;(${total})</a>
        </td>${failed > 0 ? `
        <td style="padding:0 6px;">
          <a href="${summaryUrl}#failed" style="display:inline-block;background:#e11d48;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:10px;font-weight:700;font-size:13px;letter-spacing:.2px;border:2px solid #e11d48;">&#10007;&nbsp; View Failed&nbsp;(${failed})</a>
        </td>` : ''}
      </tr></table>
    </td>
  </tr>`
    : `  <!-- TEST RESULTS SECTION TITLE -->
  <tr>
    <td style="background:var(--bg-tint,#f1f5f9);padding:14px 20px;border-top:2px solid var(--bd,#e2e8f0);border-bottom:1px solid var(--bd,#e2e8f0);">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:12px;font-weight:700;color:var(--tx-2,#475569);text-transform:uppercase;letter-spacing:1.2px;">&#128202;&nbsp; Test Results</td>
        <td align="right">
          <span id="filter-label" style="font-size:11px;color:var(--fil-tx,#0f766e);font-weight:700;background:var(--fil-bg,#f0fdf4);padding:4px 12px;border-radius:20px;border:1.5px solid var(--fil-bd,#6ee7b7);">Showing: All Tests (${total})</span>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- TEST RESULTS TABLE -->
  <tr>
    <td style="background:var(--bg-card,#ffffff);padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead class="test-thead">
        <tr style="background:var(--th-bg,#f8fafc);">
          <th style="padding:11px 20px;text-align:left;font-size:10px;color:var(--th-tx,#64748b);text-transform:uppercase;letter-spacing:1px;font-weight:700;border-bottom:2px solid var(--th-bd,#e2e8f0);width:58px;">ID</th>
          <th style="padding:11px 20px;text-align:left;font-size:10px;color:var(--th-tx,#64748b);text-transform:uppercase;letter-spacing:1px;font-weight:700;border-bottom:2px solid var(--th-bd,#e2e8f0);">Test Name</th>
          <th style="padding:11px 20px;text-align:center;font-size:10px;color:var(--th-tx,#64748b);text-transform:uppercase;letter-spacing:1px;font-weight:700;border-bottom:2px solid var(--th-bd,#e2e8f0);width:85px;">Duration</th>
          <th style="padding:11px 20px;text-align:right;font-size:10px;color:var(--th-tx,#64748b);text-transform:uppercase;letter-spacing:1px;font-weight:700;border-bottom:2px solid var(--th-bd,#e2e8f0);width:115px;">Status</th>
        </tr>
        </thead>
        ${tableRows}
      </table>
    </td>
  </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <style>
    /* Browser-only — email clients ignore <style> blocks. */
    *, *::before, *::after { box-sizing: border-box; }

    /* ══════════════════════════════════════════
       CSS custom properties — light (default)
       ══════════════════════════════════════════ */
    :root {
      --bg-page:   #eef2f7;  --bg-card:    #ffffff;
      --bg-sec:    #f8fafc;  --bg-tint:    #f1f5f9;
      --tx-1:   #0f172a;  --tx-2:   #475569;
      --tx-3:   #64748b;  --tx-lbl: #334155;
      --bd:     #e2e8f0;  --bd-s:   #f1f5f9;
      --c-all-bg:  #f8fafc;  --c-all-n:  #1e293b;
      --c-pas-bg:  #f0fdf4;  --c-pas-n:  #16a34a;
      --c-fai-bg:  #fff5f5;  --c-fai-n:  #e11d48;
      --c-ski-bg:  #fffbeb;  --c-ski-n:  #d97706;
      --row-p:  #ffffff;  --row-f:  #fff5f5;
      --row-s:  #fffbeb;  --row-k:  #faf5ff;
      --row-bd: #f1f5f9;
      --th-bg:  #f8fafc;  --th-tx:  #64748b;  --th-bd:  #e2e8f0;
      --pgr:    #e8edf5;  --lsep:   #e8edf5;  --fc:     #64748b;
      --fil-bg: #f0fdf4;  --fil-tx: #0f766e;  --fil-bd: #6ee7b7;
    }

    /* ══════════════════════════════════════════
       Dark theme overrides
       ══════════════════════════════════════════ */
    @media (prefers-color-scheme: dark) {
      :root {
        --bg-page:   #0f172a;  --bg-card:    #1e293b;
        --bg-sec:    #182030;  --bg-tint:    #1a2535;
        --tx-1:   #f1f5f9;  --tx-2:   #94a3b8;
        --tx-3:   #64748b;  --tx-lbl: #94a3b8;
        --bd:     #334155;  --bd-s:   #2d3f55;
        --c-all-bg:  #253347;  --c-all-n:  #e2e8f0;
        --c-pas-bg:  #042813;  --c-pas-n:  #4ade80;
        --c-fai-bg:  #280a12;  --c-fai-n:  #f87171;
        --c-ski-bg:  #241a06;  --c-ski-n:  #fbbf24;
        --row-p:  #0a1f12;  --row-f:  #1a0a10;
        --row-s:  #1a150a;  --row-k:  #160a24;
        --row-bd: #1e293b;
        --th-bg:  #1e293b;  --th-tx:  #94a3b8;  --th-bd:  #334155;
        --pgr:    #1e293b;  --lsep:   #334155;  --fc:     #64748b;
        --fil-bg: #042813;  --fil-tx: #4ade80;  --fil-bd: #166534;
      }
      body { background: linear-gradient(135deg,#0a0f1e 0%,#0f172a 45%,#0c2340 100%) !important; }
      .report-card { box-shadow: 0 32px 80px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.07) !important; }
      /* File header gradient can't be expressed with a single var — override here */
      .td-fhdr { background: linear-gradient(90deg,#0e2825,#1a2535) !important;
                 border-top-color:    #1e3a5f !important;
                 border-bottom-color: #163830 !important; }
    }

    /* ── Base component styles ── */
    body { background: var(--bg-page,#eef2f7); min-height: 100vh; }
    .report-outer { background: transparent !important; }
    .report-card  { border-radius:18px !important; overflow:hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,.1), 0 0 0 1px rgba(0,0,0,.05) !important; }
    .stat-card { cursor:pointer; transition:box-shadow .18s, transform .18s; }
    .stat-card:hover { box-shadow:0 10px 30px rgba(0,0,0,.14) !important; transform:translateY(-3px) scale(1.03); }
    .stat-card.active { box-shadow:0 0 0 3px #0f766e, 0 8px 28px rgba(15,118,110,.28) !important; }
    .test-row { transition:background .1s; }
    .test-row:hover td { background:rgba(14,116,144,.05) !important; }
    .test-thead th { position:sticky; top:0; z-index:10; }
    @keyframes slideUp { from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);} }
    .report-card { animation:slideUp .35s ease-out both; }
    ::-webkit-scrollbar { width:6px; height:6px; }
    ::-webkit-scrollbar-track { background:var(--bg-sec,#f8fafc); }
    ::-webkit-scrollbar-thumb { background:var(--bd,#e2e8f0); border-radius:3px; }
  </style>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">

<!-- Visible in email clients where JS is stripped; hidden by JS when opened in a browser. -->
<div id="interactive-notice" style="background:#eff6ff;border-bottom:3px solid #3b82f6;padding:13px 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1e40af;text-align:center;">
  &#128279;&nbsp; <strong>Click any count card to open the full interactive report in your browser.</strong>
  &nbsp; If a link doesn't respond, open the attached <strong>summary-report.html</strong> directly.
</div>

<table width="100%" cellpadding="0" cellspacing="0" class="report-outer" style="background:var(--bg-page,#eef2f7);padding:36px 16px;">
<tr><td align="center">
<table width="660" cellpadding="0" cellspacing="0" class="report-card" style="max-width:660px;width:100%;border-radius:18px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.12);">

  <!-- HEADER -->
  <tr>
    <td bgcolor="#0d9488" style="background-color:#0d9488;background:linear-gradient(135deg,#0d9488 0%,#0f766e 40%,#064e3b 100%);padding:36px 44px 30px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">
            <div style="font-size:9px;color:#ffffff;letter-spacing:2.5px;text-transform:uppercase;font-weight:600;margin-bottom:6px;opacity:.85;">Automated QA Test Report</div>
            <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-.2px;line-height:1.1;">SimplerToday<span style="color:#ccfbf1;">.ai</span></div>
          </td>
          <td align="right" style="vertical-align:middle;">
            <div style="background:rgba(255,255,255,.18);color:#ffffff;padding:7px 16px;border-radius:24px;font-size:11px;font-weight:700;border:1.5px solid rgba(255,255,255,.5);white-space:nowrap;display:inline-block;">
              &#127760;&nbsp; ${env}
            </div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:20px;padding-bottom:0;">
            <div style="height:1px;background:rgba(255,255,255,.25);"></div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:14px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="padding-right:20px;">
                <span style="font-size:12px;color:#ffffff;font-weight:500;opacity:.9;">&#128197;&nbsp; ${startTime}</span>
              </td>
              <td>
                <span style="font-size:12px;color:#ffffff;font-weight:500;opacity:.9;">&#9201;&nbsp; ${duration}</span>
              </td>
            </tr></table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- STATUS BANNER -->
  <tr>
    <td style="background:${bannerBg};padding:14px 44px;border-left:5px solid ${bannerColor};border-bottom:2px solid ${bannerBorder};">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:13px;font-weight:700;color:${bannerColor};">${bannerText}</td>
        <td align="right">
          <span style="font-size:12px;font-weight:600;color:${bannerColor};background:rgba(0,0,0,.05);padding:4px 12px;border-radius:20px;white-space:nowrap;">${passed}&nbsp;/&nbsp;${total} passed</span>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- STAT CARDS — clickable filters -->
  <tr>
    <td style="background:var(--bg-card,#ffffff);padding:24px 36px 20px;border-bottom:1px solid var(--bd-s,#f1f5f9);">
      <div style="font-size:10px;color:var(--tx-lbl,#334155);text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-bottom:12px;">&#128269;&nbsp; Click a card to filter results</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:0 6px 0 0;">
            <a id="card-all" href="${summaryUrl}#all" onclick="filterTests('all');return false;" class="stat-card active" style="background:var(--c-all-bg,#f8fafc);border-radius:12px;padding:18px 10px 14px;text-align:center;display:block;text-decoration:none;color:inherit;border-top:4px solid #64748b;box-shadow:0 2px 10px rgba(0,0,0,.06);">
              <div style="font-size:30px;font-weight:800;color:var(--c-all-n,#1e293b);line-height:1;">${total}</div>
              <div style="font-size:10px;color:var(--tx-3,#64748b);margin-top:6px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">All Tests</div>
            </a>
          </td>
          <td style="padding:0 6px;">
            <a id="card-passed" href="${summaryUrl}#passed" onclick="filterTests('passed');return false;" class="stat-card" style="background:var(--c-pas-bg,#f0fdf4);border-radius:12px;padding:18px 10px 14px;text-align:center;display:block;text-decoration:none;color:inherit;border-top:4px solid #16a34a;box-shadow:0 2px 10px rgba(22,163,74,.1);">
              <div style="font-size:30px;font-weight:800;color:var(--c-pas-n,#16a34a);line-height:1;">${passed}</div>
              <div style="font-size:10px;color:var(--c-pas-n,#16a34a);opacity:.75;margin-top:6px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Passed</div>
            </a>
          </td>
          <td style="padding:0 6px;">
            <a id="card-failed" href="${summaryUrl}#failed" onclick="filterTests('failed');return false;" class="stat-card" style="background:var(--c-fai-bg,#fff5f5);border-radius:12px;padding:18px 10px 14px;text-align:center;display:block;text-decoration:none;color:inherit;border-top:4px solid #e11d48;box-shadow:0 2px 10px rgba(225,29,72,.1);">
              <div style="font-size:30px;font-weight:800;color:var(--c-fai-n,#e11d48);line-height:1;">${failed}</div>
              <div style="font-size:10px;color:var(--c-fai-n,#e11d48);opacity:.75;margin-top:6px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Failed</div>
            </a>
          </td>
          <td style="padding:0 0 0 6px;">
            <a id="card-skipped" href="${summaryUrl}#skipped" onclick="filterTests('skipped');return false;" class="stat-card" style="background:var(--c-ski-bg,#fffbeb);border-radius:12px;padding:18px 10px 14px;text-align:center;display:block;text-decoration:none;color:inherit;border-top:4px solid #d97706;box-shadow:0 2px 10px rgba(217,119,6,.1);">
              <div style="font-size:30px;font-weight:800;color:var(--c-ski-n,#d97706);line-height:1;">${skipped}</div>
              <div style="font-size:10px;color:var(--c-ski-n,#d97706);opacity:.75;margin-top:6px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Skipped</div>
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- PIE CHART + LEGEND -->
  <tr>
    <td style="background:linear-gradient(180deg,var(--bg-card,#ffffff),var(--bg-sec,#f8fafc));padding:10px 44px 28px;border-bottom:1px solid var(--bd,#e2e8f0);">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;text-align:center;width:185px;">
            ${buildPieChart(passed, failed, skipped, flaky, total)}
          </td>
          <td style="vertical-align:middle;padding-left:32px;">
            <div style="font-size:10px;color:var(--tx-lbl,#334155);text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-bottom:10px;">Results Breakdown</div>
            <table cellpadding="0" cellspacing="4">
              ${legendRow('#16a34a', 'Passed', passed)}
              ${legendRow('#e11d48', 'Failed', failed)}
              ${legendRow('#d97706', 'Skipped', skipped)}
              ${flaky > 0 ? legendRow('#a855f7', 'Flaky', flaky) : ''}
            </table>
            <div style="margin-top:18px;padding-top:14px;border-top:2px solid var(--lsep,#e8edf5);">
              <span style="font-size:36px;font-weight:900;color:var(--tx-1,#0f172a);line-height:1;letter-spacing:-1px;">${passRate}%</span>
              <span style="font-size:13px;color:var(--tx-2,#475569);margin-left:8px;font-weight:500;">pass rate</span>
            </div>
            <!-- Inline progress bar under pass rate -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;background:var(--pgr,#e8edf5);border-radius:8px;overflow:hidden;">
              <tr>
                <td width="${passRate}%" style="height:10px;background:linear-gradient(90deg,#16a34a,#22c55e);border-radius:8px;font-size:0;line-height:0;">&nbsp;</td>
                <td style="height:10px;font-size:0;line-height:0;"></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  ${testResultsSection}

  <!-- FOOTER -->
  <tr>
    <td bgcolor="#0f766e" style="background-color:#0f766e;background:linear-gradient(135deg,#0f766e 0%,#064e3b 100%);padding:22px 44px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">
            <div style="font-size:13px;color:#ffffff;font-weight:800;letter-spacing:.2px;">SimplerToday.ai &mdash; QA Team</div>
            <div style="font-size:11px;color:#ffffff;margin-top:4px;font-weight:500;opacity:.8;">Powered by Playwright Automation</div>
          </td>
          <td align="right" style="vertical-align:middle;">
            <div style="font-size:11px;color:#ffffff;background:rgba(255,255,255,.18);padding:6px 14px;border-radius:20px;border:1.5px solid rgba(255,255,255,.5);white-space:nowrap;font-weight:700;">
              &#128206;&nbsp; Full report attached
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td></tr>
</table>

<script>
  // Hide the email-client fallback banner — JS is running so filtering works
  var notice = document.getElementById('interactive-notice');
  if (notice) notice.style.display = 'none';

  var currentFilter = 'all';

  function filterTests(status) {
    currentFilter = status;

    // Highlight the active stat card at the top
    ['all', 'passed', 'failed', 'skipped'].forEach(function(id) {
      var el = document.getElementById('card-' + id);
      if (el) el.classList.remove('active');
    });
    var activeCard = document.getElementById('card-' + status);
    if (activeCard) activeCard.classList.add('active');

    // Show / hide individual test rows
    document.querySelectorAll('.test-row').forEach(function(row) {
      var s = row.getAttribute('data-status');
      row.style.display = (status === 'all' || s === status) ? '' : 'none';
    });

    // Hide file section headers that have no visible rows under the active filter
    document.querySelectorAll('.file-header').forEach(function(fh) {
      var fid      = fh.getAttribute('data-fid');
      var hasMatch = false;
      document.querySelectorAll('.test-row[data-fid="' + fid + '"]').forEach(function(r) {
        if (status === 'all' || r.getAttribute('data-status') === status) hasMatch = true;
      });
      fh.style.display = hasMatch ? '' : 'none';
    });

    // Update the "Showing:" pill in the Test Results header
    var labels = { all: 'All Tests', passed: 'Passed Only', failed: 'Failed Only', skipped: 'Skipped Only' };
    var counts  = { all: ${total}, passed: ${passed}, failed: ${failed}, skipped: ${skipped} };
    var lbl = document.getElementById('filter-label');
    if (lbl) lbl.textContent = 'Showing: ' + (labels[status] || status) + ' (' + (counts[status] || 0) + ')';
  }

  // When opened via a link (e.g. summary-report.html#failed), auto-apply the hash filter
  var _hash = window.location.hash.replace('#', '');
  if (_hash && _hash !== 'all') { filterTests(_hash); }
</script>

</body>
</html>`;
}

// Port the local report server listens on. Must match report-server.js default.
const REPORT_PORT = 9323;

/**
 * Spawn report-server.js as a detached background process so it outlives this script.
 * If the port is already occupied (server from a prior run), the new process exits silently
 * and the old server keeps serving the freshly-written summary-report.html.
 */
function spawnReportServer(reportDir) {
  const serverScript = path.join(__dirname, 'report-server.js');
  if (!fs.existsSync(serverScript)) {
    console.warn('⚠️  report-server.js not found — email links will not open in browser.');
    return;
  }
  const child = spawn(process.execPath, [serverScript], {
    env:      { ...process.env, QA_REPORT_PORT: String(REPORT_PORT), QA_REPORT_DIR: reportDir },
    detached: true,
    stdio:    'ignore',
  });
  child.unref(); // Let this script exit without waiting for the server
  console.log(`📊 Report server started → http://localhost:${REPORT_PORT}/summary-report.html`);
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
      const summaryPath = path.join(__dirname, 'test-results', 'summary-report.html');
      const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
      const env         = process.env.BASE_URL || 'Development (Demo)';

      // Spawn the local report server (port 9323) so email links open in the browser.
      // http://localhost links work in Gmail web — file:// links do not.
      const testResultsDir = path.join(__dirname, 'test-results');
      spawnReportServer(testResultsDir);
      const summaryUrl = `http://localhost:${REPORT_PORT}/summary-report.html`;

      // Full interactive report (with filterable test table) → saved as the attachment.
      const fullHtml  = buildEmailHTML(resultsData, env, summaryUrl, false);
      fs.writeFileSync(summaryPath, fullHtml, 'utf-8');

      // Compact version for the email body — no test table, just summary + CTA buttons.
      const emailHtml = buildEmailHTML(resultsData, env, summaryUrl, true);

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TO,
        subject: `SimplerToday QA Report — ${new Date().toLocaleDateString()} | ${resultsData.stats?.unexpected ? '❌ Failures detected' : '✅ All Passed'}`,
        html: emailHtml,
        attachments: [
          { filename: 'summary-report.html', path: summaryPath },
        ],
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
