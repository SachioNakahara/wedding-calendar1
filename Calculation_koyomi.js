// 天文計算エンジン
class AstronomyEngine {
  /**
   * 指定した日付に最も近い新月の日付を計算する
   * @param {number} year - 西暦年
   * @param {number} month - 月（1-12）
   * @param {number} day - 日
   * @return {Object} 新月の情報（ユリウス日と新月の日付）
   */
  static getNewMoonDate(year, month, day) {
    // 実際のアプリケーションではAstronomy-engineライブラリを使用
    // ここでは簡易的な計算ロジックを実装

    // 基準となる新月のデータ (2000/1/6が新月)
    const baseNewMoon = new Date(2000, 0, 6);
    const baseMsec = baseNewMoon.getTime();

    // 平均朔望月（新月から次の新月までの期間）: 約29.53059日
    const lunarCycle = 29.53059 * 24 * 60 * 60 * 1000;

    // 指定日からの日数差
    const targetDate = new Date(year, month - 1, day);
    const diffMsec = targetDate.getTime() - baseMsec;

    // 経過した朔望月の数（小数点以下は進行度）
    const cycles = diffMsec / lunarCycle;

    // 直前の新月までの完全なサイクル数
    const completeCycles = Math.floor(cycles);

    // 直前の新月の日付
    const prevNewMoonMsec = baseMsec + completeCycles * lunarCycle;
    const prevNewMoon = new Date(prevNewMoonMsec);

    // 次の新月の日付
    const nextNewMoonMsec = prevNewMoonMsec + lunarCycle;
    const nextNewMoon = new Date(nextNewMoonMsec);

    // ユリウス日の簡易計算（実際はもっと複雑）
    // J2000.0 (2000年1月1日正午UT) = 2451545.0
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

  /**
   * 二十四節気の日付を計算する
   * @param {number} year - 西暦年
   * @return {Object} 二十四節気の日付マップ
   */
  static calculate24Sekki(year) {
    // 実際のアプリケーションでは太陽の黄経から計算
    // ここでは簡易的な計算式を使用

    const sekki = {};

    // 春分の日（3月）
    const springEquinox = Math.floor(
      20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
    );
    sekki["春分"] = { month: 3, day: springEquinox };

    // 夏至（6月）
    const summerSolstice = Math.floor(
      21.851 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
    );
    sekki["夏至"] = { month: 6, day: summerSolstice };

    // 秋分（9月）
    const autumnEquinox = Math.floor(
      23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
    );
    sekki["秋分"] = { month: 9, day: autumnEquinox };

    // 冬至（12月）
    const winterSolstice = Math.floor(
      22.6224 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
    );
    sekki["冬至"] = { month: 12, day: winterSolstice };

    // その他の二十四節気（簡易的に固定値から算出）
    const allSekki = {
      小寒: { baseMonth: 1, baseDay: 5, refSekki: "冬至" },
      大寒: { baseMonth: 1, baseDay: 20, refSekki: "冬至" },
      立春: { baseMonth: 2, baseDay: 4, refSekki: "春分" },
      雨水: { baseMonth: 2, baseDay: 19, refSekki: "春分" },
      啓蟄: { baseMonth: 3, baseDay: 5, refSekki: "春分" },
      春分: { baseMonth: 3, baseDay: 20, refSekki: null },
      清明: { baseMonth: 4, baseDay: 5, refSekki: "春分" },
      穀雨: { baseMonth: 4, baseDay: 20, refSekki: "春分" },
      立夏: { baseMonth: 5, baseDay: 5, refSekki: "夏至" },
      小満: { baseMonth: 5, baseDay: 21, refSekki: "夏至" },
      芒種: { baseMonth: 6, baseDay: 6, refSekki: "夏至" },
      夏至: { baseMonth: 6, baseDay: 21, refSekki: null },
      小暑: { baseMonth: 7, baseDay: 7, refSekki: "夏至" },
      大暑: { baseMonth: 7, baseDay: 23, refSekki: "夏至" },
      立秋: { baseMonth: 8, baseDay: 7, refSekki: "秋分" },
      処暑: { baseMonth: 8, baseDay: 23, refSekki: "秋分" },
      白露: { baseMonth: 9, baseDay: 8, refSekki: "秋分" },
      秋分: { baseMonth: 9, baseDay: 23, refSekki: null },
      寒露: { baseMonth: 10, baseDay: 8, refSekki: "秋分" },
      霜降: { baseMonth: 10, baseDay: 23, refSekki: "秋分" },
      立冬: { baseMonth: 11, baseDay: 7, refSekki: "冬至" },
      小雪: { baseMonth: 11, baseDay: 22, refSekki: "冬至" },
      大雪: { baseMonth: 12, baseDay: 7, refSekki: "冬至" },
      冬至: { baseMonth: 12, baseDay: 21, refSekki: null },
    };

    // 主要な節気（二分二至）以外の計算
    Object.keys(allSekki).forEach((sekkiName) => {
      const s = allSekki[sekkiName];
      if (s.refSekki === null) {
        // すでに計算済みの二分二至
        return;
      }

      // 参照する節気からの相対的な位置関係で日付を調整
      const refDate = sekki[s.refSekki];
      const adjustment = Math.floor(
        ((s.baseDay - allSekki[s.refSekki].baseDay) * 15) / 30
      );

      sekki[sekkiName] = {
        month: s.baseMonth,
        day:
          s.baseDay +
          (year % 4 === 0 ? 1 : 0) +
          Math.floor((year - 2000) / 100) -
          Math.floor((year - 2000) / 400),
      };
    });

    return sekki;
  }
}

class JapaneseCalendar {
  constructor() {
    // 基準日と定数
    this.EPOCH_1900 = new Date(1900, 0, 1);
    this.MS_PER_DAY = 24 * 60 * 60 * 1000;

    // 六曜の順番（固定）
    this.ROKUYO = ["大安", "赤口", "先勝", "友引", "先負", "仏滅"];

    // 十干（じっかん）
    this.JIKKAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

    // 十二支（じゅうにし）
    this.JUNISHI = [
      "子",
      "丑",
      "寅",
      "卯",
      "辰",
      "巳",
      "午",
      "未",
      "申",
      "酉",
      "戌",
      "亥",
    ];

    // 月の日本語名
    this.MONTH_NAMES = [
      "睦月",
      "如月",
      "弥生",
      "卯月",
      "皐月",
      "水無月",
      "文月",
      "葉月",
      "長月",
      "神無月",
      "霜月",
      "師走",
    ];

    // 二十四節気の日付（毎年変動するため概算値）
    this.SEKKI_BASE = {
      小寒: { month: 1, day: 5 },
      大寒: { month: 1, day: 20 },
      立春: { month: 2, day: 4 },
      雨水: { month: 2, day: 19 },
      啓蟄: { month: 3, day: 5 },
      春分: { month: 3, day: 20 },
      清明: { month: 4, day: 5 },
      穀雨: { month: 4, day: 20 },
      立夏: { month: 5, day: 5 },
      小満: { month: 5, day: 21 },
      芒種: { month: 6, day: 6 },
      夏至: { month: 6, day: 21 },
      小暑: { month: 7, day: 7 },
      大暑: { month: 7, day: 23 },
      立秋: { month: 8, day: 7 },
      処暑: { month: 8, day: 23 },
      白露: { month: 9, day: 8 },
      秋分: { month: 9, day: 23 },
      寒露: { month: 10, day: 8 },
      霜降: { month: 10, day: 23 },
      立冬: { month: 11, day: 7 },
      小雪: { month: 11, day: 22 },
      大雪: { month: 12, day: 7 },
      冬至: { month: 12, day: 21 },
    };

    // 祝日定義（固定の日付のみ）
    this.FIXED_HOLIDAYS = {
      "1-1": "元日",
      "2-11": "建国記念の日",
      "2-23": "天皇誕生日",
      "4-29": "昭和の日",
      "5-3": "憲法記念日",
      "5-4": "みどりの日",
      "5-5": "こどもの日",
      "8-11": "山の日",
      "11-3": "文化の日",
      "11-23": "勤労感謝の日",
    };

    // 元号の定義（今後の元号は未定だが令和の次を仮定）
    this.GENGOS = [
      { name: "明治", startYear: 1868, endYear: 1912 },
      { name: "大正", startYear: 1912, endYear: 1926 },
      { name: "昭和", startYear: 1926, endYear: 1989 },
      { name: "平成", startYear: 1989, endYear: 2019 },
      { name: "令和", startYear: 2019, endYear: 2100 }, // 仮の終了年
    ];

    // 月齢データキャッシュ（パフォーマンス向上のため）
    this.moonPhaseCache = {};

    // 二十四節気データキャッシュ
    this.sekkiCache = {};

    // 祝日のキャッシュ
    this.holidayCache = {};
  }

