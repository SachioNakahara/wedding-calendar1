function initializeCalendar() {
  const calendarEl = document.getElementById("calendar");

  if (!calendarEl) {
    console.error("カレンダー要素が見つかりません");
    return;
  }

  try {
    const initialEvents = []; // 初期イベントは空の配列として定義
    // FullCalendarの初期化
    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      headerToolbar: {
        left: "prev,next", // todayボタンを削除
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      },
      events: initialEvents, // ここで空の配列を渡す

      locale: "ja", // 日本語ロケールは維持
      timeZone: "local", // タイムゾーンをUTCに変更
      selectable: true,
      editable: true,
      displayEventTime: true,
      displayEventEnd: true,
      eventDisplay: "block",
      // 5週間表示に調整
      fixedWeekCount: false,

      // 曜日の背景色を設定（v5対応）
      dayCellDidMount: function (arg) {
        // 日付の曜日を取得
        const day = arg.date.getDay();

        // 日曜日は0、土曜日は6
        if (day === 0) {
          // 日曜日のセルに明示的にクラスを追加
          arg.el.classList.add("sunday-cell");
        } else if (day === 6) {
          // 土曜日のセルに明示的にクラスを追加
          arg.el.classList.add("saturday-cell");
        }
      },

      // 曜日ヘッダーの背景色を設定（v5対応）
      dayHeaderDidMount: function (arg) {
        const day = arg.date.getDay();
        if (day === 0) {
          arg.el.classList.add("sunday-header");
          arg.el.style.backgroundColor = "#ffeeee"; // 日曜日の背景色
          arg.el.style.color = "#ff0000"; // 赤色テキスト
        } else if (day === 6) {
          arg.el.classList.add("saturday-header");
          arg.el.style.backgroundColor = "#eeeeff"; // 土曜日の背景色
          arg.el.style.color = "#0000ff"; // 青色テキスト
        }
      },

      eventClick: function (info) {
        // イベントクリック時の処理
        // 拡張イベントの場合は拡張詳細表示、そうでなければ通常表示
        if (info.event.extendedProps && info.event.extendedProps.isEnhanced) {
          showEnhancedEventDetails(info.event);
        } else {
          showEventDetails(info.event);
        }
      },
      dateClick: function (info) {
        // 日付クリック時の処理
        // day viewに切り替えるだけ
        calendar.changeView("timeGridDay", info.dateStr);
      },

      eventDrop: function (info) {
        // イベントドラッグ時の処理
        updateEvent(info.event);
      },
      eventResize: function (info) {
        // イベントリサイズ時の処理
        updateEvent(info.event);
      },

      // v5で追加されたビューマウントイベント
      viewDidMount: function (arg) {
        // ビューがマウントされた後に曜日の色を適用
        setTimeout(() => {
          applyWeekdayColors();
          // 六曜も更新
          if (window.updateRokuyo) {
            window.updateRokuyo();
          }
        }, 100);
      },

      // 日付範囲が変更された時のイベント
      datesSet: function (arg) {
        // 日付が変更された後に色を適用
        setTimeout(() => {
          applyWeekdayColors();
          // 六曜も更新
          if (window.updateRokuyo) {
            window.updateRokuyo();
          }
        }, 100);
      },
    });

    calendar.render();

    // グローバル変数として保存
    window.weddingCalendar = calendar;
    console.log("カレンダーが正常に初期化されました");

    // APIやローカルストレージからイベントを読み込む
    loadEvents()
      .then((loadedEvents) => {
        // イベントが読み込まれたら、それらをカレンダーに追加
        if (loadedEvents && loadedEvents.length > 0) {
          loadedEvents.forEach((event) => {
            window.weddingCalendar.addEvent(event);
          });
          console.log(`${loadedEvents.length}件のイベントが読み込まれました`);
        }
      })
      .catch((error) => {
        console.error("イベントの読み込みに失敗しました:", error);
      });

    // カスタムCSSを追加
    addCustomCalendarStyles();
  } catch (error) {
    console.error("カレンダーの初期化中にエラーが発生しました:", error);
  }
}

