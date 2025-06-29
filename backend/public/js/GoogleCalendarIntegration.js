/**
 * Google Calendar連携クラス（クライアントサイド）
 * ウエディングカレンダーとGoogle Calendarの同期を管理
 */
class GoogleCalendarIntegration {
  constructor(options = {}) {
    this.calendarInstance = options.calendarInstance;

    // ★ APIのベースURLを相対パスに統一
    // firebase.jsonのrewrites設定により、ローカルでも本番でも自動的に正しいCloud Functionに転送される
    this.apiBaseUrl = "/api";
    console.log(`API Base URL is set to: ${this.apiBaseUrl}`);

    this.authenticated = false;
    this.userInfo = null;
    this.autoSyncInterval = null;
    this.isInitialized = false;
    this.syncInProgress = false;

    // UI要素の参照を保存
    this.elements = {
      authStatus: document.getElementById("google-auth-status"),
      userInfo: document.getElementById("google-user-info"),
      authorizeButton: document.getElementById("google-authorize-button"),
      signoutButton: document.getElementById("google-signout-button"),
      syncButton: document.getElementById("google-sync-button"),
      syncProgress: document.getElementById("sync-progress"),
      syncStatus: document.getElementById("sync-status"),
      autoSyncToggle: document.getElementById("auto-sync-toggle"),
      autoSyncInterval: document.getElementById("auto-sync-interval"),
      realTimeSyncToggle: document.getElementById("realtime-sync-toggle"),
    };

    this.bindEvents();
    this.setupRealTimeSync();
  }

  /**
   * 初期化処理
   */
  async init() {
    try {
      // カレンダーインスタンスの自動取得
      if (!this.calendarInstance && window.weddingCalendar) {
        this.calendarInstance = window.weddingCalendar;
      }

      await this.checkAuthStatus();
      this.updateUI();
      this.loadSyncSettings();
      this.isInitialized = true;
      console.log("Google Calendar連携が初期化されました");
    } catch (error) {
      console.error("Google Calendar連携の初期化に失敗:", error);
      this.showError("連携の初期化に失敗しました");
    }
  }

  /**
   * イベントハンドラーのバインド
   */
  bindEvents() {
    if (this.elements.authorizeButton) {
      this.elements.authorizeButton.addEventListener("click", () =>
        this.authorize()
      );
    }

    if (this.elements.signoutButton) {
      this.elements.signoutButton.addEventListener("click", () =>
        this.signOut()
      );
    }

    if (this.elements.syncButton) {
      this.elements.syncButton.addEventListener("click", () =>
        this.performSync()
      );
    }

    if (this.elements.autoSyncToggle) {
      this.elements.autoSyncToggle.addEventListener("change", (e) => {
        if (e.target.checked) {
          const interval = parseInt(
            this.elements.autoSyncInterval?.value || "60"
          );
          this.setupAutoSync(interval);
        } else {
          this.stopAutoSync();
        }
      });
    }

    if (this.elements.autoSyncInterval) {
      this.elements.autoSyncInterval.addEventListener("change", (e) => {
        if (this.elements.autoSyncToggle?.checked) {
          const interval = parseInt(e.target.value);
          this.setupAutoSync(interval);
        }
      });
    }

    if (this.elements.realTimeSyncToggle) {
      this.elements.realTimeSyncToggle.addEventListener("change", (e) => {
        if (e.target.checked) {
          this.enableRealTimeSync();
        } else {
          this.disableRealTimeSync();
        }
      });
    }

    // URLパラメータから認証結果をチェック
    // this.checkAuthCallback();
  }

  /**
   * リアルタイム同期の設定
   */
  setupRealTimeSync() {
    // FullCalendarのイベント変更を監視
    this.realTimeSyncEnabled = false;
    this.pendingSyncEvents = new Set();
    this.syncDebounceTimer = null;
  }

  /**
   * リアルタイム同期の有効化
   */
  enableRealTimeSync() {
    if (!this.authenticated) {
      this.showError("リアルタイム同期にはGoogle認証が必要です");
      if (this.elements.realTimeSyncToggle) {
        this.elements.realTimeSyncToggle.checked = false;
      }
      return;
    }

    this.realTimeSyncEnabled = true;

    // FullCalendarのイベントリスナーを設定
    if (this.calendarInstance) {
      // イベント追加時
      this.calendarInstance.on("eventAdd", (info) => {
        this.handleEventChange("add", info.event);
      });

      // イベント更新時
      this.calendarInstance.on("eventChange", (info) => {
        this.handleEventChange("update", info.event);
      });

      // イベント削除時
      this.calendarInstance.on("eventRemove", (info) => {
        this.handleEventChange("remove", info.event);
      });
    }

    // ローカルストレージの変更も監視
    this.storageListener = (e) => {
      if (this.isCalendarRelatedKey(e.key)) {
        this.debouncedSync();
      }
    };
    window.addEventListener("storage", this.storageListener);

    this.showSuccess("リアルタイム同期を有効にしました");
  }

  /**
   * リアルタイム同期の無効化
   */
  disableRealTimeSync() {
    this.realTimeSyncEnabled = false;

    if (this.storageListener) {
      window.removeEventListener("storage", this.storageListener);
      this.storageListener = null;
    }

    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }

    this.showSuccess("リアルタイム同期を無効にしました");
  }

  /**
   * イベント変更のハンドリング
   */
  handleEventChange(action, event) {
    if (!this.realTimeSyncEnabled || this.syncInProgress) {
      return;
    }

    console.log(`イベント${action}を検出:`, event.title);

    // 変更されたイベントを記録
    this.pendingSyncEvents.add({
      action,
      event: this.convertEventForGoogle(event),
      timestamp: Date.now(),
    });

    // デバウンス処理で同期実行
    this.debouncedSync();
  }

  /**
   * デバウンス処理付きの同期
   */
  debouncedSync() {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    this.syncDebounceTimer = setTimeout(() => {
      this.performRealTimeSync();
    }, 2000); // 2秒の遅延
  }

  /**
   * リアルタイム同期の実行
   */
  async performRealTimeSync() {
    if (
      !this.authenticated ||
      this.syncInProgress ||
      this.pendingSyncEvents.size === 0
    ) {
      return;
    }

    try {
      this.syncInProgress = true;
      const events = Array.from(this.pendingSyncEvents);
      this.pendingSyncEvents.clear();

      console.log(`リアルタイム同期実行: ${events.length}件のイベント`);

      const response = await fetch(`${this.apiBaseUrl}/api/realtime-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          events: events,
          calendarId: "primary",
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("リアルタイム同期完了:", result);
        this.updateLocalEventsWithSyncResult(result.results);
      } else {
        throw new Error(`リアルタイム同期失敗: ${response.status}`);
      }
    } catch (error) {
      console.error("リアルタイム同期エラー:", error);
      this.showError("リアルタイム同期でエラーが発生しました");
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * カレンダー関連のキーかチェック
   */
  isCalendarRelatedKey(key) {
    const calendarKeys = [
      "weddingEvents",
      "appointments",
      "schedules",
      "tasks",
      "meetings",
      "reminders",
      "events",
      "calendarEvents",
    ];
    return calendarKeys.includes(key);
  }

  /**
   * 認証状態の確認
   */
  async checkAuthStatus() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/status`, {
        // 修正: /api/auth/status を呼び出す
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.authenticated = data.authenticated;
      this.userInfo = data.user;

      return data;
    } catch (error) {
      console.error("認証状態確認エラー:", error);
      this.authenticated = false;
      this.userInfo = null;
      throw error;
    }
  }

  /**
   * Google認証を開始
   */
  async authorize() {
    try {
      // サーバーとのセッションを維持するためにCookieを送信する
      // ★修正: 現在のクライアントのオリジンをサーバーに渡す
      const response = await fetch(
        `${this.apiBaseUrl}/auth/google?origin=${window.location.origin}`, // 修正: /api/auth/google を呼び出す
        {
          credentials: "include",
        }
      );

      // レスポンスが正常でない場合、エラーとして処理する
      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => "サーバーからのエラー詳細を取得できませんでした。");
        throw new Error(
          `認証URLの取得に失敗しました。ステータス: ${response.status}, 詳細: ${errorText}`
        );
      }

      const data = await response.json(); // レスポンスがJSON形式であることを期待

      if (!data.authUrl) {
        throw new Error(
          "サーバーから認証URLが提供されませんでした。サーバー側の設定を確認してください。"
        );
      }

      if (data.authUrl) {
        // 新しいウィンドウでGoogle認証を開く
        const authWindow = window.open(
          data.authUrl,
          "google-auth",
          "width=500,height=600,scrollbars=yes,resizable=yes,status=yes"
        );
        // APIのオリジンを取得
        const apiOrigin = new URL(this.apiBaseUrl).origin;

        // postMessage をリッスンしてポップアップからの通知を待つ
        const handleAuthMessage = (event) => {
          // オリジンを検証してセキュリティを確保
          if (event.origin !== apiOrigin) {
            // メッセージの送信元はCloud Functionsのオリジン
            return;
          }

          if (event.data === "auth_succeeded") {
            // サーバーから送られるメッセージ名に合わせる
            console.log("認証成功の通知をポップアップから受信しました。");
            // 認証後の状態を更新
            this.checkAuthStatus().then(() => {
              this.updateUI();
              if (this.authenticated) {
                this.showSuccess("Google アカウントとの連携が完了しました");
              }
            });
            // リスナーを削除
            window.removeEventListener("message", handleAuthMessage);
          } else if (event.data === "auth_failed") {
            // 認証失敗時のメッセージも処理
            console.error("認証失敗の通知をポップアップから受信しました。");
            this.showError("Googleアカウントとの連携に失敗しました。");
            // リスナーを削除
            window.removeEventListener("message", handleAuthMessage);
          }
        };
        window.addEventListener("message", handleAuthMessage, false);
      }
    } catch (error) {
      console.error("認証開始エラー:", error);
      this.showError(`認証の開始に失敗しました: ${error.message}`);
    }
  }

  /**
   * サインアウト処理
   */
  async signOut() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/logout`, {
        // 修正: /api/auth/logout を呼び出す
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        this.authenticated = false;
        this.userInfo = null;
        this.updateUI();
        this.showSuccess("連携を解除しました");

        // 自動同期とリアルタイム同期を停止
        this.stopAutoSync();
        this.disableRealTimeSync();
      }
    } catch (error) {
      console.error("サインアウトエラー:", error);
      this.showError("連携解除に失敗しました");
    }
  }

  /**
   * 同期処理の実行
   */
  async performSync() {
    if (!this.authenticated) {
      this.showError("Google アカウントとの連携が必要です");
      return;
    }

    if (this.syncInProgress) {
      this.showWarning("同期処理が実行中です");
      return;
    }

    try {
      this.syncInProgress = true;
      this.updateSyncProgress(0, "同期を開始しています...");

      // 同期方向の取得
      const syncDirection = "both";

      // ウエディングカレンダーのイベントを取得
      const weddingEvents = this.getWeddingCalendarEvents();

      this.updateSyncProgress(30, "Google Calendar と通信中...");

      const response = await fetch(`${this.apiBaseUrl}/sync`, {
        // 修正: /api/sync を呼び出す
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          direction: syncDirection,
          events: weddingEvents,
          calendarId: "primary",
          syncOptions: {
            preserveColors: true,
            syncDescription: true,
            syncLocation: true,
            syncReminders: true,
          },
        }),
      });

      this.updateSyncProgress(70, "同期結果を処理中...");

      if (!response.ok) {
        throw new Error(`同期リクエストが失敗しました: ${response.status}`);
      }

      const result = await response.json();

      // インポートされたイベントがある場合、カレンダーに追加
      if (result.importedEvents && result.importedEvents.length > 0) {
        this.addImportedEventsToCalendar(result.importedEvents);
      }

      this.updateSyncProgress(100, "同期が完了しました");

      // 結果の表示
      // 結果の表示 (双方向同期専用のメッセージ)
      // バックエンドから返される件数を使用
      const importedCount = result.importedCount || 0;
      const exportedCount = result.exportedCount || 0;

      const message = `双方向同期完了: ${importedCount}件インポート, ${exportedCount}件エクスポート。`;

      if (result.errors > 0) {
        console.warn("同期エラーの詳細:", result.details);
        this.showWarning(`${message} (${result.errors}件のエラーあり)`);
      } else {
        this.showSuccess(message);
      }

      // カレンダーを更新
      if (this.calendarInstance) {
        this.calendarInstance.refetchEvents();
      }

      // ローカルストレージも更新
      if (window.saveEvents) {
        window.saveEvents();
      }
    } catch (error) {
      console.error("同期エラー:", error);
      this.showError("同期に失敗しました: " + error.message);
      this.updateSyncProgress(0, "同期に失敗しました");
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * ウエディングカレンダーのイベントを取得
   */
  getWeddingCalendarEvents() {
    const events = [];

    // FullCalendarからイベントを取得
    if (this.calendarInstance) {
      try {
        const calendarEvents = this.calendarInstance.getEvents();
        console.log(
          "[SYNC EXPORT] Raw events from FullCalendar instance:",
          JSON.stringify(
            calendarEvents.map((e) => ({
              id: e.id,
              title: e.title,
              start: e.startStr,
              source: e.extendedProps?.source,
              googleEventId: e.extendedProps?.googleEventId,
            })),
            null,
            2
          )
        );

        calendarEvents.forEach((event) => {
          console.log(
            "[SYNC EXPORT] Raw FullCalendar event object from getEvents():",
            JSON.stringify(
              event.toPlainObject ? event.toPlainObject() : event,
              null,
              2
            ) // FullCalendarのEventApiならtoPlainObject()が使える
          );
          console.log(
            "[SYNC EXPORT] Processing FullCalendar event for export (before convert):",
            JSON.stringify(
              {
                fc_id: event.id,
                fc_title: event.title,
                fc_start: event.startStr,
                fc_extendedProps: event.extendedProps,
              },
              null,
              2
            )
          );

          // Google Calendarからインポートされたイベントはエクスポート対象外とする
          if (event.extendedProps?.source !== "google-calendar") {
            console.log(
              "[SYNC EXPORT] Adding event from FullCalendar to export list:",
              {
                id: event.id,
                title: event.title,
                source: event.extendedProps?.source,
              }
            );
            const convertedEvent = this.convertEventForGoogle(event);
            console.log(
              "[SYNC EXPORT] Converted FullCalendar event for export (after convert):",
              JSON.stringify(
                {
                  id: convertedEvent.id,
                  title: convertedEvent.title,
                  start: convertedEvent.start,
                  source: convertedEvent.source,
                },
                null,
                2
              )
            );
            events.push(convertedEvent);
          }
        });
      } catch (error) {
        console.error("FullCalendarイベント取得エラー:", error);
      }
    }

    // ローカルストレージからもイベントを取得
    const storageKeys = [
      // "weddingEvents",
      // "appointments",
      // "schedules",
      // "tasks",
      // "meetings",
      // "reminders",
      // "events",
      "calendarEvents",
    ];

    // FullCalendarインスタンスから取得し、既にevents配列に追加されたイベントのIDを収集
    const processedFullCalendarEventIds = new Set(
      events
        .map((e) => e.id)
        .filter(
          (id) =>
            id && String(id).trim() !== "" && !String(id).includes("_fallback_")
        )
    );

    storageKeys.forEach((key) => {
      try {
        const storedData = localStorage.getItem(key);
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          const storageEvents = Array.isArray(parsedData)
            ? parsedData
            : [parsedData];

          storageEvents.forEach((event) => {
            // ローカルストレージのイベントの永続IDを取得試行
            // main.jsのconvertToCalendarEventやsaveEventsでのID生成ロジックに依存
            const storageEventPersistentId =
              event.extendedProps?.id || event.id;

            // 既にFullCalendarインスタンス由来で同じIDのイベントが処理済みならスキップ
            if (
              storageEventPersistentId &&
              processedFullCalendarEventIds.has(storageEventPersistentId)
            ) {
              console.log(
                `[SYNC EXPORT] Skipping localStorage event (ID: ${storageEventPersistentId}, Title: ${event.title}) as it was already processed from FullCalendar instance.`
              );
              return; // このローカルストレージイベントはスキップ
            }
            console.log(
              "[SYNC EXPORT] Raw event from localStorage:",
              JSON.stringify(
                {
                  id: event.id,
                  title: event.title,
                  start: event.start,
                  sourceKey: event.extendedProps?.sourceKey,
                  googleEventId: event.extendedProps?.googleEventId,
                  key: key, // sourceKey ではなく、外側のループ変数 key を使用
                },
                null,
                2
              )
            );

            if (event && event.title) {
              console.log(
                "[SYNC EXPORT] Processing localStorage event for export (before convert):",
                JSON.stringify(
                  {
                    ls_id: event.id,
                    ls_title: event.title,
                    ls_start: event.start,
                    ls_extendedProps: event.extendedProps,
                    ls_source: event.source,
                    ls_key: key,
                  },
                  null,
                  2
                )
              );

              // ローカルストレージのイベントも、Google Calendar由来のものはエクスポート対象外
              if (
                event.extendedProps?.source !== "google-calendar" &&
                event.source !== "google-calendar"
              ) {
                console.log(
                  "[SYNC EXPORT] Adding event from localStorage to export list:",
                  {
                    id: event.id,
                    title: event.title,
                    source: event.extendedProps?.source || event.source,
                  }
                );
                const convertedEvent = this.convertStorageEventForGoogle(
                  event,
                  key
                );
                console.log(
                  "[SYNC EXPORT] Converted localStorage event for export (after convert):",
                  JSON.stringify(
                    {
                      id: convertedEvent.id,
                      title: convertedEvent.title,
                      start: convertedEvent.start,
                      source: convertedEvent.source,
                    },
                    null,
                    2
                  )
                );

                // convertedEvent.id が適切であることを確認
                if (
                  convertedEvent.id &&
                  String(convertedEvent.id).trim() !== "" &&
                  !String(convertedEvent.id).includes("_fallback_")
                ) {
                  events.push(convertedEvent);
                } else {
                  console.warn(
                    `[SYNC EXPORT] localStorage event (Title: ${event.title}) was converted but resulted in an invalid/fallback ID (${convertedEvent.id}). Skipping from export list.`
                  );
                }
              }
            }
          });
        }
      } catch (error) {
        console.warn(`${key}からのイベント取得エラー:`, error);
      }
    });

    // 重複を除去（IDを優先し、なければタイトルと開始時間で判定）
    const uniqueEvents = [];
    const seenIds = new Set();
    // const seenTitleAndStart = new Set(); // IDベースの重複排除を強化するため、一旦コメントアウト

    events.forEach((event) => {
      // event.id は convertEventForGoogle や convertStorageEventForGoogle で設定される想定
      console.log(
        "[SYNC EXPORT] Checking event for uniqueness (before unique filter):",
        JSON.stringify(
          {
            id: event.id,
            title: event.title,
            start: event.start,
            source: event.source,
          },
          null,
          2
        )
      );

      // IDが確実に存在し、かつ "_fallback_" を含まないものを優先
      if (
        event.id &&
        String(event.id).trim() !== "" &&
        !String(event.id).includes("_fallback_")
      ) {
        if (!seenIds.has(event.id)) {
          seenIds.add(event.id);
          uniqueEvents.push(event);
          console.log(
            `[SYNC EXPORT] Event with ID ${event.id} (Title: ${event.title}) added to uniqueEvents.`
          );
        }
      } else {
        // IDがない、またはフォールバックIDの場合は警告を出す
        // このイベントは最終フィルタリングで除外される可能性が高い
        console.warn(
          `[SYNC EXPORT] Event with problematic ID (ID: ${event.id}, Title: ${event.title}, Start: ${event.start}) found before final unique filter. This event will likely be excluded by the FINAL FILTER.`
        );
        // IDベースの重複排除を優先するため、IDがない場合のタイトル・開始時刻ベースの重複排除は
        // finalUniqueEvents の後で検討するか、現状のFINAL FILTERで除外されることを許容する。
        // uniqueEvents.push(event); // ここでは追加せず、finalUniqueEventsのフィルタに任せるか、別途処理
      }
    });
    // 最終フィルタリング: IDが実質的にないイベントはエクスポートしない
    const finalUniqueEvents = uniqueEvents.filter((event) => {
      const hasProperId =
        event.id &&
        String(event.id).trim() !== "" &&
        !String(event.id).includes("_fallback_");
      if (!hasProperId) {
        console.warn(
          `[SYNC EXPORT] FINAL FILTER: Event without proper ID excluded from export: ${event.title} at ${event.start}, Current ID: ${event.id}`
        );
      }
      return hasProperId;
    });

    // uniqueEvents を finalUniqueEvents に置き換える
    // console.log(`取得したイベント数: ${uniqueEvents.length}`); // 元のログ
    console.log(`取得したイベント数: ${uniqueEvents.length}`);
    console.log(
      "[SYNC EXPORT] Events to be sent to server from getWeddingCalendarEvents:",
      JSON.stringify(
        uniqueEvents.map((e) => ({
          id: e.id,
          title: e.title,
          start: e.start,
          source: e.extendedProps?.sourceKey || e.source,
        })), // sourceも確認
        null,
        2
      )
    );
    return finalUniqueEvents; // フィルタリング後のリストを返す
  }

  /**
   * FullCalendarイベントをGoogle Calendar形式に変換
   */
  convertEventForGoogle(event) {
    console.log(
      "[convertEventForGoogle] Input event details for ID generation:",
      JSON.stringify(
        {
          eventId: event.id, // FullCalendarネイティブのID
          extendedPropsId: event.extendedProps?.id, // アプリケーションが付与したIDのはず
          extendedProps: event.extendedProps, // extendedProps全体
        },
        null,
        2
      )
    );
    return {
      id: event.extendedProps?.id || event.id, // extendedProps.id を優先
      title: event.title || "無題のイベント",
      description: this.createEventDescription(event),
      start: event.start?.toISOString() || event.startStr,
      end: event.end?.toISOString() || event.endStr,
      allDay: event.allDay || false,
      colorId: this.convertColorToGoogleCalendar(event.backgroundColor),
      location: event.extendedProps?.location || "",
      extendedProps: event.extendedProps, // ★ バックエンドでの更新・削除に必要な googleEventId を含める

      source: "wedding-calendar",
      originalEvent: {
        backgroundColor: event.backgroundColor,
        borderColor: event.borderColor,
        textColor: event.textColor,
        category: event.extendedProps?.category,
        tags: event.extendedProps?.tags,
        status: event.extendedProps?.status,
      },
    };
  }

  /**
   * ストレージイベントをGoogle Calendar形式に変換
   */
  convertStorageEventForGoogle(event, sourceKey) {
    const start = new Date(event.start || event.startDate || event.date);
    const end = event.end
      ? new Date(event.end)
      : new Date(start.getTime() + 60 * 60 * 1000);

    // ローカルストレージから読み込んだイベントのIDを特定する。
    // main.jsやforms.jsのsaveEventsで extendedProps.id にIDが保存されていることを期待。
    let persistentId = event.extendedProps?.id || event.id;

    if (!persistentId) {
      // この状況は避けるべき。ローカルストレージ保存時にIDが欠落しているか、
      // IDのプロパティ名が想定と異なる場合に発生しうる。
      console.error(
        // 警告レベルを上げ、より問題であることを示す
        `ローカルストレージのイベントに永続的なIDが見つかりません。タイトル: "${
          event.title
        }", 開始: ${start.toISOString()}, ソースキー: ${sourceKey}. ` +
          `このようなIDのないイベントは重複の主な原因となります。ローカルストレージのデータクレンジング（各イベントへの永続的なID付与）を強く推奨します。` +
          `一時的なフォールバックIDを生成しますが、この処理は非推奨です。`
      );
      persistentId = `${sourceKey}_fallback_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
    }

    return {
      id: persistentId,
      title: event.title || event.name || "無題のイベント",
      description: this.createStorageEventDescription(event, sourceKey),
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: event.allDay || false,
      colorId: this.convertColorToGoogleCalendar(
        event.color || event.backgroundColor
      ),
      location: event.location || event.place || "",
      source: sourceKey,
      originalEvent: event,
    };
  }

  /**
   * イベント詳細説明の作成
   */
  createEventDescription(event) {
    const parts = [];

    if (event.extendedProps?.description) {
      parts.push(event.extendedProps.description);
    }

    if (event.extendedProps?.category) {
      parts.push(`カテゴリ: ${event.extendedProps.category}`);
    }

    if (event.extendedProps?.tags) {
      parts.push(`タグ: ${event.extendedProps.tags}`);
    }

    if (event.extendedProps?.status) {
      parts.push(`ステータス: ${event.extendedProps.status}`);
    }

    parts.push(`作成元: ウエディングカレンダー`);

    return parts.join("\n");
  }

  /**
   * ストレージイベントの詳細説明の作成
   */
  createStorageEventDescription(event, sourceKey) {
    const parts = [];

    if (event.description || event.memo || event.note) {
      parts.push(event.description || event.memo || event.note);
    }

    if (event.category) {
      parts.push(`カテゴリ: ${event.category}`);
    }

    const sourceNames = {
      weddingEvents: "結婚式イベント",
      appointments: "予約・約束",
      schedules: "スケジュール",
      tasks: "タスク",
      meetings: "会議",
      reminders: "リマインダー",
      events: "イベント",
      calendarEvents: "カレンダーイベント",
    };

    parts.push(`作成元: ${sourceNames[sourceKey] || sourceKey}`);

    return parts.join("\n");
  }

  /**
   * 色をGoogle Calendar形式に変換
   */
  convertColorToGoogleCalendar(backgroundColor) {
    if (!backgroundColor) return "1"; // デフォルト色

    const colorMap = {
      "#ff69b4": "4", // ピンク
      "#32cd32": "2", // 緑
      "#4169e1": "9", // 青
      "#ff6347": "11", // 赤
      "#9370db": "3", // 紫
      "#ffa500": "6", // オレンジ
      "#3788d8": "1", // デフォルト青
      "#20b2aa": "7", // 青緑
      "#ff0000": "11", // 赤
      "#0000ff": "9", // 青
    };

    return colorMap[backgroundColor.toLowerCase()] || "1";
  }

  /**
   * リアルタイム同期の結果をローカルのイベントに反映させる
   * @param {Array} syncResults - バックエンドからの同期結果の配列
   */
  updateLocalEventsWithSyncResult(syncResults) {
    if (!this.calendarInstance || !Array.isArray(syncResults)) {
      return;
    }

    let updated = false;
    syncResults.forEach((result) => {
      if (result.status !== "success" || !result.localId) {
        return; // 失敗したか、ローカルIDがないものはスキップ
      }

      const event = this.calendarInstance.getEventById(result.localId);
      if (!event) {
        // removeアクションの場合はイベントが存在しないのが正常
        if (result.action === "remove") {
          console.log(
            `イベント削除をGoogle Calendarに反映しました (Local ID: ${result.localId})`
          );
        } else {
          console.warn(
            `同期結果に対応するローカルイベントが見つかりません: ${result.localId}`
          );
        }
        return;
      }

      // 'add' アクションの場合、新しく発行されたGoogle Event IDを保存する
      if (result.action === "add" && result.googleEventId) {
        console.log(
          `新規イベントにGoogle Event IDをセット: ${event.title} -> ${result.googleEventId}`
        );
        event.setExtendedProp("googleEventId", result.googleEventId);
        updated = true;
      }
    });

    // 変更があった場合は、ローカルストレージに保存する
    if (updated && typeof window.saveEvents === "function") {
      console.log("Google Event IDの更新をローカルストレージに保存します。");
      window.saveEvents();
    }
  }

  /**
   * インポートしたイベントをカレンダーに追加
   */
  addImportedEventsToCalendar(events) {
    if (!this.calendarInstance) {
      return;
    }

    let addedCount = 0;
    events.forEach((event) => {
      try {
        // event.id はサーバーで convertFromGoogleEvent で設定された "google_..." 形式のID
        const eventIdFromGoogle = event.id;

        // 既にカレンダーに同じIDのイベントが存在するか確認
        if (this.calendarInstance.getEventById(eventIdFromGoogle)) {
          console.log(
            `インポートスキップ: イベント (ID: ${eventIdFromGoogle}, Title: ${event.title}) は既にカレンダーに存在します。`
          );
          return; // 次のイベントへ
        } else {
          // 同じIDのイベントは存在しないが、内容が同じローカルイベントが存在する可能性をチェック
          // (ユーザーが手動作成 → GCalにエクスポート → GCalからインポート、という流れで発生しうる)
          const localEventsWithSameContent = this.calendarInstance
            .getEvents()
            .filter(
              (localEvent) =>
                localEvent.title === event.title &&
                new Date(localEvent.startStr).getTime() ===
                  new Date(event.start).getTime() &&
                (!localEvent.endStr ||
                  !event.end ||
                  new Date(localEvent.endStr).getTime() ===
                    new Date(event.end).getTime()) && // endがない場合も考慮
                localEvent.allDay === event.allDay &&
                localEvent.extendedProps?.source !== "google-calendar" // ローカルで作成されたものに限定
            );

          if (localEventsWithSameContent.length > 0) {
            console.log(
              `[SYNC IMPORT CLIENT] 内容が同じローカルイベントを発見 (Title: ${event.title}, Start: ${event.start}). ローカルイベントを削除し、Google Calendar版で置き換えます。`,
              localEventsWithSameContent.map((e) => e.id)
            );
            localEventsWithSameContent.forEach((ev) => ev.remove()); // 同じ内容のローカルイベントを削除
          }
        }

        // Google Calendarから来たイベントをFullCalendar形式に変換
        // (この時点で、同じ内容のローカルイベントは削除されているはず)
        const fcEvent = {
          id: eventIdFromGoogle, // ★ Google Calendar由来のID
          title: event.title, // サーバーで変換済みの title を使用
          start: event.start, // サーバーで変換済みの start を使用 (既に適切な文字列形式のはず)
          end: event.end, // サーバーで変換済みの end を使用 (既に適切な文字列形式のはず)
          allDay: event.allDay, // サーバーで変換済みの allDay (boolean) を使用
          backgroundColor: event.backgroundColor, // サーバーで変換済みの backgroundColor (HEX文字列) を使用
          borderColor: event.backgroundColor, // 同上

          textColor: event.textColor || "#ffffff", // サーバーからtextColorが来る可能性も考慮
          extendedProps: {
            ...(event.extendedProps || {}), // サーバーからのextendedPropsをマージ
            id: eventIdFromGoogle, // ★ extendedProps.id にもGoogle Calendar由来のIDを設定
            description: event.description || "",
            location: event.location || "",
            category: event.category || "google-import", // サーバーで抽出したカテゴリを使用
            source: "google-calendar",

            googleEventId: eventIdFromGoogle.startsWith("google_")
              ? eventIdFromGoogle.substring(7)
              : eventIdFromGoogle, // 元のGoogle IDも保持
          },
        };

        this.calendarInstance.addEvent(fcEvent);
        addedCount++;
        console.log(
          `インポート成功: イベント (ID: ${fcEvent.id}, Title: ${fcEvent.title}) をカレンダーに追加しました。`
        );
      } catch (error) {
        console.error(
          `イベント (Title: ${event.title}) のカレンダーへの追加中にエラー:`,
          error
        );
      }
    });

    if (addedCount > 0) {
      console.log(`${addedCount}件のイベントをカレンダーに追加しました`);

      // ローカルストレージにも保存
      if (window.saveEvents) {
        window.saveEvents();
      }
    }
  }

  /**
   * Google Calendar色をHEX形式に変換
   */
  convertGoogleColorToHex(colorId) {
    const colorMap = {
      1: "#3788d8", // 青
      2: "#32cd32", // 緑
      3: "#9370db", // 紫
      4: "#ff69b4", // ピンク
      5: "#ffd700", // 黄
      6: "#ffa500", // オレンジ
      7: "#20b2aa", // 青緑
      8: "#808080", // グレー
      9: "#4169e1", // ロイヤルブルー
      10: "#008000", // ダークグリーン
      11: "#ff6347", // 赤
    };

    return colorMap[colorId] || "#3788d8";
  }

  /**
   * 自動同期の設定
   */
  setupAutoSync(intervalMinutes) {
    // 既存の自動同期を停止
    this.stopAutoSync();

    if (!this.authenticated) {
      this.showError("自動同期にはGoogle アカウントとの連携が必要です");
      return;
    }

    if (intervalMinutes < 5) {
      this.showError("自動同期の間隔は5分以上に設定してください");
      return;
    }

    // 自動同期を開始
    const intervalMs = intervalMinutes * 60 * 1000;
    this.autoSyncInterval = setInterval(async () => {
      try {
        console.log("自動同期を実行中...");
        await this.performSync();
      } catch (error) {
        console.error("自動同期エラー:", error);
        this.showError("自動同期中にエラーが発生しました");
      }
    }, intervalMs);

    this.showSuccess(`自動同期を開始しました（${intervalMinutes}分間隔）`);
    console.log(`自動同期が設定されました: ${intervalMinutes}分間隔`);
  }

  /**
   * 自動同期の停止
   */
  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
      console.log("自動同期が停止されました");
    }

    // UIの更新
    if (this.elements.autoSyncToggle) {
      this.elements.autoSyncToggle.checked = false;
    }
  }

  /**
   * UIの更新
   */
  updateUI() {
    // 認証状態の表示
    if (this.elements.authStatus) {
      this.elements.authStatus.textContent = this.authenticated
        ? "連携済み"
        : "未連携";
      this.elements.authStatus.className = this.authenticated
        ? "status-connected"
        : "status-disconnected";
    }

    // ユーザー情報の表示
    if (this.elements.userInfo && this.userInfo) {
      this.elements.userInfo.textContent = `${this.userInfo.name} (${this.userInfo.email})`;
      this.elements.userInfo.style.display = this.authenticated
        ? "block"
        : "none";
    }

    // ボタンの表示/非表示
    if (this.elements.authorizeButton) {
      this.elements.authorizeButton.style.display = this.authenticated
        ? "none"
        : "inline-block";
    }

    if (this.elements.signoutButton) {
      this.elements.signoutButton.style.display = this.authenticated
        ? "inline-block"
        : "none";
    }

    // 同期ボタンの有効/無効
    if (this.elements.syncButton) {
      this.elements.syncButton.disabled =
        !this.authenticated || this.syncInProgress;
      this.elements.syncButton.textContent = this.syncInProgress
        ? "同期中..."
        : "同期実行";
    }

    // 自動同期トグルの有効/無効
    if (this.elements.autoSyncToggle) {
      this.elements.autoSyncToggle.disabled = !this.authenticated;
    }

    // リアルタイム同期トグルの有効/無効
    if (this.elements.realTimeSyncToggle) {
      this.elements.realTimeSyncToggle.disabled = !this.authenticated;
    }
  }

  /**
   * 同期進捗の更新
   */
  updateSyncProgress(percent, message) {
    if (this.elements.syncProgress) {
      this.elements.syncProgress.style.width = `${percent}%`;
      this.elements.syncProgress.setAttribute("aria-valuenow", percent);
    }

    if (this.elements.syncStatus) {
      this.elements.syncStatus.textContent = message;
    }
  }

  /**
   * 成功メッセージの表示
   */
  showSuccess(message) {
    this.showMessage(message, "success");
  }

  /**
   * エラーメッセージの表示
   */
  showError(message) {
    this.showMessage(message, "error");
  }

  /**
   * 警告メッセージの表示
   */
  showWarning(message) {
    this.showMessage(message, "warning");
  }

  /**
   * メッセージの表示
   */
  showMessage(message, type) {
    // コンソールログ
    console.log(`[${type.toUpperCase()}] ${message}`);

    // 既存の通知を削除
    const existingNotification = document.querySelector(
      ".notification-message"
    );
    if (existingNotification) {
      existingNotification.remove();
    }

    // 通知要素を作成
    const notification = document.createElement("div");
    notification.className = `notification-message notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${this.getNotificationIcon(type)}</span>
        <span class="notification-text">${message}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    // 通知のスタイルを設定
    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      minWidth: "300px",
      maxWidth: "500px",
      padding: "12px 16px",
      backgroundColor: this.getNotificationColor(type),
      border: `1px solid ${this.getNotificationBorderColor(type)}`,
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      color: "#fff",
      fontSize: "14px",
      zIndex: "10000",
      animation: "slideInRight 0.3s ease-out",
      fontFamily: "system-ui, -apple-system, sans-serif",
    });

    // body に追加
    document.body.appendChild(notification);

    // 自動削除（エラーは5秒、その他は3秒）
    const autoRemoveTime = type === "error" ? 5000 : 3000;
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = "slideOutRight 0.3s ease-in";
        setTimeout(() => {
          if (notification.parentElement) {
            notification.remove();
          }
        }, 300);
      }
    }, autoRemoveTime);

    // CSS アニメーションを追加（まだ存在しない場合）
    if (!document.querySelector("#notification-styles")) {
      const style = document.createElement("style");
      style.id = "notification-styles";
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        
        .notification-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .notification-icon {
          font-size: 16px;
          font-weight: bold;
        }
        
        .notification-text {
          flex: 1;
          line-height: 1.4;
        }
        
        .notification-close {
          background: none;
          border: none;
          color: #fff;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.8;
          transition: opacity 0.2s;
        }
        
        .notification-close:hover {
          opacity: 1;
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * 通知アイコンの取得
   */
  getNotificationIcon(type) {
    const icons = {
      success: "✓",
      error: "✕",
      warning: "⚠",
      info: "ℹ",
    };
    return icons[type] || "ℹ";
  }

  /**
   * 通知の背景色を取得
   */
  getNotificationColor(type) {
    const colors = {
      success: "#28a745",
      error: "#dc3545",
      warning: "#ffc107",
      info: "#17a2b8",
    };
    return colors[type] || "#17a2b8";
  }

  /**
   * 通知のボーダー色を取得
   */
  getNotificationBorderColor(type) {
    const colors = {
      success: "#1e7e34",
      error: "#bd2130",
      warning: "#d39e00",
      info: "#117a8b",
    };
    return colors[type] || "#117a8b";
  }

  /**
   * 同期設定の保存
   */
  saveSyncSettings() {
    const settings = {
      autoSyncEnabled: this.elements.autoSyncToggle?.checked || false,
      autoSyncInterval: parseInt(this.elements.autoSyncInterval?.value || "60"),
      realTimeSyncEnabled: this.elements.realTimeSyncToggle?.checked || false,
      syncDirection:
        document.querySelector('input[name="sync-direction"]:checked')?.value ||
        "export",
      lastSyncTime: Date.now(),
    };

    try {
      localStorage.setItem(
        "googleCalendarSyncSettings",
        JSON.stringify(settings)
      );
      console.log("同期設定を保存しました:", settings);
    } catch (error) {
      console.error("同期設定の保存に失敗:", error);
    }
  }

  /**
   * 同期設定の読み込み
   */
  loadSyncSettings() {
    try {
      const settingsStr = localStorage.getItem("googleCalendarSyncSettings");
      if (!settingsStr) return;

      const settings = JSON.parse(settingsStr);

      // UI要素に設定を反映
      if (this.elements.autoSyncToggle && settings.autoSyncEnabled) {
        this.elements.autoSyncToggle.checked = true;
        if (this.authenticated) {
          this.setupAutoSync(settings.autoSyncInterval);
        }
      }

      if (this.elements.autoSyncInterval) {
        this.elements.autoSyncInterval.value = settings.autoSyncInterval;
      }

      if (this.elements.realTimeSyncToggle && settings.realTimeSyncEnabled) {
        this.elements.realTimeSyncToggle.checked = true;
        if (this.authenticated) {
          this.enableRealTimeSync();
        }
      }

      // 同期方向の設定
      if (settings.syncDirection) {
        const syncDirectionRadio = document.querySelector(
          `input[name="sync-direction"][value="${settings.syncDirection}"]`
        );
        if (syncDirectionRadio) {
          syncDirectionRadio.checked = true;
        }
      }

      console.log("同期設定を読み込みました:", settings);
    } catch (error) {
      console.error("同期設定の読み込みに失敗:", error);
    }
  }

  /**
   * 統計情報の取得
   */
  getSyncStats() {
    try {
      const statsStr = localStorage.getItem("googleCalendarSyncStats");
      return statsStr
        ? JSON.parse(statsStr)
        : {
            totalSyncs: 0,
            lastSyncTime: null,
            totalEventsExported: 0,
            totalEventsImported: 0,
            totalErrors: 0,
          };
    } catch (error) {
      console.error("統計情報の取得に失敗:", error);
      return null;
    }
  }

  /**
   * 統計情報の更新
   */
  updateSyncStats(result) {
    try {
      const stats = this.getSyncStats();
      if (!stats) return;

      stats.totalSyncs++;
      stats.lastSyncTime = Date.now();
      stats.totalEventsExported += result.exported || 0;
      stats.totalEventsImported += result.imported || 0;
      stats.totalErrors += result.errors || 0;

      localStorage.setItem("googleCalendarSyncStats", JSON.stringify(stats));
      console.log("統計情報を更新しました:", stats);
    } catch (error) {
      console.error("統計情報の更新に失敗:", error);
    }
  }

  /**
   * デバッグ情報の取得
   */
  getDebugInfo() {
    return {
      authenticated: this.authenticated,
      userInfo: this.userInfo,
      isInitialized: this.isInitialized,
      syncInProgress: this.syncInProgress,
      realTimeSyncEnabled: this.realTimeSyncEnabled,
      autoSyncInterval: this.autoSyncInterval !== null,
      calendarInstance: !!this.calendarInstance,
      pendingSyncEvents: this.pendingSyncEvents.size,
      apiBaseUrl: this.apiBaseUrl,
      stats: this.getSyncStats(),
    };
  }

  /**
   * クリーンアップ処理
   */
  cleanup() {
    // 自動同期を停止
    this.stopAutoSync();

    // リアルタイム同期を無効化
    this.disableRealTimeSync();

    // 設定を保存
    this.saveSyncSettings();

    // イベントリスナーを削除
    if (this.storageListener) {
      window.removeEventListener("storage", this.storageListener);
    }

    console.log("Google Calendar連携をクリーンアップしました");
  }

  /**
   * 同期履歴の取得
   */
  getSyncHistory() {
    try {
      const historyStr = localStorage.getItem("googleCalendarSyncHistory");
      return historyStr ? JSON.parse(historyStr) : [];
    } catch (error) {
      console.error("同期履歴の取得に失敗:", error);
      return [];
    }
  }

  /**
   * 同期履歴の追加
   */
  addSyncHistory(result) {
    try {
      const history = this.getSyncHistory();
      const entry = {
        timestamp: Date.now(),
        date: new Date().toLocaleString("ja-JP"),
        result: result,
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      history.unshift(entry);

      // 履歴は最大50件まで保持
      if (history.length > 50) {
        history.splice(50);
      }

      localStorage.setItem(
        "googleCalendarSyncHistory",
        JSON.stringify(history)
      );
      console.log("同期履歴を追加しました");
    } catch (error) {
      console.error("同期履歴の追加に失敗:", error);
    }
  }
}