  /**
   * 指定された日付の日本の暦情報を計算する
   * @param {Date|string} date - 計算する日付
   * @return {Object} 日本の暦情報
   */
  getCalendarInfo(date) {
    const targetDate = date instanceof Date ? date : new Date(date);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const day = targetDate.getDate();
    const weekDay = targetDate.getDay();
    const weekDayNames = ["日", "月", "火", "水", "木", "金", "土"];

    // 旧暦への変換（天文計算ベース）
    const kyureki = this.calculateKyureki(targetDate);

    // 六曜の計算
    const rokuyo = this.calculateRokuyo(kyureki);

    // 干支の計算
    const eto = this.calculateEto(year);

    // 十干十二支
    const daysSince1900 = Math.floor(
      (targetDate - this.EPOCH_1900) / this.MS_PER_DAY
    );
    const zyusi = this.JIKKAN[daysSince1900 % 10];
    const zyunisi = this.JUNISHI[daysSince1900 % 12];

    // 二十四節気
    const sekki = this.calculateSekki(targetDate);

    // 暦注（一粒万倍日、天赦日、大明日）
    const specialDays = this.calculateSpecialDays(targetDate, kyureki);

    // 元号と和暦年の計算
    const gengoInfo = this.calculateGengo(year);

    // 祝日の計算
    const holiday = this.calculateHoliday(year, month, day, weekDay);

    return {
      week: weekDayNames[weekDay],
      inreki: this.MONTH_NAMES[kyureki.month - 1],
      gengo: gengoInfo.gengo,
      wareki: gengoInfo.year,
      zyusi: zyusi,
      zyunisi: zyunisi,
      eto: eto,
      sekki: sekki,
      kyurekiy: kyureki.year,
      kyurekim: kyureki.month,
      kyurekid: kyureki.day,
      rokuyou: rokuyo,
      holiday: holiday || "",
      hitotubuflg: specialDays.hitotubuflg,
      tensyabiflg: specialDays.tensyabiflg,
      daimyoubiflg: specialDays.daimyoubiflg,
    };
  }