// イベント詳細表示
function showEventDetails(event) {
  alert(
    `イベント: ${event.title}\n開始: ${event.start.toLocaleString()}\n終了: ${
      event.end ? event.end.toLocaleString() : "未設定"
    }`
  );
}

// 拡張イベント詳細表示
function showEnhancedEventDetails(event) {
  const description = event.extendedProps.description || "説明なし";
  const createdAt = event.extendedProps.createdAt
    ? new Date(event.extendedProps.createdAt).toLocaleString()
    : "不明";

  alert(
    `イベント: ${
      event.title
    }\n説明: ${description}\n開始: ${event.start.toLocaleString()}\n終了: ${
      event.end ? event.end.toLocaleString() : "未設定"
    }\n作成日時: ${createdAt}`
  );
}

// カスタムCSSスタイルを追加する関数
function addCustomCalendarStyles() {
  const styleEl = document.createElement("style");

  styleEl.innerHTML = `

/* 日曜日のセルのスタイル */

.sunday-cell,

.fc-day.fc-day-sun,

td.fc-day-sun,

.fc-daygrid-day.fc-day-sun {

background-color: #ffeeee !important; /* 薄い赤色 */

}



/* 土曜日のセルのスタイル */

.saturday-cell,

.fc-day.fc-day-sat,

td.fc-day-sat,

.fc-daygrid-day.fc-day-sat {

background-color: #eeeeff !important; /* 薄い青色 */

}



/* 日曜日のヘッダーのスタイル */

.sunday-header,

.fc-col-header-cell.fc-day-sun,

.fc-scrollgrid th.fc-day-sun {

color: #ff0000 !important; /* 赤色テキスト */

background-color: #ffeeee !important;

}



/* 土曜日のヘッダーのスタイル */

.saturday-header,

.fc-col-header-cell.fc-day-sat,

.fc-scrollgrid th.fc-day-sat {

color: #0000ff !important; /* 青色テキスト */

background-color: #eeeeff !important;

}



/* v5対応: より具体的なセレクタ */

.fc-theme-standard .fc-scrollgrid {

border: 1px solid #ddd;

}



.fc-theme-standard .fc-scrollgrid th.fc-day-sun {

background-color: #ffeeee !important;

color: #ff0000 !important;

}



.fc-theme-standard .fc-scrollgrid th.fc-day-sat {

background-color: #eeeeff !important;

color: #0000ff !important;

}



/* 六曜表示のスタイル */

.rokuyo-display { /* koryomi.js で使用されているクラス名に合わせます */

font-size: 15px;

color: #666;

text-align: center;

margin-top: 1px;

/* 背景色の範囲を調整するためのpaddingを追加・調整します */

padding: 5px ; /* 例: 上下1px、左右3pxのパディング */

line-height: 1.2; /* 行の高さをフォントサイズに合わせて調整 */

display: inline-block; /* 要素の幅を内容に合わせ、paddingを有効にする */

}



.rokuyo-大安 { color: #00aa00; font-weight: bold; }

.rokuyo-赤口 { color: #aa0000; }

.rokuyo-先勝 { color: #0000aa; }

.rokuyo-友引 { color: #aa5500; }

.rokuyo-先負 { color: #666666; }

.rokuyo-仏滅 { color: #aa0000; font-weight: bold; }

`;

  document.head.appendChild(styleEl);
}

