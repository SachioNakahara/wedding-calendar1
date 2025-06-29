/**
 * アプリケーション全体の初期化とイベントハンドリングを行うスクリプト
 */
document.addEventListener("DOMContentLoaded", function () {
  // --- UI要素の取得 ---
  const scheduleMenuItem = document.getElementById("schedule-menu-item");
  const integrationMenuItem = document.getElementById("integration-menu-item");
  const scheduleSection = document.getElementById("schedule");
  const integrationSection = document.getElementById("integration");

  // --- エラーハンドリング: 必須要素のチェック ---
  if (
    !scheduleMenuItem ||
    !integrationMenuItem ||
    !scheduleSection ||
    !integrationSection
  ) {
    console.error(
      "タブ切り替えに必要なUI要素（メニューまたはセクション）が見つかりません。" +
        "HTMLのIDが正しいか確認してください。"
    );
    // 連携機能の初期化は続行するため、ここでは return しない
  }

  // --- サイドバーのタブ切り替え処理 ---
  function switchTab(activeMenuItem, activeSection) {
    // 全てのメニューから 'active' クラスを削除
    document
      .querySelectorAll(".sidebar-menu li")
      .forEach((item) => item.classList.remove("active"));
    // 全てのセクションから 'active' クラスを削除
    document
      .querySelectorAll(".content-section")
      .forEach((section) => section.classList.remove("active"));

    // 対象のメニューとセクションに 'active' クラスを追加
    activeMenuItem.classList.add("active");
    activeSection.classList.add("active");
  }

  if (
    scheduleMenuItem &&
    integrationMenuItem &&
    scheduleSection &&
    integrationSection
  ) {
    scheduleMenuItem.addEventListener("click", () =>
      switchTab(scheduleMenuItem, scheduleSection)
    );
    integrationMenuItem.addEventListener("click", () =>
      switchTab(integrationMenuItem, integrationSection)
    );
  }

  // --- Google Calendar連携機能の初期化 ---

  // エラーハンドリング: 連携クラスの存在チェック
  if (typeof GoogleCalendarIntegration === "undefined") {
    console.error(
      "GoogleCalendarIntegration クラスが定義されていません。Google連携機能は初期化されません。"
    );
    return; // 連携機能がないと続行できないため、ここで処理を中断
  }

  // 1. GoogleCalendarIntegrationのインスタンスを生成
  // この時点ではまだカレンダー(window.weddingCalendar)は存在しない可能性がある
  window.googleCalendarIntegration = new GoogleCalendarIntegration();

  // 2. カレンダーの準備完了を待つ
  // main.js の initializeCalendar() が完了すると 'calendarReady' イベントが発行される
  document.addEventListener(
    "calendarReady",
    function () {
      console.log(
        "'calendarReady' イベントを検知。Google Calendar連携を初期化します。"
      );
      // カレンダーの準備ができたので、連携機能の初期化を実行
      window.googleCalendarIntegration
        .init()
        .then(() => {
          console.log("Google Calendar連携の準備が正常に完了しました。");
        })
        .catch((error) => {
          console.error("Google Calendar連携の初期化中にエラーが発生:", error);
        });
    },
    { once: true } // イベントは一度だけ実行されれば良い
  );
});