  /**
   * 西暦から旧暦への変換（天文計算ベース）
   * @param {Date} date - 西暦日付
   * @return {Object} 旧暦の年月日
   */
  calculateKyureki(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // 計算を高速化するためのキャッシュキー
    const cacheKey = `${year}-${month}`;

    // キャッシュされた月齢データがなければ計算
    if (!this.moonPhaseCache[cacheKey]) {
      // 現在月の新月を取得
      const newMoon = AstronomyEngine.getNewMoonDate(year, month, 1);

      // 前月の新月も取得
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevNewMoon = AstronomyEngine.getNewMoonDate(
        prevYear,
        prevMonth,
        28
      );

      // 次月の新月も取得
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const nextNewMoon = AstronomyEngine.getNewMoonDate(
        nextYear,
        nextMonth,
        1
      );

      this.moonPhaseCache[cacheKey] = {
        prevNewMoon: prevNewMoon,
        currentNewMoon: newMoon,
        nextNewMoon: nextNewMoon.date,
      };
    }

    const moonData = this.moonPhaseCache[cacheKey];
    const currentDate = new Date(year, month - 1, day);

    // 直前の新月を使って旧暦月を決定
    let kyurekiMonth, kyurekiYear, daysSinceNewMoon;

    if (currentDate < moonData.currentNewMoon.date) {
      // 今月の新月より前なら前月の新月が旧暦の始まり
      const prevNewMoonDate = moonData.prevNewMoon.date;
      kyurekiMonth = prevNewMoonDate.getMonth() + 1;
      kyurekiYear = prevNewMoonDate.getFullYear();
      daysSinceNewMoon =
        Math.floor((currentDate - prevNewMoonDate) / this.MS_PER_DAY) + 1;
    } else {
      // 今月の新月以降なら今月の新月が旧暦の始まり
      const currentNewMoonDate = moonData.currentNewMoon.date;
      kyurekiMonth = currentNewMoonDate.getMonth() + 1;
      kyurekiYear = currentNewMoonDate.getFullYear();
      daysSinceNewMoon =
        Math.floor((currentDate - currentNewMoonDate) / this.MS_PER_DAY) + 1;
    }

    // 日本の旧暦の場合、冬至以後が翌年とされるケースがあるが、ここでは簡易計算

    // 旧暦の日は新月からの経過日数
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
    // 六曜 = (旧暦月+旧暦日) mod 6
    const index = (kyureki.month + kyureki.day) % 6;
    return this.ROKUYO[index];
  }