// 修正されたローカルストレージからイベントを読み込む関数
function loadEvents() {
  return new Promise((resolve, reject) => {
    try {
      const events = [];

      // forms.jsで保存された様々なキー名から予定を読み込み
      const storageKeys = [
        // "weddingEvents", // forms.jsもcalendarEventsに保存するようになったため不要に
        "appointments", // 予約・約束
        "schedules", // スケジュール
        "tasks", // タスク
        "meetings", // 会議
        "reminders", // リマインダー
        "calendarEvents", // カレンダーイベント
      ];

      // 各キーからデータを読み込み
      storageKeys.forEach((key) => {
        try {
          const storedData = localStorage.getItem(key);
          if (storedData) {
            const parsedData = JSON.parse(storedData);

            // 配列の場合
            if (Array.isArray(parsedData)) {
              parsedData.forEach((item) => {
                const event = convertToCalendarEvent(item, key);
                if (event) {
                  events.push(event);
                }
              });
            }
            // オブジェクトの場合
            else if (typeof parsedData === "object" && parsedData !== null) {
              const event = convertToCalendarEvent(parsedData, key);
              if (event) {
                events.push(event);
              }
            }
          }
        } catch (parseError) {
          console.warn(`${key}の解析に失敗しました:`, parseError);
        }
      });

      console.log(
        `ローカルストレージから${events.length}件のイベントを読み込みました`
      );

      // 必ずresolveを呼び出す
      resolve(events);
    } catch (error) {
      console.error("イベントの読み込みに失敗しました:", error);
      reject(error);
    }
  });
}

// ローカルストレージのデータをFullCalendarイベント形式に変換
function convertToCalendarEvent(data, sourceKey) {
  if (!data) return null;

  try {
    // 基本的なイベント情報の抽出
    let title =
      data.title ||
      data.name ||
      data.subject ||
      data.eventName ||
      "無題のイベント";
    let start = data.start || data.startDate || data.date || data.datetime;
    let end = data.end || data.endDate || null;

    // 日付文字列の正規化
    if (typeof start === "string") {
      // ISO形式やその他の日付形式を Date オブジェクトに変換
      start = new Date(start);
      if (isNaN(start.getTime())) {
        console.warn("無効な開始日付:", data.start);
        return null;
      }
    }

    if (end && typeof end === "string") {
      end = new Date(end);
      if (isNaN(end.getTime())) {
        end = null;
      }
    }

    // 終了時間がない場合は開始時間の1時間後に設定
    if (!end && start) {
      end = new Date(start.getTime() + 60 * 60 * 1000); // 1時間後
    }

    // イベントの種類に応じた色分け
    const eventColors = {
      weddingEvents: "#ff69b4", // ピンク
      appointments: "#32cd32", // ライムグリーン
      schedules: "#4169e1", // ロイヤルブルー
      tasks: "#ff6347", // トマト
      meetings: "#9370db", // ミディアムパープル
      reminders: "#ffa500", // オレンジ
      events: "#3788d8", // デフォルトブルー
      calendarEvents: "#20b2aa", // ライトシーグリーン
    };

    // FullCalendar用のイベントオブジェクトを作成
    const calendarEvent = {
      title: title,
      start: start,
      end: end,
      allDay: data.allDay || false,
      backgroundColor:
        data.color ||
        data.backgroundColor ||
        eventColors[sourceKey] ||
        "#3788d8",
      borderColor:
        data.borderColor || data.color || eventColors[sourceKey] || "#3788d8",
      textColor: data.textColor || "#ffffff",
      display: "block",
      // data.extendedProps が存在し、かつその中にidがあればそれを使う。なければdata.id。それでもなければ新規生成。
      extendedProps: Object.assign({}, data.extendedProps || {}, {
        sourceKey: sourceKey,
        originalData: data,
        description: data.description || data.memo || data.note || "",
        location: data.location || data.place || "",
        category: data.category || sourceKey,
        createdAt: data.createdAt || new Date().toISOString(),
        id:
          (data.extendedProps && data.extendedProps.id) ||
          data.id ||
          generateEventId(),
      }),
    };

    return calendarEvent;
  } catch (error) {
    console.error("イベント変換エラー:", error, data);
    return null;
  }
}

// イベントIDを生成する関数
window.generateEventId = function () {
  // グローバルに公開
  return "event_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
};

