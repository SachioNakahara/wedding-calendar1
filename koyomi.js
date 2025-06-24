// FullCalendar六曜表示拡張モジュール
// 外部CSSファイル（rokuyo.css）と連動

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

// FullCalendar六曜拡張クラス
class FullCalendarRokuyoExtension {
  constructor() {
    this.rokuyoCalculator = new RokuyoCalculator();
  }

  /**
   * 既存のFullCalendar初期化関数を拡張
   */
  extendCalendarInitialization() {
    // 元のinitializeCalendar関数を保存
    const originalInitializeCalendar = window.initializeCalendar;

    if (typeof originalInitializeCalendar !== "function") {
      console.error("元のinitializeCalendar関数が見つかりません");
      return;
    }

    // 拡張されたinitializeCalendar関数を定義
    window.initializeCalendar = () => {
      const calendarEl = document.getElementById("calendar");

      if (!calendarEl) {
        console.error("カレンダー要素が見つかりません");
        return;
      }

      const events = [];

      try {
        const calendar = new FullCalendar.Calendar(calendarEl, {
          initialView: "dayGridMonth",
          headerToolbar: {
            left: "prev,next",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          },
          events: events,
          locale: "ja",
          timeZone: "Asia/Tokyo",
          selectable: true,
          editable: true,
          displayEventTime: true,
          displayEventEnd: true,
          eventDisplay: "block",
          fixedWeekCount: false,

          // 六曜表示の処理を追加
          dayCellDidMount: (arg) => {
            // 元の曜日背景色処理
            const day = arg.date.getDay();
            if (day === 0) {
              arg.el.classList.add("sunday-cell");
            } else if (day === 6) {
              arg.el.classList.add("saturday-cell");
            }

            // 六曜表示を追加
            this.addRokuyoToCell(arg);
          },

          // 週の描画後に曜日の色を適用（元の機能を維持）
          dayRender: function (dayRenderInfo) {
            const day = dayRenderInfo.date.getDay();
            if (day === 0) {
              dayRenderInfo.el.classList.add("sunday-cell");
            } else if (day === 6) {
              dayRenderInfo.el.classList.add("saturday-cell");
            }
          },

          // 曜日ヘッダーの書式設定（元の機能を維持）
          columnHeaderClassNames: function (arg) {
            const day = arg.date.getDay();
            if (day === 0) {
              return ["sunday-header"];
            } else if (day === 6) {
              return ["saturday-header"];
            }
            return [];
          },

          // 曜日ヘッダーの背景色を設定（元の機能を維持）
          columnHeaderDidMount: function (arg) {
            const day = arg.date.getDay();
            if (day === 0) {
              arg.el.style.backgroundColor = "#ffeeee";
            } else if (day === 6) {
              arg.el.style.backgroundColor = "#eeeeff";
            }
          },

          // 元のイベント処理を維持
          eventClick: function (info) {
            if (
              info.event.extendedProps &&
              info.event.extendedProps.isEnhanced
            ) {
              showEnhancedEventDetails(info.event);
            } else {
              showEventDetails(info.event);
            }
          },

          dateClick: function (info) {
            calendar.changeView("timeGridDay", info.dateStr);
          },

          eventDrop: function (info) {
            updateEvent(info.event);
          },

          eventResize: function (info) {
            updateEvent(info.event);
          },

          // ビュー変更時に六曜を再表示
          viewDidMount: () => {
            setTimeout(() => this.refreshRokuyoDisplay(), 100);
          },

          // 日付が変更された時に六曜を再表示
          datesSet: () => {
            setTimeout(() => this.refreshRokuyoDisplay(), 100);
          },
        });

        calendar.render();
        window.weddingCalendar = calendar;
        console.log("カレンダーが正常に初期化されました（六曜表示機能付き）");

        // 元のイベント読み込み処理
        loadEvents()
          .then((loadedEvents) => {
            if (loadedEvents && loadedEvents.length > 0) {
              loadedEvents.forEach((event) => {
                window.weddingCalendar.addEvent(event);
              });
            }
          })
          .catch((error) => {
            console.error("イベントの読み込みに失敗しました:", error);
          });

        // +ボタンのイベントリスナー（元の機能を維持）
        const addButton = document.getElementById("add-button");
        if (addButton) {
          addButton.addEventListener("click", function () {
            if (
              document.getElementById("schedule").classList.contains("active")
            ) {
              addNewEnhancedEvent(new Date());
            }
          });
        }
      } catch (error) {
        console.error("カレンダーの初期化中にエラーが発生しました:", error);
      }
    };
  }

  /**
   * セルに六曜を追加
   * @param {Object} arg - FullCalendarのdayCellDidMountの引数
   */
  addRokuyoToCell(arg) {
    try {
      const date = new Date(arg.date);
      const rokuyo = this.rokuyoCalculator.getRokuyo(date);

      // 六曜表示用の要素を作成（CSSクラスのみ設定）
      const rokuyoEl = document.createElement("div");
      rokuyoEl.className = `rokuyo-display rokuyo-${rokuyo}`;
      rokuyoEl.textContent = rokuyo;

      // セルに六曜要素を追加
      const dayNumber = arg.el.querySelector(".fc-daygrid-day-number");
      if (dayNumber) {
        dayNumber.parentNode.insertBefore(rokuyoEl, dayNumber.nextSibling);
      } else {
        arg.el.appendChild(rokuyoEl);
      }
    } catch (error) {
      console.error("六曜表示エラー:", error);
    }
  }

  /**
   * 六曜表示を更新（ビュー変更時など）
   */
  refreshRokuyoDisplay() {
    try {
      const dayCells = document.querySelectorAll(".fc-daygrid-day");

      dayCells.forEach((cell) => {
        // 既存の六曜表示を削除
        const existingRokuyo = cell.querySelector(".rokuyo-display");
        if (existingRokuyo) {
          existingRokuyo.remove();
        }

        // 日付を取得
        const dateStr = cell.getAttribute("data-date");
        if (dateStr) {
          const date = new Date(dateStr + "T00:00:00");
          const rokuyo = this.rokuyoCalculator.getRokuyo(date);

          // 新しい六曜表示を作成（CSSクラスのみ設定）
          const rokuyoEl = document.createElement("div");
          rokuyoEl.className = `rokuyo-display rokuyo-${rokuyo}`;
          rokuyoEl.textContent = rokuyo;

          // セルに追加
          const dayNumber = cell.querySelector(".fc-daygrid-day-number");
          if (dayNumber) {
            dayNumber.parentNode.insertBefore(rokuyoEl, dayNumber.nextSibling);
          } else {
            cell.appendChild(rokuyoEl);
          }
        }
      });
    } catch (error) {
      console.error("六曜表示更新エラー:", error);
    }
  }

  /**
   * 初期化メソッド
   */
  init() {
    this.extendCalendarInitialization();
    console.log("FullCalendar六曜拡張が初期化されました");
  }
}

// 自動初期化
document.addEventListener("DOMContentLoaded", function () {
  const rokuyoExtension = new FullCalendarRokuyoExtension();
  rokuyoExtension.init();
});

// グローバルに公開（デバッグ用）
window.FullCalendarRokuyoExtension = FullCalendarRokuyoExtension;
