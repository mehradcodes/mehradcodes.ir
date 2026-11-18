(function () {
  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  // Inside Telegram (Mini App or its in-app browser)? The WebApp script
  // loads in ANY browser, so `tg` alone proves nothing -- Chrome has a
  // WebApp object with empty initData. The native bridge object exists only
  // in Telegram's own webview; platform is 'unknown' outside Telegram.
  var inTelegram = !!(window.TelegramWebviewProxy || (tg && tg.platform && tg.platform !== 'unknown'));
  var WORKER = 'https://mehradcodes-bot.haj0-0mehrad.workers.dev';
  var BOT_URL = 'https://t.me/mehradcodes_bot';
  var initData = tg ? (tg.initData || '') : '';
  // Browser login: the Telegram Login Widget issues a session token, kept in
  // localStorage for 30 days. Inside the Mini App initData is the identity
  // and this stays empty.
  var session = '';
  try { session = localStorage.getItem('tg_session') || ''; } catch (e) {}
  var webUser = null;
  var isAdmin = false;
  var currentCourse = null;
  var currentPayment = null;
  var receiptFile = null;
  var lastCourses = [];
  var panelOpen = false;
  var myCourses = [];
  var myPhone = null;
  var myUserId = null;
  var wmTimer = null;
  var currentPlayerCourse = null;

  function authHeaders() { return session ? { 'Authorization': 'Bearer ' + session } : {}; }
  function canOrder() { return !!(initData || session); }
  function saveSession(s) {
    session = s || '';
    try { if (s) localStorage.setItem('tg_session', s); else localStorage.removeItem('tg_session'); } catch (e) {}
  }
  function showPhoneBox() { var b = document.getElementById('phoneBox'); if (b) b.style.display = 'block'; }
  function hidePhoneBox() { var b = document.getElementById('phoneBox'); if (b) b.style.display = 'none'; }
  function phoneStatusMsg(msg, isErr) {
    var st = document.getElementById('phoneStatus');
    if (!st) return;
    st.style.display = 'block';
    st.textContent = msg;
    st.className = 'status' + (isErr ? ' err' : '');
  }

  // Website login by pairing code: the site shows a random 6-digit code,
  // the buyer sends it to the bot (or taps «اتصال به سایت» there), and the
  // site polls until the bot claims it. No oauth popup, no telegram.org in
  // the browser -- the robust path for buyers in Iran.
  var codePollTimer = null;
  var currentCode = null;
  var codePolls = 0;
  function stopCodePoll() {
    if (codePollTimer) { clearInterval(codePollTimer); codePollTimer = null; }
  }
  function pollCodeStatus() {
    if (!currentCode) return;
    codePolls++;
    if (codePolls > 200) { // 10 minutes of polling
      stopCodePoll();
      currentCode = null;
      document.getElementById('codeDisplay').style.display = 'none';
      var st = document.getElementById('loginStatus');
      if (st) { st.style.display = 'block'; st.textContent = 'کد منقضی شد؛ یه کد تازه بگیر.'; st.className = 'status err'; }
      return;
    }
    fetch(WORKER + '/api/auth/code-status?code=' + encodeURIComponent(currentCode))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.status === 'claimed' && data.session) {
        stopCodePoll();
        currentCode = null;
        saveSession(data.session);
        webUser = data.user || null;
        document.getElementById('loginBox').style.display = 'none';
        if (data.phone_verified) hidePhoneBox(); else showPhoneBox();
        renderProfile();
        load();
      } else if (data.status === 'expired') {
        stopCodePoll();
        currentCode = null;
        document.getElementById('codeDisplay').style.display = 'none';
        var st2 = document.getElementById('loginStatus');
        if (st2) { st2.style.display = 'block'; st2.textContent = data.error || 'کد منقضی شد؛ یه کد تازه بگیر.'; st2.className = 'status err'; }
      }
      // pending: keep waiting
    }).catch(function () { /* a failed poll just retries next round */ });
  }

  if (tg) {
    try {
      tg.ready(); tg.expand();
      if (tg.setBackgroundColor) tg.setBackgroundColor('#0b0b1e');
      if (tg.setHeaderColor) tg.setHeaderColor('#0b0b1e');
    } catch (e) {}
  }
  function haptic() { try { tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred('light'); } catch (e) {} }
  function faNum(n) { return Number(n).toLocaleString('fa-IR'); }
  function toLatinDigits(s) {
    return String(s == null ? '' : s)
      .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
  }
  function openLink(url) {
    if (inTelegram && tg && tg.openTelegramLink && url.indexOf('https://t.me/') === 0) tg.openTelegramLink(url);
    else if (inTelegram && tg && tg.openLink) tg.openLink(url);
    else window.open(url, '_blank');
  }

  // Static course list (names + descriptions only — prices NEVER live here;
  // they come from the Worker, which reads the KV prices Mehrad sets in the Mini App admin panel).
  // Used only if the live fetch fails (e.g. before the Worker update is deployed).
  var STATIC_COURSES = [
    { id: 'py-beginner', group: 'پایتون', title: 'پایتون مقدماتی', level: 'مقدماتی', icon: '🐍', desc: 'پایتون از صفر تا صد؛ با تمرین و پروژه‌ی کوچک در هر جلسه.' },
    { id: 'py-advanced', group: 'پایتون', title: 'پایتون پیشرفته', level: 'پیشرفته', icon: '🚀', desc: 'ادامه‌ی مسیر پایتون؛ مباحث پیشرفته‌تر و پروژه‌های واقعی.' },
    { id: 'ml', group: 'پایتون', title: 'ماشین لرنینگ', level: 'پیشرفته', icon: '🤖', desc: 'آشنایی با یادگیری ماشین با پایتون؛ از مبانی تا ساخت اولین مدل.' },
    { id: 'web-ai-beginner', group: 'طراحی سایت با هوش مصنوعی', title: 'طراحی سایت با هوش مصنوعی — مقدماتی', level: 'مقدماتی', icon: '🌐', desc: 'ساخت سایت با ابزارهای هوش مصنوعی؛ بدون نیاز به تجربه‌ی قبلی.' },
    { id: 'web-ai-advanced', group: 'طراحی سایت با هوش مصنوعی', title: 'طراحی سایت با هوش مصنوعی — پیشرفته', level: 'پیشرفته', icon: '🛒', desc: 'سایت‌های حرفه‌ای و فروشگاهی با هوش مصنوعی.' },
    { id: 'ai-beginner', group: 'کار با هوش مصنوعی', title: 'کار با هوش مصنوعی — مقدماتی', level: 'مقدماتی', icon: '✨', desc: 'کاربرد روزمره و کاری هوش مصنوعی؛ پرامپت‌نویسی و ابزارها.' },
    { id: 'ai-advanced', group: 'کار با هوش مصنوعی', title: 'کار با هوش مصنوعی — پیشرفته', level: 'پیشرفته', icon: '⚙️', desc: 'خودکارسازی کارها و ساخت گردش‌کار با هوش مصنوعی.' },
    { id: 'n8n', group: 'اتوماسیون', title: 'دوره‌ی n8n', level: 'تخصصی', icon: '🔗', desc: 'خودکارسازی فرایندها و اتصال سرویس‌ها با n8n.' },
    { id: 'security', group: 'امنیت', title: 'دوره‌ی امنیت', level: 'تخصصی', icon: '🔒', desc: 'مبانی امنیت وب و محافظت از سایت و داده‌ها.' }
  ];
  var GROUPS = [
    { name: 'پایتون', icon: '🐍', color: '#22c55e' },
    { name: 'طراحی سایت با هوش مصنوعی', icon: '🌐', color: '#a78bfa' },
    { name: 'کار با هوش مصنوعی', icon: '✨', color: '#22d3ee' },
    { name: 'اتوماسیون', icon: '🔗', color: '#fb923c' },
    { name: 'امنیت', icon: '🔒', color: '#f87171' }
  ];

  function pillClass(level) {
    return level === 'مقدماتی' ? 'beginner' : (level === 'پیشرفته' ? 'advanced' : 'special');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // CSP-safe group colours: colours are applied via JS properties after
  // the HTML is inserted (no inline style="..." attributes anywhere).
  function paintGroupColors(root) {
    root.querySelectorAll('[data-color]').forEach(function (el) {
      var c = el.getAttribute('data-color');
      if (el.classList.contains('g-dot')) { el.style.background = c; el.style.boxShadow = '0 0 12px ' + c; }
      else if (el.classList.contains('g-line')) { el.style.background = 'linear-gradient(90deg,' + c + '66,transparent)'; }
      else if (el.classList.contains('c-icon')) { el.style.background = c + '22'; el.style.borderColor = c + '55'; }
    });
  }

  function render(courses, live) {
    var html = '';
    GROUPS.forEach(function (g) {
      var items = courses.filter(function (c) { return c.group === g.name; });
      if (!items.length) return;
      html += '<div class="group-title">'
        + '<span class="g-dot" data-color="' + g.color + '"></span>'
        + esc(g.icon) + ' ' + esc(g.name)
        + '<span class="g-line" data-color="' + g.color + '"></span>'
        + '</div>';
      items.forEach(function (c) {
        var priced = c.price != null && Number(c.price) > 0;
        var icon = c.icon || g.icon;
        html += '<div class="card">'
          + '<div class="c-head">'
          + '<span class="c-icon" data-color="' + g.color + '">' + esc(icon) + '</span>'
          + '<h3>' + esc(c.title) + ' <span class="pill ' + pillClass(c.level) + '">' + esc(c.level) + '</span></h3>'
          + '</div>'
          + '<p class="desc">' + esc(c.desc) + '</p>'
          + (function () {
              // Badge shows UPLOADED video sessions only (c.videos); when a
              // planned total is set it reads «۳ از ۱۲ جلسه». No badge at
              // all while a course has no videos.
              var n = (c.videos != null ? c.videos : c.sessions) || 0;
              if (n <= 0) return '';
              var total = (c.sessions_total != null && c.sessions_total > n) ? c.sessions_total : 0;
              return '<div class="sess">🎬 ' + faNum(n) + (total > 0 ? ' از ' + faNum(total) : '') + ' جلسه</div>';
            })()
          + '<div class="row">'
          + (priced
              ? '<span class="price">' + faNum(c.price) + ' <small>تومان</small></span>'
              : '<span class="price soon">قیمت به‌زودی اعلام می‌شود</span>')
          + (priced
              ? (canOrder()
                  ? '<button class="btn" data-order="' + esc(c.id) + '">🛒 ثبت‌نام</button>'
                  : (inTelegram
                      ? '<button class="btn ghost" data-open-bot="1">ثبت‌نام در ربات</button>'
                      : '<button class="btn" data-login="1">🔐 ورود و ثبت‌نام</button>'))
              : (live
                  ? '<button class="btn" disabled>به‌زودی</button>'
                  : '<button class="btn ghost" data-open-bot="1">ثبت‌نام در ربات</button>'))
          + '</div></div>';
      });
    });
    document.getElementById('list').innerHTML = html;
    paintGroupColors(document.getElementById('list'));
    document.querySelectorAll('[data-order]').forEach(function (b) {
      b.addEventListener('click', function () { haptic(); startOrder(b.getAttribute('data-order')); });
    });
    document.querySelectorAll('[data-login]').forEach(function (b) {
      b.addEventListener('click', function () {
        haptic();
        var lb = document.getElementById('loginBox');
        if (lb) lb.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    document.querySelectorAll('[data-open-bot]').forEach(function (b) {
      b.addEventListener('click', function () { haptic(); openLink(BOT_URL); });
    });
  }

  function renderAdminPanel() {
    var html = '';
    lastCourses.forEach(function (c) {
      html += '<div class="admin-row">'
        + '<div class="a-title">' + esc(c.title) + '<small>' + esc(c.group) + ' · ' + esc(c.level) + '</small></div>'
        + '<input type="text" inputmode="numeric" data-price-input="' + esc(c.id) + '" placeholder="بدون قیمت" value="' + (c.price != null ? esc(String(c.price)) : '') + '">'
        + '<button class="btn" type="button" data-price-save="' + esc(c.id) + '">ذخیره</button>'
        + '</div>';
    });
    document.getElementById('adminRows').innerHTML = html;
    document.querySelectorAll('[data-price-save]').forEach(function (b) {
      b.addEventListener('click', function () { haptic(); savePrice(b.getAttribute('data-price-save')); });
    });
    loadAdminVideos();
  }

  function loadAdminVideos() {
    var box = document.getElementById('adminVideoRows');
    if (!box) return;
    box.innerHTML = '<div class="status">در حال بارگذاری…</div>';
    fetch(WORKER + '/api/videos?initData=' + encodeURIComponent(initData), { headers: authHeaders() })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.ok) { box.innerHTML = '<div class="status err">' + esc(data.error || 'خطا') + '</div>'; return; }
      renderAdminVideos(data.courses || []);
    }).catch(function () { box.innerHTML = '<div class="status err">ارتباط برقرار نشد.</div>'; });
  }

  function renderAdminVideos(courses) {
    var html = '';
    courses.forEach(function (c) {
      html += '<div class="v-row">'
        + '<div class="v-head">'
        + '<div class="v-title">' + esc(c.title) + '<small>' + c.sessions.length + ' جلسه‌ی ویدیویی ثبت شده' + (c.sessions_total ? ' · هدف: ' + c.sessions_total + ' جلسه' : '') + '</small></div>'
        + '<input type="text" inputmode="numeric" data-total-input="' + esc(c.id) + '" placeholder="تعداد جلسات" value="' + (c.sessions_total != null ? esc(String(c.sessions_total)) : '') + '">'
        + '<button class="btn" type="button" data-total-save="' + esc(c.id) + '">ذخیره</button>'
        + '</div>'
        + '<div class="v-list">';
      c.sessions.forEach(function (s) {
        html += '<div><span class="flex1">' + esc(s.title) + '</span>'
          + '<button type="button" data-vremove="' + esc(c.id) + ':' + s.index + '" title="حذف جلسه">✕</button></div>';
      });
      html += '</div></div>';
    });
    document.getElementById('adminVideoRows').innerHTML = html;
    document.querySelectorAll('[data-total-save]').forEach(function (b) {
      b.addEventListener('click', function () { haptic(); saveTotal(b.getAttribute('data-total-save')); });
    });
    document.querySelectorAll('[data-vremove]').forEach(function (b) {
      b.addEventListener('click', function () {
        haptic();
        var parts = b.getAttribute('data-vremove').split(':');
        removeSession(parts[0], Number(parts[1]));
      });
    });
  }

  function saveTotal(courseId) {
    var input = document.querySelector('[data-total-input="' + courseId + '"]');
    var raw = toLatinDigits(input ? input.value : '').replace(/[^\d]/g, '');
    var total = raw === '' ? 0 : Number(raw);
    fetch(WORKER + '/api/video-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initData, session: session, courseId: courseId, action: 'set_total', total: total })
    }).then(function (r) { return r.json(); })
    .then(function (j) { if (j.ok) { loadAdminVideos(); load(); } });
  }

  function removeSession(courseId, index) {
    fetch(WORKER + '/api/video-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initData, session: session, courseId: courseId, action: 'remove', index: index })
    }).then(function (r) { return r.json(); })
    .then(function (j) { if (j.ok) { loadAdminVideos(); load(); } });
  }

  function formatPhone(d) {
    var s = String(d || '').replace(/[^0-9]/g, '');
    if (s.indexOf('98') === 0 && s.length === 12) return '0' + s.slice(2);
    return s;
  }

  function loadMyCourses() {
    if (!initData && !session) return;
    fetch(WORKER + '/api/my-courses?initData=' + encodeURIComponent(initData), { headers: authHeaders() })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.ok) return;
      myCourses = data.courses || [];
      myPhone = data.phone || null;
      if (data.phone) setProfilePhone(data.phone);
      myUserId = data.user_id || null;
      renderMyCourses();
    }).catch(function () {});
  }

  function renderMyCourses() {
    var box = document.getElementById('myCourses');
    if (!myCourses.length) { box.style.display = 'none'; return; }
    var html = '';
    myCourses.forEach(function (c) {
      html += '<div class="my-row">'
        + '<div class="m-title">' + esc(c.title) + '<small>' + c.sessions.length + ' جلسه‌ی ویدیویی</small></div>'
        + '<button class="btn" type="button" data-watch="' + esc(c.id) + '">🎬 تماشا</button>'
        + '</div>';
    });
    document.getElementById('myCoursesList').innerHTML = html;
    box.style.display = 'block';
    document.querySelectorAll('[data-watch]').forEach(function (b) {
      b.addEventListener('click', function () {
        haptic();
        var c = null;
        myCourses.forEach(function (x) { if (x.id === b.getAttribute('data-watch')) c = x; });
        if (c) openPlayer(c, 0);
      });
    });
  }

  function moveWm() {
    var wm = document.getElementById('playerWm');
    var wrap = document.getElementById('playerWrap');
    if (!wm || !wrap) return;
    var maxL = Math.max(0, wrap.clientWidth - wm.offsetWidth - 8);
    var maxT = Math.max(0, wrap.clientHeight - wm.offsetHeight - 8);
    wm.style.left = (4 + Math.random() * maxL) + 'px';
    wm.style.top = (4 + Math.random() * maxT) + 'px';
  }

  function openPlayer(course, idx) {
    currentPlayerCourse = course;
    var s = course.sessions[idx];
    if (!s) return;
    document.getElementById('list').style.display = 'none';
    document.getElementById('order').style.display = 'none';
    document.getElementById('myCourses').style.display = 'none';
    document.getElementById('playerTitle').textContent = course.title + ' — ' + s.title;
    var v = document.getElementById('playerVideo');
    v.src = WORKER + '/api/stream?token=' + encodeURIComponent(s.token);
    v.load();
    var wm = document.getElementById('playerWm');
    wm.textContent = formatPhone(myPhone) || ('ID ' + (myUserId || ''));
    wm.style.left = '12px'; wm.style.top = '12px';
    var btns = '';
    course.sessions.forEach(function (x, i) {
      btns += '<button class="btn' + (i === idx ? ' active' : '') + '" type="button" data-session="' + i + '">' + esc(x.title) + '</button>';
    });
    document.getElementById('playerSessions').innerHTML = '<div class="sess-btns">' + btns + '</div>';
    document.querySelectorAll('[data-session]').forEach(function (b) {
      b.addEventListener('click', function () { haptic(); openPlayer(course, Number(b.getAttribute('data-session'))); });
    });
    document.getElementById('player').style.display = 'block';
    window.scrollTo(0, 0);
    if (wmTimer) clearInterval(wmTimer);
    wmTimer = setInterval(moveWm, 5000);
    setTimeout(moveWm, 1200);
    v.play().catch(function () {});
  }

  function closePlayer() {
    var v = document.getElementById('playerVideo');
    try { v.pause(); } catch (e) {}
    v.removeAttribute('src');
    v.load();
    if (wmTimer) { clearInterval(wmTimer); wmTimer = null; }
    document.getElementById('player').style.display = 'none';
    document.getElementById('list').style.display = 'block';
    renderMyCourses();
    load();
  }

  function savePrice(courseId) {
    var input = document.querySelector('[data-price-input="' + courseId + '"]');
    var st = document.getElementById('adminStatus');
    var raw = toLatinDigits(input ? input.value : '').replace(/[^\d]/g, '');
    var price = raw === '' ? null : Number(raw);
    if (price !== null && (!isFinite(price) || price <= 0)) {
      st.style.display = 'block'; st.textContent = 'قیمت رو فقط به صورت عدد بفرست.';
      return;
    }
    st.style.display = 'block'; st.textContent = 'در حال ذخیره…';
    fetch(WORKER + '/api/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initData, session: session, courseId: courseId, price: price })
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
    .then(function (res) {
      if (res.status === 200 && res.body.ok) {
        var c = null;
        lastCourses.forEach(function (x) { if (x.id === courseId) c = x; });
        st.textContent = price === null
          ? 'قیمت «' + (c ? c.title : courseId) + '» حذف شد.'
          : '✅ قیمت «' + (c ? c.title : courseId) + '» شد ' + faNum(price) + ' تومان.';
        haptic();
        load();
      } else {
        st.textContent = res.body.error || 'ذخیره نشد؛ دوباره امتحان کن.';
      }
    }).catch(function () { st.textContent = 'ارتباط برقرار نشد؛ دوباره امتحان کن.'; });
  }

  // Profile chip: Telegram sends the user's name + photo with every Mini App
  // launch (initDataUnsafe.user), so the login is always visible at the top.
  // Display-only; the server re-validates identity on every API call.
  // The chip shows the name on top and the phone number below it. The number
  // comes from the server (/api/courses returns the stored phone, and so does
  // /api/my-courses) and arrives after the first render, so the subtitle is
  // updated in place by setProfilePhone. Until then it is the @username.
  var profilePhone = null;
  function setProfilePhone(phone) {
    profilePhone = phone || null;
    var bar = document.getElementById('profileBar');
    var sub = bar && bar.querySelector('.who span');
    if (sub && profilePhone) sub.textContent = formatPhone(profilePhone);
  }

  function renderProfile() {
    var u = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || webUser;
    var bar = document.getElementById('profileBar');
    if (!u || !bar) return;
    var name = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'کاربر تلگرام';
    var isWeb = !!webUser && !(tg && tg.initDataUnsafe && tg.initDataUnsafe.user);
    bar.innerHTML = (u.photo_url
      ? '<img class="avatar" src="' + esc(u.photo_url) + '" alt="">'
      : '<div class="avatar-fallback">' + esc(name.charAt(0)) + '</div>')
      + '<div class="who"><b>' + esc(name) + '</b>'
      + (profilePhone ? '<span>' + esc(formatPhone(profilePhone)) + '</span>'
        : (u.username ? '<span>@' + esc(u.username) + '</span>' : '<span>وارد شده با تلگرام</span>')) + '</div>'
      + (isWeb ? '<button class="logout-link" id="logoutBtn" type="button">خروج</button>' : '');
    bar.style.display = 'flex';
    var lo = document.getElementById('logoutBtn');
    if (lo) lo.addEventListener('click', function () { saveSession(''); webUser = null; location.reload(); });
    var img = bar.querySelector('img.avatar');
    if (img) img.addEventListener('error', function () {
      var fb = document.createElement('div');
      fb.className = 'avatar-fallback';
      fb.textContent = name.charAt(0);
      img.replaceWith(fb);
    });
  }

  function load() {
    renderProfile();
    // Opened inside Telegram's webview as a plain link (no initData):
    // admin panel, ordering and My Courses need the in-chat shop button
    // instead — say so. In a plain browser this notice stays hidden and the
    // Telegram login box below is the way in.
    var nn = document.getElementById('noInitNotice');
    if (nn) nn.style.display = (inTelegram && !initData) ? 'block' : 'none';
    // Browser with no session yet: show the Telegram login box (the code
    // flow lives there).
    var lb = document.getElementById('loginBox');
    if (lb) lb.style.display = (!inTelegram && !session) ? 'block' : 'none';
    var url = WORKER + '/api/courses' + (initData ? ('?initData=' + encodeURIComponent(initData)) : '');
    fetch(url, { headers: authHeaders() }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (data) {
      isAdmin = !!data.is_admin;
      if (isAdmin) document.getElementById('adminBadge').style.display = 'block';
      var pn = document.getElementById('phoneNotice');
      if (initData && data.phone_verified === false) pn.style.display = 'block';
      else pn.style.display = 'none';
      if (session) {
        if (data.phone_verified) hidePhoneBox(); else showPhoneBox();
      }
      lastCourses = data.courses || [];
      if (data.phone) setProfilePhone(data.phone);
      render(lastCourses, true);
      if (isAdmin && panelOpen) renderAdminPanel();
      loadMyCourses();
    }).catch(function () {
      render(STATIC_COURSES, false);
    });
  }

  function startOrder(courseId) {
    if (!initData && !session) {
      var lb = document.getElementById('loginBox');
      if (lb) lb.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    var list = document.getElementById('list');
    list.innerHTML = '<div class="status">در حال آماده‌سازی سفارش…</div>';
    fetch(WORKER + '/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initData, session: session, courseId: courseId })
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
    .then(function (res) {
      if (res.status !== 200 || !res.body.ok) {
        list.innerHTML = '<div class="status err">' + esc(res.body.error || 'مشکلی پیش اومد؛ دوباره امتحان کن.') + '</div>';
        setTimeout(load, 2500);
        return;
      }
      currentCourse = res.body.course;
      currentPayment = res.body.payment;
      document.getElementById('orderTitle').textContent = 'ثبت‌نام: ' + currentCourse.title;
      document.getElementById('orderPrice').innerHTML = faNum(currentCourse.price) + ' <small>تومان</small>';
      document.getElementById('cardNumber').textContent = currentPayment.card || '';
      document.getElementById('cardOwner').textContent = currentPayment.owner ? ('به نام ' + currentPayment.owner) : '';
      var zw = document.getElementById('zarinWrap');
      if (currentPayment.zarinpal) {
        zw.style.display = 'block';
        document.getElementById('zarinBtn').onclick = function () { openLink(currentPayment.zarinpal); };
      } else zw.style.display = 'none';
      document.getElementById('orderStatus').style.display = 'none';
      document.getElementById('orderStatus').textContent = '';
      document.getElementById('sendReceiptBtn').disabled = true;
      receiptFile = null;
      document.getElementById('receiptInput').value = '';
      document.getElementById('receiptPreview').style.display = 'none';
      list.style.display = 'none';
      document.getElementById('order').style.display = 'block';
      window.scrollTo(0, 0);
    }).catch(function () {
      list.innerHTML = '<div class="status err">ارتباط برقرار نشد؛ دوباره امتحان کن.</div>';
      setTimeout(load, 2500);
    });
  }

  document.getElementById('cardNumber').addEventListener('click', function () {
    var t = this.textContent.replace(/\s/g, '');
    function done() { document.querySelector('.copy-hint').textContent = 'کپی شد ✅'; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, done);
    else done();
    haptic();
  });

  document.getElementById('receiptInput').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    receiptFile = f || null;
    document.getElementById('sendReceiptBtn').disabled = !receiptFile;
    var img = document.getElementById('receiptPreview');
    if (f) {
      var rd = new FileReader();
      rd.onload = function (ev) { img.src = ev.target.result; img.style.display = 'block'; };
      rd.readAsDataURL(f);
    } else img.style.display = 'none';
  });

  document.getElementById('sendReceiptBtn').addEventListener('click', function () {
    if (!receiptFile || !currentCourse) return;
    var st = document.getElementById('orderStatus');
    st.style.display = 'block';
    st.textContent = 'در حال ارسال رسید…';
    var fd = new FormData();
    fd.append('initData', initData);
    if (session) fd.append('session', session);
    fd.append('courseId', currentCourse.id);
    fd.append('photo', receiptFile);
    fetch(WORKER + '/api/receipt', { method: 'POST', body: fd })
    .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
    .then(function (res) {
      if (res.status === 200 && res.body.ok) {
        st.textContent = 'رسیدت رسید ✅ مهراد بررسی‌ش می‌کنه؛ نتیجه رو تو ربات بهت می‌گه.';
        document.getElementById('sendReceiptBtn').disabled = true;
        haptic();
        setTimeout(function () { if (tg) tg.close(); }, 4000);
      } else {
        st.textContent = res.body.error || 'ارسال نشد؛ دوباره امتحان کن.';
      }
    }).catch(function () { st.textContent = 'ارتباط برقرار نشد؛ دوباره امتحان کن.'; });
  });

  document.getElementById('backBtn').addEventListener('click', function () {
    haptic();
    document.getElementById('order').style.display = 'none';
    document.getElementById('list').style.display = 'block';
    load();
  });

  document.getElementById('adminBtn').addEventListener('click', function () {
    haptic();
    panelOpen = !panelOpen;
    var p = document.getElementById('adminPanel');
    p.style.display = panelOpen ? 'block' : 'none';
    if (panelOpen) {
      renderAdminPanel();
      p.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  document.getElementById('phoneBtn').addEventListener('click', function () {
    haptic();
    openLink(BOT_URL);
  });

  document.getElementById('noInitBtn').addEventListener('click', function () {
    haptic();
    openLink(BOT_URL);
  });

  document.getElementById('playerBackBtn').addEventListener('click', function () {
    haptic();
    closePlayer();
  });

  document.getElementById('getCodeBtn').addEventListener('click', function () {
    haptic();
    var st = document.getElementById('loginStatus');
    if (st) { st.style.display = 'block'; st.textContent = 'در حال ساخت کد…'; st.className = 'status'; }
    fetch(WORKER + '/api/auth/code', { method: 'POST' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.ok || !data.code) {
        if (st) { st.textContent = 'کد ساخته نشد؛ دوباره امتحان کن.'; st.className = 'status err'; }
        return;
      }
      stopCodePoll();
      currentCode = data.code;
      codePolls = 0;
      if (st) st.style.display = 'none';
      document.getElementById('codeBig').textContent = data.code;
      document.getElementById('codeDisplay').style.display = 'block';
      var cs = document.getElementById('codeStatus');
      if (cs) { cs.style.display = 'block'; cs.textContent = 'منتظر تایید توی ربات…'; cs.className = 'status'; }
      codePollTimer = setInterval(pollCodeStatus, 3000);
    }).catch(function () {
      if (st) { st.textContent = 'ارتباط برقرار نشد؛ دوباره امتحان کن.'; st.className = 'status err'; }
    });
  });

  document.getElementById('openBotBtn').addEventListener('click', function () {
    haptic();
    openLink(BOT_URL);
  });

  document.getElementById('codeBig').addEventListener('click', function () {
    var t = this.textContent.replace(/\s/g, '');
    function done() {
      var cs = document.getElementById('codeStatus');
      if (cs) { cs.style.display = 'block'; cs.textContent = 'کد کپی شد ✅'; cs.className = 'status'; }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, done);
    else done();
    haptic();
  });

  document.getElementById('sendCodeBtn').addEventListener('click', function () {
    haptic();
    var input = document.getElementById('phoneInput');
    var phone = toLatinDigits(input ? input.value : '').replace(/[^\d+]/g, '');
    if (!session) { phoneStatusMsg('اول با تلگرام وارد شو.', true); return; }
    phoneStatusMsg('در حال ارسال کد…', false);
    fetch(WORKER + '/api/auth/phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: session, phone: phone })
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
    .then(function (res) {
      if (res.status === 200 && res.body.ok) {
        document.getElementById('codeStep').style.display = 'block';
        phoneStatusMsg('کد رو ربات برات توی تلگرام فرستاد — تلگرامت رو چک کن.');
      } else if (res.body.need_bot_start) {
        var st2 = document.getElementById('phoneStatus');
        st2.style.display = 'block';
        st2.className = 'status err';
        st2.innerHTML = 'ربات نتونست بهت پیام بده؛ اول <a href="' + BOT_URL + '" target="_blank" class="link-violet">ربات رو استارت کن</a> بعد دوباره بزن.';
      } else {
        phoneStatusMsg(res.body.error || 'ارسال نشد؛ دوباره امتحان کن.', true);
      }
    }).catch(function () { phoneStatusMsg('ارتباط برقرار نشد؛ دوباره امتحان کن.', true); });
  });

  document.getElementById('verifyCodeBtn').addEventListener('click', function () {
    haptic();
    var code = toLatinDigits(document.getElementById('codeInput').value || '').replace(/[^\d]/g, '');
    if (!session) { phoneStatusMsg('اول با تلگرام وارد شو.', true); return; }
    phoneStatusMsg('در حال بررسی کد…', false);
    fetch(WORKER + '/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: session, code: code })
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
    .then(function (res) {
      if (res.status === 200 && res.body.ok) {
        hidePhoneBox();
        if (res.body.phone) setProfilePhone(res.body.phone);
        document.getElementById('phoneStatus').style.display = 'none';
        load();
      } else {
        phoneStatusMsg(res.body.error || 'کد تایید نشد؛ دوباره بزن.', true);
      }
    }).catch(function () { phoneStatusMsg('ارتباط برقرار نشد؛ دوباره امتحان کن.', true); });
  });

  // Startup: a saved browser session is restored first (the login survives
  // 30 days), then the shop loads. Inside the Mini App this is a no-op.
  function boot() {
    if (inTelegram || !session) { load(); return; }
    fetch(WORKER + '/api/auth/me', { headers: authHeaders() })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.ok) {
        webUser = data.user || null;
        if (data.phone_verified) hidePhoneBox(); else showPhoneBox();
        renderProfile();
      } else saveSession('');
      load();
    }).catch(function () { load(); });
  }

  boot();
})();