  /**
   * 干支（えと）を計算する
   * @param {number} year - 西暦年
   * @return {string} 干支
   */
  calculateEto(year) {
    // 干支の計算（子年は子、丑年は丑...）
    // 十二支の配列から計算
    const offset = (year - 4) % 12;
    return this.JUNISHI[offset];
  }

  /**
   * 二十四節気を計算する
   * @param {Date} date - 西暦日付
   * @return {string} 二十四節気（その日に該当する節気がなければ空文字）
   */
  calculateSekki(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // キャッシュの有効活用
    if (!this.sekkiCache[year]) {
      this.sekkiCache[year] = AstronomyEngine.calculate24Sekki(year);
    }

    const sekkiData = this.sekkiCache[year];

    // 各節気をチェック
    for (const [sekki, dateInfo] of Object.entries(sekkiData)) {
      if (dateInfo.month === month && dateInfo.day === day) {
        return sekki;
      }
    }

    return "";
  }

  /**
   * 暦注（一粒万倍日、天赦日、大明日）を計算する
   * @param {Date} date - 西暦日付
   * @param {Object} kyureki - 旧暦情報
   * @return {Object} 各暦注のフラグ
   */
  calculateSpecialDays(date, kyureki) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDay = date.getDay();

    // 一粒万倍日の計算（十干が「甲」または「己」の日）
    const daysSince1900 = Math.floor(
      (date - this.EPOCH_1900) / this.MS_PER_DAY
    );
    const jikkan = daysSince1900 % 10;
    const hitotubuflg = jikkan === 0 || jikkan === 5; // 甲(0)または己(5)

    // 天赦日の計算（複雑な条件の組み合わせ）
    // 簡易的には「辛」の日で「巳」「酉」「丑」の月
    const junishi = kyureki.month % 12;
    const tensyabiflg =
      jikkan === 7 && (junishi === 5 || junishi === 9 || junishi === 1);

    // 大明日の計算（「大」の字が付く日：大安、大満月など）
    // 木曜と日曜の組み合わせ、または吉日とされる日
    const daimyoubiflg = weekDay === 0 || weekDay === 4;

