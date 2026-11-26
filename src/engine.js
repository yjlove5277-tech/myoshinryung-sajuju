/* ============================================================
   묘신령 사주 엔진 (pure JavaScript · 외부 API/라이브러리 불필요)
   · 연주  : 입춘이 드는 순간 기준 (태양 황경 315도)
   · 월주  : 24절기 중 12節(월 경계) 시각 기준 — 1900~2050 정확 테이블,
            범위 밖은 천문 계산식(Meeus 태양 황경)으로 근사
   · 일주  : 율리우스일 기반 60갑자 (1900-01-01~2050-12-31 전수 검증)
   · 시주  : 일간 기준 오자시법(五鼠遁), 일진은 23:00(자시)에 바뀜
   ============================================================ */
var SAJU = (function () {
  "use strict";

  var STEMS = [
    { h: "甲", k: "갑", e: "목" }, { h: "乙", k: "을", e: "목" },
    { h: "丙", k: "병", e: "화" }, { h: "丁", k: "정", e: "화" },
    { h: "戊", k: "무", e: "토" }, { h: "己", k: "기", e: "토" },
    { h: "庚", k: "경", e: "금" }, { h: "辛", k: "신", e: "금" },
    { h: "壬", k: "임", e: "수" }, { h: "癸", k: "계", e: "수" }
  ];
  var BRANCHES = [
    { h: "子", k: "자", e: "수" }, { h: "丑", k: "축", e: "토" },
    { h: "寅", k: "인", e: "목" }, { h: "卯", k: "묘", e: "목" },
    { h: "辰", k: "진", e: "토" }, { h: "巳", k: "사", e: "화" },
    { h: "午", k: "오", e: "화" }, { h: "未", k: "미", e: "토" },
    { h: "申", k: "신", e: "금" }, { h: "酉", k: "유", e: "금" },
    { h: "戌", k: "술", e: "토" }, { h: "亥", k: "해", e: "수" }
  ];
  var ELEMENTS = ["목", "화", "토", "금", "수"];

  // 시진: index 0 = 자시. hour = 대표시각(중앙값, KST)
  var SIZIN = [
    { name: "자시", range: "23:00~00:59", hour: 23.5 },
    { name: "축시", range: "01:00~02:59", hour: 2 },
    { name: "인시", range: "03:00~04:59", hour: 4 },
    { name: "묘시", range: "05:00~06:59", hour: 6 },
    { name: "진시", range: "07:00~08:59", hour: 8 },
    { name: "사시", range: "09:00~10:59", hour: 10 },
    { name: "오시", range: "11:00~12:59", hour: 12 },
    { name: "미시", range: "13:00~14:59", hour: 14 },
    { name: "신시", range: "15:00~16:59", hour: 16 },
    { name: "유시", range: "17:00~18:59", hour: 18 },
    { name: "술시", range: "19:00~20:59", hour: 20 },
    { name: "해시", range: "21:00~22:59", hour: 22 }
  ];

  var DEG = Math.PI / 180;
  function mod(n, m) { return ((n % m) + m) % m; }

  /* ---------- 율리우스일 (Gregorian) ---------- */
  function toJD(y, m, d, hourFloat) {
    var yy = y, mm = m;
    if (mm <= 2) { yy -= 1; mm += 12; }
    var A = Math.floor(yy / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (yy + 4716)) + Math.floor(30.6001 * (mm + 1)) + d + B - 1524.5 +
      (hourFloat || 0) / 24;
  }

  /* ---------- 태양 겉보기 황경 (Meeus 저정밀, 오차 0.01도 이내) ---------- */
  function sunApparentLongitude(jd) {
    var T = (jd - 2451545.0) / 36525;
    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    var M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    var Mr = M * DEG;
    var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr) +
      (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) +
      0.000289 * Math.sin(3 * Mr);
    var trueLong = L0 + C;
    var omega = 125.04 - 1934.136 * T;
    return mod(trueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG), 360);
  }

  /* ---------- 특정 황경이 되는 순간(JD, UT) 이분법 ---------- */
  function findLongitudeJD(targetLon, approxJD) {
    function f(jd) {
      return mod(sunApparentLongitude(jd) - targetLon + 180, 360) - 180;
    }
    var lo = approxJD - 5.5, hi = approxJD + 5.5;
    if (!(f(lo) < 0 && f(hi) > 0)) { lo = approxJD - 12; hi = approxJD + 12; }
    if (!(f(lo) < 0 && f(hi) > 0)) return approxJD;
    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      if (f(mid) < 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* ---------- 12節(월 경계) ---------- */
  var JEOL = [
    { lon: 315, name: "입춘", branch: 2, month: 2 },
    { lon: 345, name: "경칩", branch: 3, month: 3 },
    { lon: 15, name: "청명", branch: 4, month: 4 },
    { lon: 45, name: "입하", branch: 5, month: 5 },
    { lon: 75, name: "망종", branch: 6, month: 6 },
    { lon: 105, name: "소서", branch: 7, month: 7 },
    { lon: 135, name: "입추", branch: 8, month: 8 },
    { lon: 165, name: "백로", branch: 9, month: 9 },
    { lon: 195, name: "한로", branch: 10, month: 10 },
    { lon: 225, name: "입동", branch: 11, month: 11 },
    { lon: 255, name: "대설", branch: 0, month: 12 },
    { lon: 285, name: "소한", branch: 1, month: 1 }
  ];

  /* 정확 테이블(1900~2050, KST 분 단위) 또는 천문 계산식 */
  function termsOfYear(year) {
    if (year >= 1900 && year <= 2050 && typeof TERM_TABLE === "string" && TERM_TABLE.length >= (year - 1899) * 60) {
      var chunk = TERM_TABLE.substr((year - 1900) * 60, 60);
      var base = toJD(year, 1, 1, 0); // KST 1월 1일 00:00의 JD
      var arr = [];
      for (var i = 0; i < 12; i++) {
        var mins = parseInt(chunk.substr(i * 5, 5), 36);
        arr.push({ name: JEOL[i].name, branch: JEOL[i].branch, jd: base + mins / 1440, exact: true });
      }
      return arr;
    }
    // 폴백: 태양 황경 계산(UT 기준 JD)
    return JEOL.map(function (t) {
      var approx = toJD(year, t.month, 6, 0);
      return { name: t.name, branch: t.branch, jd: findLongitudeJD(t.lon, approx) - 9 / 24, exact: false };
    });
  }

  /* ---------- 일주: 율리우스일 기반 60갑자 ----------
     검증: 1900-01-01 ~ 2050-12-31 전 날짜 일진 일치(offset 49) */
  var DAY_OFFSET = 49;
  function dayGZIndex(jdn) { return mod(jdn + DAY_OFFSET, 60); }

  function jdToKST(jdKst) {
    var jd = jdKst + 0.5;
    var Z = Math.floor(jd), F = jd - Z, A = Z;
    if (Z >= 2299161) {
      var alpha = Math.floor((Z - 1867216.25) / 36524.25);
      A = Z + 1 + alpha - Math.floor(alpha / 4);
    }
    var B = A + 1524, C = Math.floor((B - 122.1) / 365.25);
    var D = Math.floor(365.25 * C), E = Math.floor((B - D) / 30.6001);
    var day = B - D - Math.floor(30.6001 * E);
    var month = E < 14 ? E - 1 : E - 13;
    var year = month > 2 ? C - 4716 : C - 4715;
    var hh = Math.floor(F * 24), mi = Math.round((F * 24 - hh) * 60);
    if (mi === 60) { mi = 0; hh += 1; }
    return {
      year: year, month: month, day: day, hour: hh, minute: mi,
      text: year + "-" + pad2(month) + "-" + pad2(day) + " " + pad2(hh) + ":" + pad2(mi)
    };
  }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  /* ---------- 메인 ---------- */
  function compute(input) {
    var y = input.y, m = input.m, d = input.d;
    var known = !(input.sizinIndex === null || input.sizinIndex === undefined);
    var hourMid = known ? SIZIN[input.sizinIndex].hour : 12;
    if (typeof input.hourFloat === "number") { hourMid = input.hourFloat; known = true; }
    var sizinIdx = known
      ? (input.sizinIndex !== null && input.sizinIndex !== undefined ? input.sizinIndex
        : Math.floor(mod(hourMid + 1, 24) / 2))
      : null;

    var jdKST = toJD(y, m, d, hourMid);   // 출생 순간 (KST 기준 JD)
    var jdUT = jdKST - 9 / 24;

    /* 연주 */
    var thisYear = termsOfYear(y);
    var ipchun = thisYear[0].jd;
    var sajuYear = jdKST >= ipchun ? y : y - 1;
    var yStem = mod(sajuYear - 1984, 10);
    var yBranch = mod(sajuYear - 1984, 12);

    /* 월주: 출생 순간 이전에 든 가장 최근 節 */
    var prevYear = termsOfYear(y - 1);
    var cands = prevYear.concat(thisYear);
    var chosen = cands[0], best = -1e12;
    for (var i = 0; i < cands.length; i++) {
      var t = cands[i];
      if (t.jd <= jdKST + 1e-9 && t.jd > best) { best = t.jd; chosen = t; }
    }
    var mBranch = chosen.branch;
    // 五虎遁: 寅월 천간 = (연간%5)*2+2, 이후 지지 순서대로 +1
    var mStem = mod((mod(yStem, 5) * 2 + 2) + ((mBranch - 2 + 12) % 12), 10);

    /* 일주: 일진은 자시(23:00)에 바뀐다 */
    var jdn = Math.floor(jdKST + 0.5);
    if (hourMid >= 23) jdn += 1;
    var dIdx = dayGZIndex(jdn);
    var dStem = mod(dIdx, 10);
    var dBranch = mod(dIdx, 12);

    /* 시주: 오자시법 */
    var hStem = null, hBranch = null;
    if (known) {
      hBranch = sizinIdx;
      hStem = mod(mod(dStem, 5) * 2 + hBranch, 10);
    }

    var pillars = {
      year: { stem: yStem, branch: yBranch },
      month: { stem: mStem, branch: mBranch },
      day: { stem: dStem, branch: dBranch },
      hour: known ? { stem: hStem, branch: hBranch } : null
    };

    /* 오행 분포 */
    var counts = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    function addP(p) {
      if (!p) return;
      counts[STEMS[p.stem].e]++;
      counts[BRANCHES[p.branch].e]++;
    }
    addP(pillars.year); addP(pillars.month); addP(pillars.day); addP(pillars.hour);
    var total = known ? 8 : 6;

    var lacking = [], minCnt = 99, maxCnt = -1;
    ELEMENTS.forEach(function (e) {
      if (counts[e] === 0) lacking.push(e);
      if (counts[e] < minCnt) minCnt = counts[e];
      if (counts[e] > maxCnt) maxCnt = counts[e];
    });
    var weakest = ELEMENTS.filter(function (e) { return counts[e] === minCnt; })[0];
    var strongest = ELEMENTS.filter(function (e) { return counts[e] === maxCnt; })[0];
    var percent = {};
    ELEMENTS.forEach(function (e) { percent[e] = Math.round(counts[e] / total * 1000) / 10; });

    function gzText(p) { return p ? STEMS[p.stem].h + BRANCHES[p.branch].h : "??"; }

    return {
      pillars: pillars,
      total: total,
      counts: counts,
      percent: percent,
      lacking: lacking,
      weakest: weakest,
      strongest: strongest,
      sajuYear: sajuYear,
      monthJeol: chosen.name,
      dayGZ: STEMS[dStem].h + BRANCHES[dBranch].h,
      dayGZKR: STEMS[dStem].k + BRANCHES[dBranch].k,
      dayMaster: STEMS[dStem],
      hourKnown: known,
      ipchun: jdToKST(ipchun).text,
      monthStart: jdToKST(chosen.jd).text,
      exactTerms: chosen.exact
    };
  }

  return {
    compute: compute,
    STEMS: STEMS,
    BRANCHES: BRANCHES,
    ELEMENTS: ELEMENTS,
    SIZIN: SIZIN,
    toJD: toJD,
    sunLongitude: sunApparentLongitude,
    findLongitudeJD: findLongitudeJD,
    dayGZIndex: dayGZIndex,
    termsOfYear: termsOfYear,
    jdToKST: jdToKST,
    mod: mod
  };
})();

if (typeof module !== "undefined" && module.exports) { module.exports = SAJU; }
