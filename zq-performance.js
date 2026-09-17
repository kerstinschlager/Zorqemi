(function () {
  'use strict';

  var state = { lcp: null, inp: null, cls: 0 };

  function save() {
    try {
      var history = JSON.parse(localStorage.getItem('zq_performance_v1') || '[]');
      history.push({
        at: new Date().toISOString(),
        path: location.pathname,
        lcp: state.lcp,
        inp: state.inp,
        cls: Number(state.cls.toFixed(4)),
        device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
      });
      localStorage.setItem('zq_performance_v1', JSON.stringify(history.slice(-30)));
    } catch (e) {}
  }

  function observe() {
    if (!window.PerformanceObserver) return;

    try {
      var lcpObserver = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          state.lcp = Math.round(entry.startTime);
        });
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      window.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
          save();
          lcpObserver.disconnect();
        }
      }, { once: true });
    } catch (e) {}

    try {
      var inpObserver = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          if (entry.interactionId) {
            state.inp = Math.max(state.inp || 0, Math.round(entry.duration));
          }
        });
      });
      inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 40 });
      window.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') inpObserver.disconnect();
      }, { once: true });
    } catch (e) {}

    try {
      var clsObserver = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          if (!entry.hadRecentInput) state.cls += entry.value;
        });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      window.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
          save();
          clsObserver.disconnect();
        }
      }, { once: true });
    } catch (e) {}
  }

  function status(key, value) {
    if (value === null) return ['—', 'Noch nicht gemessen'];
    if (key === 'cls') return value <= 0.10 ? ['Gut', '≤ 0,10'] : value <= 0.25 ? ['Beobachten', '≤ 0,25'] : ['Verbessern', '> 0,25'];
    if (key === 'lcp') return value <= 2500 ? ['Gut', '≤ 2,5 s'] : value <= 4000 ? ['Beobachten', '≤ 4,0 s'] : ['Verbessern', '> 4,0 s'];
    return value <= 200 ? ['Gut', '≤ 200 ms'] : value <= 500 ? ['Beobachten', '≤ 500 ms'] : ['Verbessern', '> 500 ms'];
  }

  function format(key, value) {
    if (value === null) return '—';
    if (key === 'cls') return value.toFixed(3);
    if (key === 'lcp') return (value / 1000).toFixed(2) + ' s';
    return Math.round(value) + ' ms';
  }

  function render() {
    var host = document.querySelector('#dashboardOverview');
    if (!host) return;

    var box = document.querySelector('#zqPerformance');
    if (!box) {
      box = document.createElement('article');
      box.className = 'panel zq-performance';
      box.id = 'zqPerformance';
      box.innerHTML = '<div class="panel-head"><h3>Performance</h3><span>Core Web Vitals · dieses Gerät</span></div><div class="zq-perf-grid"></div><p class="muted zq-perf-note">LCP, INP und CLS werden direkt im Browser gemessen. Keine IP-Adressen oder Inhalte werden übertragen.</p>';
      host.appendChild(box);
    }

    var metrics = [['LCP', 'lcp'], ['INP', 'inp'], ['CLS', 'cls']];
    box.querySelector('.zq-perf-grid').innerHTML = metrics.map(function (item) {
      var name = item[0];
      var key = item[1];
      var result = status(key, state[key]);
      return '<div class="zq-perf-card"><span>' + name + '</span><strong>' + format(key, state[key]) + '</strong><small>' + result[0] + ' · ' + result[1] + '</small></div>';
    }).join('');
  }

  function style() {
    if (document.querySelector('#zqPerformanceStyle')) return;
    var styleElement = document.createElement('style');
    styleElement.id = 'zqPerformanceStyle';
    styleElement.textContent = '.zq-performance{margin-top:16px}.zq-perf-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.zq-perf-card{padding:16px;border:1px solid #e0d8e8;border-radius:15px;background:#fff}.zq-perf-card span{display:block;font-size:12px;font-weight:700;color:#777}.zq-perf-card strong{display:block;font-size:28px;margin:6px 0}.zq-perf-card small{font-size:12px;color:#666}.zq-perf-note{margin:12px 0 0;font-size:12px}@media(max-width:650px){.zq-perf-grid{grid-template-columns:1fr}}';
    document.head.appendChild(styleElement);
  }

  function init() {
    style();
    observe();
    render();
    window.setTimeout(render, 1500);
    window.setTimeout(function () {
      save();
      render();
    }, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