    return {
      hitotubuflg,
      tensyabiflg,
      daimyoubiflg,
    };
  }

  /**
   * 元号と和暦年を計算する
   * @param {number} year - 西暦年
   * @return {Object} 元号と和暦年
   */
  calculateGengo(year) {
    for (const gengo of this.GENGOS) {
      if (year >= gengo.startYear && year <= gengo.endYear) {
        return {
          gengo: gengo.name,
          year: year - gengo.startYear + 1,
        };
      }
    }

    // 未知の期間の場合は便宜的に最後の元号を使用
    const lastGengo = this.GENGOS[this.GENGOS.length - 1];
    return {
      gengo: lastGengo.name,
      year: year - lastGengo.startYear + 1,
    };
  }

  /**
   * 祝日を計算する
   * 祝日かどうかを判定する（コアロジック：固定、移動、春分/秋分）
   * @param {number} year - 西暦年
   * @param {number} month - 月
   * @param {number} day - 日
   * @param {number} weekDay - 曜日（0:日曜日-6:土曜日）
   * @return {string|null} 祝日名（祝日でなければnull）
   */
  calculateHoliday(year, month, day, weekDay) {
    // キャッシュキーを作成
    const cacheKey = `${year}-${month}-${day}`;

    // キャッシュに結果があれば返す
    if (this.holidayCache[cacheKey] !== undefined) {
      return this.holidayCache[cacheKey];
    }

    let holidayName = null;

    // 固定祝日のチェック
    const fixedKey = `${month}-${day}`;
    if (this.FIXED_HOLIDAYS[fixedKey]) {
      holidayName = this.FIXED_HOLIDAYS[fixedKey];
    }
    // まだ祝日が見つからない場合は移動祝日をチェック
    else {
      // 成人の日（1月の第2月曜日）
      if (month === 1 && weekDay === 1 && day > 7 && day <= 14) {
        holidayName = "成人の日";
      }
      // 海の日（7月の第3月曜日）
      else if (month === 7 && weekDay === 1 && day > 14 && day <= 21) {
        holidayName = "海の日";
      }
      // 敬老の日（9月の第3月曜日）
      else if (month === 9 && weekDay === 1 && day > 14 && day <= 21) {
        holidayName = "敬老の日";
      }
      // スポーツの日（10月の第2月曜日）
      else if (month === 10 && weekDay === 1 && day > 7 && day <= 14) {
        holidayName = "スポーツの日";
      }
      // 春分の日
      else if (month === 3) {
        const springEquinox = Math.floor(
          20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
        );
        if (day === springEquinox) {
          holidayName = "春分の日";
        }
      }
      // 秋分の日
      else if (month === 9) {
        const autumnEquinox = Math.floor(
          23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
        );
        if (day === autumnEquinox) {
          holidayName = "秋分の日";
        }
      }
    }

    // 振替休日の計算（前日が日曜かつ祝日の場合）
    if (!holidayName && weekDay === 1) {
      // 月曜日
      const yesterday = new Date(year, month - 1, day - 1);
      const yesterdayMonth = yesterday.getMonth() + 1;
      const yesterdayDay = yesterday.getDate();
      const yesterdayKey = `${yesterdayMonth}-${yesterdayDay}`;

      // 前日が祝日かどうかを簡易的に判定
      let yesterdayIsHoliday = this.FIXED_HOLIDAYS[yesterdayKey] !== undefined;

      // 翌日が祝日かどうかを簡易的に判定
      const tomorrow = new Date(year, month - 1, day + 1);
      const tomorrowMonth = tomorrow.getMonth() + 1;
      const tomorrowDay = tomorrow.getDate();
      const tomorrowKey = `${tomorrowMonth}-${tomorrowDay}`;
      let tomorrowIsHoliday = this.FIXED_HOLIDAYS[tomorrowKey] !== undefined;

      // 春分の日と秋分の日のチェック
      if (!yesterdayIsHoliday && yesterdayMonth === 3) {
        const springEquinox = Math.floor(
          20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
        );
        if (yesterdayDay === springEquinox) {
          yesterdayIsHoliday = true;
        }
      }
      if (!yesterdayIsHoliday && yesterdayMonth === 9) {
        const autumnEquinox = Math.floor(
          23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
        );
        if (yesterdayDay === autumnEquinox) {
          yesterdayIsHoliday = true;
        }
      }

      // 翌日の祝日チェック（春分・秋分）
      if (!tomorrowIsHoliday && tomorrowMonth === 3) {
        const springEquinox = Math.floor(
          20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
        );
        if (tomorrowDay === springEquinox) {
          tomorrowIsHoliday = true;
        }
      }
      if (!tomorrowIsHoliday && tomorrowMonth === 9) {
        const autumnEquinox = Math.floor(
          23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
        );
        if (tomorrowDay === autumnEquinox) {
          tomorrowIsHoliday = true;
        }
      }

      // 前日も翌日も祝日なら「国民の休日」
      if (yesterdayIsHoliday && tomorrowIsHoliday) {
        holidayName = "国民の休日";
      }
    }

    // 結果をキャッシュして返す
    this.holidayCache[cacheKey] = holidayName;
    return holidayName;
  }

