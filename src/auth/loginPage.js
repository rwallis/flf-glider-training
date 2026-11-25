function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** True when OAuth return targets the standalone weekly quiz page. */
export function isWeeklyQuizReturn(returnUrl = '/') {
  try {
    const path = String(returnUrl || '/').split('?')[0].split('#')[0];
    return path === '/weekly-quiz' || path === '/weekly-quiz/' || path === '/weekly-quiz.html';
  } catch {
    return false;
  }
}

function studyInstructionsHtml() {
  return `
      <h2>New here? Start with this</h2>
      <ol>
        <li><strong>Sign in with Google</strong> — any Google account works. No club invite code required.</li>
        <li>Your <strong>study progress is saved to your account</strong> (Due / Again / Hard / Good / Easy). Other pilots have their own decks.</li>
        <li>On Home, open a track:
          <ul>
            <li><strong>Commercial</strong> — written / ACS-style multiple choice</li>
            <li><strong>Common Knowledge</strong> — regs, weather, aerodynamics</li>
            <li><strong>SGS 2-33</strong> — club trainer numbers & ops</li>
          </ul>
        </li>
        <li>Study filter <strong>Due</strong> = cards ready for review (including brand-new ones). Grade honestly so spaced repetition works.</li>
        <li>Club admins manage decks from the Admin tab (search + import).</li>
      </ol>`;
}

function weeklyQuizInstructionsHtml() {
  return `
      <h2>Club weekly quiz</h2>
      <ol>
        <li><strong>Sign in with Google</strong> — use the same Google account you use for FLF Glider Study so your XP is tied to you.</li>
        <li>After sign-in you go straight to this week’s <strong>Weekly Quiz</strong> (Commercial &amp; CFI-G questions only).</li>
        <li>The club gets <strong>one shared set of questions each week</strong> (Mon–Sun, America/Chicago). Everyone answers the same deck.</li>
        <li>Pick an answer, then <strong>Submit</strong>. Correct = <strong>2 XP</strong>, wrong = <strong>1 XP</strong>. You can’t re-answer a question once submitted.</li>
        <li>If a question references a figure, tap the <strong>Figure</strong> pill to open it.</li>
        <li>The chart and leaderboard on the quiz page show <strong>quiz XP only</strong> — not your regular Study league points.</li>
      </ol>
      <p class="note" style="margin-top:12px">This page is separate from the main study app. After you finish, bookmark the quiz link to come back next week.</p>`;
}

export function renderLoginPage({ error = '', returnUrl = '/' } = {}) {
  const safeError = error ? `<p class="error">${escapeHtml(error)}</p>` : '';
  const href = `/auth/google?return=${encodeURIComponent(returnUrl || '/')}`;
  const quizLogin = isWeeklyQuizReturn(returnUrl);
  const title = quizLogin ? 'Sign in · FLF Weekly Quiz' : 'Sign in · FLF Glider Study';
  const brandTitle = quizLogin ? 'FLF Weekly Quiz' : 'FLF Glider Study';
  const brandBlurb = quizLogin
    ? 'Fault Line Flyers club quiz — Commercial & CFI-G questions for the week, scored by XP.'
    : 'Fault Line Flyers training cards for Common, Commercial, and the Schweizer 2-33 — on your phone.';
  const instructions = quizLogin ? weeklyQuizInstructionsHtml() : studyInstructionsHtml();
  const footer = quizLogin ? 'Fault Line Flyers · weekly quiz' : 'Fault Line Flyers · glider training';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#1A6FA3" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --sky: #2B8FCC;
      --sky-deep: #1A6FA3;
      --grass: #2F7D32;
      --ink: #1C2A33;
      --paper: #F7FAFC;
      --muted: #5A6B76;
      --line: #D5E2EA;
      --card: #FFFFFF;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(1200px 500px at 10% -10%, rgba(43,143,204,0.28), transparent 55%),
        radial-gradient(900px 420px at 100% 0%, rgba(47,125,50,0.18), transparent 50%),
        var(--paper);
      padding: 28px 16px 40px;
    }
    .wrap { width: min(560px, 100%); margin: 0 auto; }
    .brand {
      background: linear-gradient(120deg, var(--sky-deep), var(--sky));
      color: #fff;
      border-radius: 18px;
      padding: 22px 20px 18px;
      box-shadow: 0 10px 30px rgba(26,111,163,0.25);
    }
    .brand h1 { margin: 0; font-size: 1.45rem; letter-spacing: 0.02em; }
    .brand p { margin: 8px 0 0; opacity: 0.92; line-height: 1.45; font-size: 0.95rem; }
    .card {
      margin-top: 16px;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 20px 18px 22px;
    }
    .card h2 { margin: 0 0 10px; font-size: 1.05rem; }
    .card ol, .card ul { margin: 0; padding-left: 1.2rem; color: var(--muted); line-height: 1.55; }
    .card li { margin: 0.35rem 0; }
    .card strong { color: var(--ink); }
    .cta {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 18px;
    }
    a.btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 16px;
      border-radius: 12px;
      background: var(--sky-deep);
      color: #fff;
      text-decoration: none;
      font-weight: 800;
      font-size: 1rem;
    }
    a.btn:hover { background: #155f8c; }
    .note { font-size: 0.82rem; color: var(--muted); line-height: 1.45; margin: 0; }
    .error {
      margin: 12px 0 0;
      padding: 10px 12px;
      border-radius: 10px;
      background: #fde8e4;
      color: #9b3418;
      font-size: 0.9rem;
    }
    .footer {
      margin-top: 14px;
      text-align: center;
      font-size: 0.78rem;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <h1>${escapeHtml(brandTitle)}</h1>
      <p>${escapeHtml(brandBlurb)}</p>
    </div>
    <div class="card">
      ${instructions}
      ${safeError}
      <div class="cta">
        <a class="btn" href="${href}">Sign in with Google</a>
        <p class="note">We only use Google for sign-in (name, email, profile photo). Progress stays in the FLF study database — not shared to Google Classroom or Drive.</p>
      </div>
    </div>
    <p class="footer">${escapeHtml(footer)}</p>
  </div>
</body>
</html>`;
}
