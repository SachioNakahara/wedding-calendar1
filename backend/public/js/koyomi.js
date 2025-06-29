// FullCalendar六曜表示拡張モジュール
// 外部CSSファイル（rokuyo.css）と連動。main.jsから呼び出されることを想定。

// 天文計算エンジン
class AstronomyEngine {
  static getNewMoonDate(year, month, day) {
    const baseNewMoon = new Date(2000, 0, 6);
    const baseMsec = baseNewMoon.getTime();
    const lunarCycle = 29.53059 * 24 * 60 * 60 * 1000;
    const targetDate = new Date(year, month - 1, day);
    const diffMsec = targetDate.getTime() - baseMsec;
    const cycles = diffMsec / lunarCycle;
    const completeCycles = Math.floor(cycles);
    const prevNewMoonMsec = baseMsec + completeCycles * lunarCycle;
    const prevNewMoon = new Date(prevNewMoonMsec);
    const nextNewMoonMsec = prevNewMoonMsec + lunarCycle;
    const nextNewMoon = new Date(nextNewMoonMsec);
    const J2000 = 2451545.0;
    const msecPerDay = 24 * 60 * 60 * 1000;
    const prevNewMoonJD =
      J2000 +
      (prevNewMoonMsec - new Date(2000, 0, 1, 12).getTime()) / msecPerDay;

    return {
      jd: prevNewMoonJD,
      date: prevNewMoon,
      nextNewMoon: nextNewMoon,
    };
  }
}

// 簡易版JapaneseCalendar（六曜計算に特化）
class RokuyoCalculator {
  constructor() {
    this.EPOCH_1900 = new Date(1900, 0, 1);
    this.MS_PER_DAY = 24 * 60 * 60 * 1000;
    this.ROKUYO = ["大安", "赤口", "先勝", "友引", "先負", "仏滅"];
    this.moonPhaseCache = {};
  }

  /**
   * 指定された日付の六曜を取得
   * @param {Date} date - 日付
   * @return {string} 六曜
   */
  getRokuyo(date) {
    const kyureki = this.calculateKyureki(date);
    return this.calculateRokuyo(kyureki);
  }

  /**
   * 西暦から旧暦への変換
   * @param {Date} date - 西暦日付
   * @return {Object} 旧暦の年月日
   */
  calculateKyureki(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const cacheKey = `${year}-${month}`;

    if (!this.moonPhaseCache[cacheKey]) {
      const newMoon = AstronomyEngine.getNewMoonDate(year, month, 1);
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevNewMoon = AstronomyEngine.getNewMoonDate(
        prevYear,
        prevMonth,
        28
      );

      this.moonPhaseCache[cacheKey] = {
        prevNewMoon: prevNewMoon,
        currentNewMoon: newMoon,
      };
    }

    const moonData = this.moonPhaseCache[cacheKey];
    const currentDate = new Date(year, month - 1, day);

    let kyurekiMonth, kyurekiYear, daysSinceNewMoon;

    if (currentDate < moonData.currentNewMoon.date) {
      const prevNewMoonDate = moonData.prevNewMoon.date;
      kyurekiMonth = prevNewMoonDate.getMonth() + 1;
      kyurekiYear = prevNewMoonDate.getFullYear();
      daysSinceNewMoon =
        Math.floor((currentDate - prevNewMoonDate) / this.MS_PER_DAY) + 1;
    } else {
      const currentNewMoonDate = moonData.currentNewMoon.date;
      kyurekiMonth = currentNewMoonDate.getMonth() + 1;
      kyurekiYear = currentNewMoonDate.getFullYear();
      daysSinceNewMoon =
        Math.floor((currentDate - currentNewMoonDate) / this.MS_PER_DAY) + 1;
    }

    const kyurekiDay = daysSinceNewMoon;

    return {
      year: kyurekiYear,
      month: kyurekiMonth,
      day: kyurekiDay,
    };
  }

  /**
   * 六曜を計算する
   * @param {Object} kyureki - 旧暦の年月日
   * @return {string} 六曜
   */
  calculateRokuyo(kyureki) {
    const index = (kyureki.month + kyureki.day) % 6;
    return this.ROKUYO[index];
  }
}

// グローバルスコープでRokuyoCalculatorのインスタンスを作成
const rokuyoCalculator = new RokuyoCalculator();

/**
 * 指定されたセルに六曜表示を追加するグローバル関数
 * @param {Object} arg - FullCalendarのdayCellDidMountの引数
 */
window.addRokuyoToCell = function (arg) {
  if (!arg || !arg.date || !arg.el) return;

  try {
    const date = new Date(arg.date);
    const rokuyo = rokuyoCalculator.getRokuyo(date);

    // 既存の六曜表示があれば削除
    const existingRokuyo = arg.el.querySelector(".rokuyo-display");
    if (existingRokuyo) {
      existingRokuyo.remove();
    }

    // 六曜表示用の要素を作成
    const rokuyoEl = document.createElement("div");
    rokuyoEl.className = `rokuyo-display rokuyo-${rokuyo}`;
    rokuyoEl.textContent = rokuyo;

    // セルに六曜要素を追加
    const dayNumber = arg.el.querySelector(".fc-daygrid-day-number");
    if (dayNumber) {
      // 日付番号の直後に挿入
      dayNumber.parentNode.insertBefore(rokuyoEl, dayNumber.nextSibling);
    } else {
      // 見つからない場合はセルの末尾に追加
      arg.el.appendChild(rokuyoEl);
    }
  } catch (error) {
    console.error("六曜表示エラー:", error);
  }
};

console.log("koyomi.js: 六曜表示関数 (addRokuyoToCell) が準備できました。");