// イベントの保存（ローカルストレージ対応）
function saveEvents() {
  if (!window.weddingCalendar) {
    console.error("カレンダーが初期化されていません");
    return;
  }

  try {
    // カレンダーから全てのイベントを取得

    const allCalendarEvents = window.weddingCalendar
      .getEvents()
      .map((event) => {
        // 保存用にイベントデータをシリアライズ
        return {
          id: event.extendedProps?.id || generateEventId(), // extendedProps.idを優先、なければ生成

          title: event.title || "無題のイベント",
          start: event.start?.toISOString(),
          end: event.end?.toISOString(),
          allDay: event.allDay,
          backgroundColor: event.backgroundColor || "#3788d8",
          borderColor: event.borderColor || event.backgroundColor || "#3788d8",
          textColor: event.textColor || "#ffffff",
          description: event.extendedProps?.description || "",
          location: event.extendedProps?.location || "",
          category: event.extendedProps?.category || "events",
          createdAt: event.extendedProps?.createdAt || new Date().toISOString(),
          sourceKey: event.extendedProps?.sourceKey || "calendarEvents",
          extendedProps: event.extendedProps || {}, // extendedProps全体を保存することでIDも確実に含まれる
        };
      });

    // IDに基づいて重複を排除
    const uniqueEvents = [];
    const seenIds = new Set();
    allCalendarEvents.forEach((event) => {
      const eventId = event.extendedProps?.id || event.id; // extendedProps.id を優先
      if (eventId && !seenIds.has(eventId)) {
        uniqueEvents.push(event);
        seenIds.add(eventId);
      } else if (!eventId) {
        uniqueEvents.push(event); // IDがないものはとりあえず追加（警告はconvertToCalendarEventで出す想定）
        console.warn(
          "IDのないイベントがsaveEventsで見つかりました:",
          event.title
        );
      }
    });

    // ローカルストレージに保存

    localStorage.setItem("calendarEvents", JSON.stringify(uniqueEvents));
    console.log(
      `${uniqueEvents.length}件のユニークなイベントをローカルストレージに保存しました (元: ${allCalendarEvents.length}件)`
    );
  } catch (error) {
    console.error("イベントの保存に失敗しました:", error);
  }
}

// 拡張イベントの保存
function saveEnhancedEvents() {
  saveEvents(); // 同じ処理
}

// イベント検索
function searchEvents(query) {
  if (!window.weddingCalendar) {
    console.error("カレンダーが初期化されていません");
    return;
  }

  if (!query) {
    // 検索クエリが空の場合は全てのイベントを表示
    window.weddingCalendar.getEvents().forEach((event) => {
      event.setProp("display", "block");
    });
    return;
  }

  // 検索クエリに一致するイベントのみ表示
  const lowerQuery = query.toLowerCase();
  window.weddingCalendar.getEvents().forEach((event) => {
    const title = event.title.toLowerCase();
    const description = (event.extendedProps?.description || "").toLowerCase();
    const location = (event.extendedProps?.location || "").toLowerCase();

    if (
      title.includes(lowerQuery) ||
      description.includes(lowerQuery) ||
      location.includes(lowerQuery)
    ) {
      event.setProp("display", "block");
    } else {
      event.setProp("display", "none");
    }
  });
}

// イベント更新
function updateEvent(event) {
  // すべてのイベントを更新して保存
  saveEvents();
  console.log("イベントが更新されました:", event.title);
}

// カレンダーリフレッシュ機能（ローカルストレージから再読み込み）
function refreshCalendar() {
  if (!window.weddingCalendar) {
    console.error("カレンダーが初期化されていません");
    return;
  }

  // 現在のイベントをすべて削除
  window.weddingCalendar.getEvents().forEach((event) => {
    event.remove();
  });

  // ローカルストレージから再読み込み
  loadEvents()
    .then((loadedEvents) => {
      if (loadedEvents && loadedEvents.length > 0) {
        loadedEvents.forEach((event) => {
          window.weddingCalendar.addEvent(event);
        });
        console.log(
          `カレンダーをリフレッシュしました: ${loadedEvents.length}件のイベント`
        );
      }
    })
    .catch((error) => {
      console.error("カレンダーのリフレッシュに失敗しました:", error);
    });
}