  /**
   * 指定月の旧暦情報を取得する
   * @param {number} year - 西暦年
   * @param {number} month - 月（1-12）
   * @return {Array} その月の日ごとの旧暦情報
   */
  getMonthCalendar(year, month) {
    const firstDay = new Date(year, month - 1, 1);
    const lastDate = new Date(year, month, 0).getDate();
    const calendar = [];

    for (let day = 1; day <= lastDate; day++) {
      const date = new Date(year, month - 1, day);
      calendar.push(this.getCalendarInfo(date));
    }

    return calendar;
  }

  /**
   * 年間カレンダー情報を取得
   * @param {number} year - 西暦年
   * @return {Object} 年間カレンダー情報
   */
  getYearCalendar(year) {
    const calendar = {};

    for (let month = 1; month <= 12; month++) {
      calendar[month] = this.getMonthCalendar(year, month);
    }

    return calendar;
  }

  /**
   * 特定の六曜の日を検索する
   * @param {number} year - 西暦年
   * @param {number} month - 月（1-12）
   * @param {string} rokuyoName - 検索する六曜名
   * @return {Array} 該当する日付の配列
   */
  findRokuyoDays(year, month, rokuyoName) {
    const calendar = this.getMonthCalendar(year, month);
    return calendar
      .filter((day) => day.rokuyou === rokuyoName)
      .map((day, index) => index + 1);
  }

  /**
   * 最も近い特定の二十四節気の日を取得
   * @param {Date} date - 基準日
   * @param {string} sekkiName - 節気名
   * @return {Object} 節気の日付情報
   */
  findNextSekki(date, sekkiName) {
    const year = date.getFullYear();
    const sekkiData =
      this.sekkiCache[year] || AstronomyEngine.calculate24Sekki(year);
    const targetSekki = sekkiData[sekkiName];

    if (!targetSekki) {
      return null;
    }

    const sekkiDate = new Date(year, targetSekki.month - 1, targetSekki.day);

    // 指定日以降の場合はそのまま返す
    if (sekkiDate >= date) {
      return {
        date: sekkiDate,
        sekki: sekkiName,
      };
    }

    // 指定日より前の場合は翌年を計算
    const nextYearSekkiData =
      this.sekkiCache[year + 1] || AstronomyEngine.calculate24Sekki(year + 1);
    const nextYearSekki = nextYearSekkiData[sekkiName];

    return {
      date: new Date(year + 1, nextYearSekki.month - 1, nextYearSekki.day),
      sekki: sekkiName,
    };
  }
}

// モジュールとしてエクスポート
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    JapaneseCalendar,
    AstronomyEngine,
  };
}