// タブの初期化
function initializeTabs() {
  const tabs = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", function (e) {
      e.preventDefault();

      // すべてのタブからアクティブクラスを削除
      tabs.forEach((t) => t.classList.remove("active"));

      // すべてのタブコンテンツからアクティブクラスを削除
      tabContents.forEach((content) => content.classList.remove("active"));

      // クリックされたタブにアクティブクラスを追加
      this.classList.add("active");

      // 対応するタブコンテンツを表示
      const targetId = this.getAttribute("data-tab");
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add("active");
      }
    });
  });

  // デフォルトのタブをアクティブにする
  if (tabs.length > 0) {
    tabs[0].click();
  }
}

// 全てのセルに曜日に応じた色を適用する関数
function applyWeekdayColors() {
  // カレンダーの全てのセルに対して処理
  const dayCells = document.querySelectorAll(".fc-daygrid-day");

  dayCells.forEach((cell) => {
    // data-date属性から日付を取得（YYYY-MM-DD形式）
    const dateStr = cell.getAttribute("data-date");
    if (dateStr) {
      const date = new Date(dateStr);
      const day = date.getDay();

      // 日曜日と土曜日に色を適用
      if (day === 0) {
        cell.classList.add("sunday-cell");
      } else if (day === 6) {
        cell.classList.add("saturday-cell");
      }
    }
  });

  // 曜日ヘッダーにも色を適用
  const headerCells = document.querySelectorAll(".fc-col-header-cell");
  headerCells.forEach((cell) => {
    const dayIndex = [...cell.parentElement.children].indexOf(cell);
    // 0が日曜日、6が土曜日として処理（カレンダーの表示設定によって異なる場合あり）
    if (dayIndex === 0 || cell.classList.contains("fc-day-sun")) {
      cell.classList.add("sunday-header");
    } else if (dayIndex === 6 || cell.classList.contains("fc-day-sat")) {
      cell.classList.add("saturday-header");
    }
  });
}

// ページ読み込み時の初期化
document.addEventListener("DOMContentLoaded", function () {
  initializeCalendar();
  initializeTabs();

  // 初期表示時に色を適用
  setTimeout(applyWeekdayColors, 300);

  // 検索機能の初期化
  const searchInput = document.getElementById("event-search");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      searchEvents(this.value);
    });
  }

  // ウィンドウのリサイズやDOMの変更を監視して色を再適用
  window.addEventListener("resize", function () {
    setTimeout(applyWeekdayColors, 200);
  });

  // MutationObserverを使ってDOM変更時に色を適用
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (
        mutation.type === "childList" &&
        (mutation.target.classList.contains("fc-daygrid-body") ||
          mutation.target.classList.contains("fc-scrollgrid"))
      ) {
        applyWeekdayColors();
      }
    });
  });

  // カレンダーコンテナを監視
  const calendarEl = document.getElementById("calendar");
  if (calendarEl) {
    observer.observe(calendarEl, {
      childList: true,
      subtree: true,
    });
  }

  // リフレッシュボタンがあれば機能を追加
  const refreshBtn = document.getElementById("refresh-calendar");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", refreshCalendar);
  }
});

// ウィンドウのリサイズ時にカレンダーを再描画
window.addEventListener("resize", function () {
  if (window.weddingCalendar) {
    window.weddingCalendar.updateSize();
  }
});

// ローカルストレージの変更を監視してカレンダーを自動更新
window.addEventListener("storage", function (e) {
  // forms.jsで予定が追加・更新された場合の自動リフレッシュ
  const watchedKeys = [
    // "weddingEvents", // forms.jsもcalendarEventsに保存するようになったため不要に
    "appointments",
    "schedules",
    "tasks",
    "meetings",
    "reminders",
    "calendarEvents",
  ];

  if (watchedKeys.includes(e.key)) {
    console.log(`ローカルストレージ更新を検出: ${e.key}`);
    setTimeout(refreshCalendar, 500); // 少し遅延を入れて確実に更新
  }
});

// サービスワーカーの登録（PWA対応）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").then(
      function (registration) {
        console.log(
          "ServiceWorker registration successful with scope: ",
          registration.scope
        );
      },
      function (err) {
        console.log("ServiceWorker registration failed: ", err);
      }
    );
  });
}

// 六曜表示のための機能（v5対応版）
function initializeRokuyoDisplay() {
  // 六曜データを取得する関数
  function getRokuyoForDate(date) {
    // 日本の旧暦に基づく六曜の計算
    // このロジックは簡略化されています。実際の六曜計算はより複雑です
    const rokuyoTypes = ["大安", "赤口", "先勝", "友引", "先負", "仏滅"];

    // 日付を数値化して六曜のインデックスを求める簡易アルゴリズム
    // 本来は旧暦に基づく計算が必要ですが、ここではデモ用の簡易計算
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // 簡易計算（実際の六曜計算はより複雑な旧暦変換が必要）
    const rokuyoIndex = (year + month + day) % 6;
    return rokuyoTypes[rokuyoIndex];
  }

  // 六曜情報をカレンダーに追加する関数
  function updateCalendarWithRokuyo() {
    // カレンダーが初期化されているかチェック
    if (!window.weddingCalendar) return;

    // 少し遅延を入れてDOM更新を待つ
    setTimeout(() => {
      // v5のDOM構造に対応した日付セルの取得
      const dateElements = document.querySelectorAll(".fc-daygrid-day");

      dateElements.forEach((dateEl) => {
        const dateAttr = dateEl.getAttribute("data-date");
        if (dateAttr) {
          const date = new Date(dateAttr + "T00:00:00"); // タイムゾーン問題を避けるため
          const rokuyo = getRokuyoForDate(date);

          // 既存の六曜表示があれば削除
          const existingRokuyo = dateEl.querySelector(".rokuyo-label");
          if (existingRokuyo) {
            existingRokuyo.remove();
          }

          // 六曜表示を追加
          const rokuyoEl = document.createElement("div");
          rokuyoEl.className = "rokuyo-label";
          rokuyoEl.textContent = rokuyo;

          // 六曜の種類によってクラス名を変更（CSSでスタイリングするため）
          rokuyoEl.classList.add(`rokuyo-${rokuyo}`);

          // v5の構造に合わせて挿入場所を探す
          let targetEl = dateEl.querySelector(".fc-daygrid-day-top");
          if (!targetEl) {
            // fc-daygrid-day-topが見つからない場合の代替
            targetEl = dateEl.querySelector(".fc-daygrid-day-number");
            if (targetEl) {
              targetEl = targetEl.parentElement;
            }
          }

          if (!targetEl) {
            // どちらも見つからない場合は直接dateElに追加
            targetEl = dateEl;
          }

          if (targetEl) {
            targetEl.appendChild(rokuyoEl);
          }
        }
      });
    }, 100);
  }

  // カレンダーが初期化された後に六曜表示を開始
  const checkCalendar = setInterval(() => {
    if (window.weddingCalendar) {
      clearInterval(checkCalendar);

      // 初期表示
      updateCalendarWithRokuyo();

      // カレンダーのイベントリスナーに六曜更新を追加
      window.weddingCalendar.on("datesSet", updateCalendarWithRokuyo);
      window.weddingCalendar.on("viewDidMount", updateCalendarWithRokuyo);
    }
  }, 100);

  // グローバル関数として公開（他の場所から呼び出せるように）
  window.updateRokuyo = updateCalendarWithRokuyo;
}

// DOMContentLoaded時に六曜表示を初期化
document.addEventListener("DOMContentLoaded", function () {
  initializeRokuyoDisplay();
});
