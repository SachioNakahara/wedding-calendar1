const express = require("express");
const cors = require("cors");
const path = require("path");
const functions = require("firebase-functions"); // ★追加
const session = require("express-session");

const { google } = require("googleapis");
const helmet = require("helmet"); // セキュリティ向上のため追加

// 環境変数の読み込み: 本番環境ではfunctions.config()、ローカルではdotenvを使用
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// 設定値を一元管理
const config = {
  google: {
    clientId:
      functions.config().google?.client_id || process.env.GOOGLE_CLIENT_ID,
    clientSecret:
      functions.config().google?.client_secret ||
      process.env.GOOGLE_CLIENT_SECRET,
    redirectUri:
      functions.config().google?.redirect_uri ||
      process.env.GOOGLE_REDIRECT_URI,
  },
  session: {
    secret:
      functions.config().session?.secret ||
      process.env.SESSION_SECRET ||
      "default-dev-secret",
  },
  client: {
    origin:
      functions.config().client?.origin ||
      process.env.CLIENT_ORIGIN ||
      "http://localhost:3000",
  },
  nodeEnv: process.env.NODE_ENV || "development",
};

const app = express();
const PORT = config.PORT || 3000;

// OAuth2 設定
const oauth2Client = new google.auth.OAuth2(
  config.google.clientId,
  config.google.clientSecret,
  `${config.google.redirectUri}/auth/callback`
);

// Google Calendar API のスコープ
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
];

// ミドルウェア設定
app.use(
  cors({
    origin: config.client.origin,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// セッション設定
app.use(
  session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.nodeEnv === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24時間
      httpOnly: true, // セキュリティ向上
    },
  })
);

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, "../backend/public")));

// Google認証URL生成
app.get("/auth/google", (req, res) => {
  try {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
      state: "security_token_" + Date.now(), // セキュリティ向上のためstateパラメータ追加
    });

    res.json({ authUrl });
  } catch (error) {
    console.error("認証URL生成エラー:", error);
    res.status(500).json({ error: "認証URL生成に失敗しました" });
  }
});

// OAuth2 コールバック処理
app.get("/auth/callback", async (req, res) => {
  const { code, error, state } = req.query;

  if (error) {
    console.error("OAuth認証エラー:", error);
    return res.redirect(`${config.client.origin}?error=auth_failed`);
  }

  if (!code) {
    console.error("認証コードが取得できませんでした");
    return res.redirect(`${config.client.origin}?error=no_code`);
  }

  // stateパラメータの検証（セキュリティ向上）
  if (!state || !state.startsWith("security_token_")) {
    console.error("不正なstateパラメータ:", state);
    return res.redirect(`${config.client.origin}?error=invalid_state`);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // セッションにトークンを保存
    req.session.tokens = tokens;

    // ユーザー情報を取得
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    req.session.userInfo = userInfo.data;

    console.log("認証成功:", userInfo.data.email);

    // 成功時のリダイレクト
    res.redirect(`${config.client.origin}?auth=success`);
  } catch (error) {
    console.error("トークン取得エラー:", error);
    return res.redirect(`${config.client.origin}?error=token_failed`);
  }
});

// 認証状態確認
app.get("/auth/status", (req, res) => {
  try {
    if (req.session.tokens && req.session.userInfo) {
      res.json({
        authenticated: true,
        user: {
          id: req.session.userInfo.id,
          name: req.session.userInfo.name,
          email: req.session.userInfo.email,
          picture: req.session.userInfo.picture,
        },
      });
    } else {
      res.json({ authenticated: false });
    }
  } catch (error) {
    console.error("認証状態確認エラー:", error);
    res.status(500).json({ error: "認証状態の確認に失敗しました" });
  }
});

// ログアウト
app.post("/auth/logout", (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("セッション削除エラー:", err);
        return res.status(500).json({ error: "ログアウトに失敗しました" });
      }
      res.clearCookie("connect.sid"); // セッションクッキーをクリア
      res.json({ success: true });
    });
  } catch (error) {
    console.error("ログアウトエラー:", error);
    res.status(500).json({ error: "ログアウトに失敗しました" });
  }
});

// 認証ミドルウェア
function requireAuth(req, res, next) {
  if (!req.session.tokens) {
    return res.status(401).json({ error: "認証が必要です" });
  }

  // トークンの有効性をチェック
  oauth2Client.setCredentials(req.session.tokens);
  next();
}

// Google Calendar一覧取得
app.get("/api/calendars", requireAuth, async (req, res) => {
  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const calendarList = await calendar.calendarList.list();

    // カレンダー情報を整理
    const calendars = calendarList.data.items.map((cal) => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary,
      accessRole: cal.accessRole,
      backgroundColor: cal.backgroundColor,
      foregroundColor: cal.foregroundColor,
    }));

    res.json(calendars);
  } catch (error) {
    console.error("カレンダー一覧取得エラー:", error);
    if (error.code === 401) {
      return res
        .status(401)
        .json({ error: "認証が無効です。再ログインしてください。" });
    }
    res.status(500).json({ error: "カレンダー一覧の取得に失敗しました" });
  }
});

// Google Calendarイベント取得
app.get("/api/events", requireAuth, async (req, res) => {
  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const {
      calendarId = "primary",
      timeMin,
      timeMax,
      maxResults = 250,
      singleEvents = true,
      orderBy = "startTime",
    } = req.query;

    // デフォルトの時間範囲設定（現在から1年後まで）
    const defaultTimeMin = timeMin || new Date().toISOString();
    const defaultTimeMax =
      timeMax || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const events = await calendar.events.list({
      calendarId,
      timeMin: defaultTimeMin,
      timeMax: defaultTimeMax,
      maxResults: parseInt(maxResults),
      singleEvents: singleEvents === "true",
      orderBy,
    });

    // イベントデータを整理
    const formattedEvents = events.data.items.map((event) => ({
      id: event.id,
      title: event.summary || "無題",
      description: event.description || "",
      start: event.start,
      end: event.end,
      colorId: event.colorId,
      status: event.status,
      htmlLink: event.htmlLink,
      creator: event.creator,
      organizer: event.organizer,
      attendees: event.attendees,
      location: event.location,
      recurrence: event.recurrence,
    }));

    res.json(formattedEvents);
  } catch (error) {
    console.error("イベント取得エラー:", error);
    if (error.code === 401) {
      return res
        .status(401)
        .json({ error: "認証が無効です。再ログインしてください。" });
    }
    res.status(500).json({ error: "イベントの取得に失敗しました" });
  }
});

// Google Calendarイベント作成
app.post("/api/events", requireAuth, async (req, res) => {
  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const { calendarId = "primary", event } = req.body;

    // 入力検証
    if (!event || !event.title) {
      return res.status(400).json({ error: "イベントのタイトルは必須です" });
    }

    // イベントデータの変換
    const googleEvent = convertToGoogleEvent(event);

    const createdEvent = await calendar.events.insert({
      calendarId,
      resource: googleEvent,
      sendUpdates: "all", // 招待者に通知を送信
    });

    console.log("イベント作成成功:", createdEvent.data.id);
    res.json(createdEvent.data);
  } catch (error) {
    console.error("イベント作成エラー:", error);
    if (error.code === 401) {
      return res
        .status(401)
        .json({ error: "認証が無効です。再ログインしてください。" });
    }
    res.status(500).json({
      error: "イベントの作成に失敗しました",
      details: config.nodeEnv === "development" ? error.message : undefined,
    });
  }
});

// Google Calendarイベント更新
app.put("/api/events/:eventId", requireAuth, async (req, res) => {
  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const { eventId } = req.params;
    const { calendarId = "primary", event } = req.body;

    if (!event || !event.title) {
      return res.status(400).json({ error: "イベントのタイトルは必須です" });
    }

    const googleEvent = convertToGoogleEvent(event);

    const updatedEvent = await calendar.events.update({
      calendarId,
      eventId,
      resource: googleEvent,
      sendUpdates: "all", // 招待者に通知を送信
    });

    console.log("イベント更新成功:", eventId);
    res.json(updatedEvent.data);
  } catch (error) {
    console.error("イベント更新エラー:", error);
    if (error.code === 401) {
      return res
        .status(401)
        .json({ error: "認証が無効です。再ログインしてください。" });
    }
    if (error.code === 404) {
      return res
        .status(404)
        .json({ error: "指定されたイベントが見つかりません" });
    }
    res.status(500).json({ error: "イベントの更新に失敗しました" });
  }
});

// Google Calendarイベント削除
app.delete("/api/events/:eventId", requireAuth, async (req, res) => {
  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const { eventId } = req.params;
    const { calendarId = "primary" } = req.query;

    await calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates: "all", // 招待者に通知を送信
    });

    console.log("イベント削除成功:", eventId);
    res.json({ success: true });
  } catch (error) {
    console.error("イベント削除エラー:", error);
    if (error.code === 401) {
      return res
        .status(401)
        .json({ error: "認証が無効です。再ログインしてください。" });
    }
    if (error.code === 404) {
      return res
        .status(404)
        .json({ error: "指定されたイベントが見つかりません" });
    }
    res.status(500).json({ error: "イベントの削除に失敗しました" });
  }
});

// 一括同期API
app.post("/api/sync", requireAuth, async (req, res) => {
  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const { direction, events, calendarId = "primary" } = req.body;
    const results = { success: 0, errors: 0, details: [] };

    if (!direction || !["export", "import", "both"].includes(direction)) {
      return res
        .status(400)
        .json({ error: "有効な同期方向を指定してください" });
    }

    if (direction === "export" || direction === "both") {
      // ウエディングカレンダー → Google Calendar
      if (!events || !Array.isArray(events)) {
        return res
          .status(400)
          .json({ error: "同期するイベントデータが無効です" });
      }

      for (const event of events) {
        try {
          const googleEvent = convertToGoogleEvent(event);
          if (!googleEvent) {
            // Skip if conversion failed (e.g., invalid date)
            results.errors++;
            results.details.push({
              type: "export",
              title: event.title || "無題",
              status: "skipped",
              error: "無効なイベントデータ",
            });
            continue; // Skip to the next event
          }

          const result = await calendar.events.insert({
            calendarId,
            resource: googleEvent,
            sendUpdates: "none", // 一括同期時は通知しない
          });
          results.success++;
          results.details.push({
            type: "export",
            title: event.title,
            status: "success",
            googleEventId: result.data.id,
          });
        } catch (error) {
          results.errors++;
          results.details.push({
            type: "export",
            title: event.title,
            status: "error",
            error: error.message,
          });
        }
      }
    }

    if (direction === "import" || direction === "both") {
      // Google Calendar → ウエディングカレンダー
      try {
        const timeMinForQuery = (() => {
          const date = new Date();
          date.setHours(0, 0, 0, 0); // 今日の00:00:00.000から取得
          return date.toISOString();
        })();

        const googleEvents = await calendar.events.list({
          calendarId: calendarId, // 変更点 (機能的には同じですが、明示的にしました)
          timeMin: timeMinForQuery,
          maxResults: 250, // 必要に応じて調整
          singleEvents: true,
          orderBy: "startTime",
          showDeleted: false, // 削除済みイベントは取得しない (キャンセルとは異なる場合がある)
        });

        // ★★★取得した生のGoogleイベントをログに出力★★★
        if (googleEvents.data.items) {
          console.log(
            "[SYNC IMPORT] Fetched Google Events raw data:",
            JSON.stringify(
              googleEvents.data.items.map((e) => ({
                id: e.id,
                summary: e.summary,
                start: e.start,
                end: e.end,
                status: e.status, // ステータスを確認
                recurringEventId: e.recurringEventId,
              })),
              null,
              2
            )
          );
        } else {
          console.log("[SYNC IMPORT] No events fetched from Google Calendar.");
        }

        const seenEvents = new Map(); // 重複チェック用Map

        function isDuplicate(event) {
          if (!event || !event.title || !event.start || !event.end)
            return false; // 不完全なイベントは重複と見なさない

          // 終日イベントの場合、日付のみで比較する
          const startKey = event.allDay
            ? event.start.split("T")[0]
            : event.start;
          const endKey = event.allDay
            ? event.end
              ? event.end.split("T")[0]
              : startKey
            : event.end;

          const key = `${event.title}-${startKey}-${endKey}`;
          if (seenEvents.has(key)) {
            console.log(
              `[SYNC IMPORT] Duplicate event content found (Title: ${
                event.title
              }, Start: ${startKey}, End: ${endKey}). Original Google ID: ${
                seenEvents.get(key).id
              }, Current Google ID: ${event.id}. Skipping current.`
            );
            return true;
          }
          seenEvents.set(key, event); // 初出のイベントを登録 (eventオブジェクト全体を保存して後で参照できるようにする)
          return false;
        }

        const filteredConvertedEvents = googleEvents.data.items // googleEvents.data.items が存在することを前提とする
          .map((googleEvent) => {
            // Google Calendarのイベントステータスが 'cancelled' のものは除外
            if (googleEvent.status === "cancelled") {
              console.log(
                `[SYNC IMPORT] Skipping cancelled Google event: ${
                  googleEvent.summary
                } (ID: ${googleEvent.id}, Start: ${
                  googleEvent.start?.date || googleEvent.start?.dateTime // ?. を使用
                })`
              );
              return null;
            }

            const appEvent = convertFromGoogleEvent(googleEvent); // まず変換
            if (isDuplicate(appEvent)) {
              // 変換後に重複チェック
              return null; // 重複ならスキップ
            }
            return appEvent; // 重複でなければ返す
          })
          .filter((event) => event !== null); // convertFromGoogleEventがnullを返す場合やキャンセル済みを除外

        // さらに、変換後のイベントが timeMinForQuery より前でないか最終チェック
        const todayStartTimestamp = new Date(timeMinForQuery).getTime();

        const eventsToImport = filteredConvertedEvents.filter((appEvent) => {
          if (!appEvent || !appEvent.start) return false;
          try {
            const eventStartTimestamp = new Date(appEvent.start).getTime();
            // allDayイベントの場合、日付文字列を正しく比較するために0時0分にする
            const eventDate = new Date(appEvent.start);
            if (appEvent.allDay) {
              eventDate.setHours(0, 0, 0, 0);
            }
            if (eventDate.getTime() < todayStartTimestamp) {
              console.log(
                `[SYNC IMPORT] Filtering out past event after conversion: ${appEvent.title} (ID: ${appEvent.id}, Start: ${appEvent.start})`
              );
              return false;
            }
            return true;
          } catch (e) {
            console.warn(
              `[SYNC IMPORT] Invalid date in appEvent, skipping: ${appEvent.title}`,
              e
            );
            return false;
          }
        });

        console.log(
          "[SYNC IMPORT] Events to be sent to client:",
          JSON.stringify(
            eventsToImport.map((e) => ({
              id: e.id,
              summary: e.title,
              start: e.start,
            })),
            null,
            2
          )
        );

        results.importedEvents = eventsToImport;
        results.success = eventsToImport.length; // 実際にインポートするイベント数で上書き
        results.details.push({
          type: "import",
          status: "success",

          count: eventsToImport.length,
        });
      } catch (error) {
        results.errors++;
        results.details.push({
          type: "import",
          status: "error",
          error: error.message,
        });
      }
    }

    console.log("同期完了:", {
      direction,
      success: results.success,
      errors: results.errors,
    });
    res.json(results);
  } catch (error) {
    console.error("同期エラー:", error);
    res.status(500).json({ error: "同期に失敗しました" });
  }
});

// API設定情報提供
app.get("/api/config", (req, res) => {
  res.json({
    apiKey: config.google.apiKey ? "設定済み" : "未設定",
    clientId: config.google.clientId,
    redirectUri: config.google.redirectUri,
    clientOrigin: config.client.origin,
    scopes: SCOPES,
    environment: config.nodeEnv,
  });
});

// ヘルスチェック
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    port: PORT,
    nodeVersion: process.version,
    uptime: process.uptime(),
  });
});

// ウエディングカレンダーイベントをGoogle Calendar形式に変換
function convertToGoogleEvent(event) {
  const googleEvent = {
    // 必須フィールドのチェック
    summary: event.title || "無題のイベント", // タイトルがなければデフォルトを設定

    // オプションフィールド

    description: event.description || "",
    start: {},
    end: {},
  };

  // 色の設定
  if (event.backgroundColor) {
    googleEvent.colorId = getGoogleColorId(event.backgroundColor);
  }

  // 日時の設定
  // start は必須
  if (!event.start) {
    console.warn("イベントに開始日時がありません。スキップします:", event);
    return null; // 開始日時がないイベントは変換しない
  }

  try {
    const startDate = new Date(event.start);
    if (isNaN(startDate.getTime())) {
      console.warn("イベントの開始日時が無効です。スキップします:", event);
      return null; // 無効な開始日時は変換しない
    }

    if (event.allDay) {
      // 終日イベント
      googleEvent.start.date = startDate.toISOString().split("T")[0];
      // 終日イベントの終了日は開始日と同じか、終了日があればその日付
      const endDate = event.end ? new Date(event.end) : startDate;
      googleEvent.end.date = endDate.toISOString().split("T")[0];
    } else {
      // 時間指定イベント
      googleEvent.start.dateTime = startDate.toISOString();
      googleEvent.start.timeZone = "Asia/Tokyo"; // タイムゾーンを固定
      // 終了時間がない場合は開始時間の1時間後
      const endDate = event.end
        ? new Date(event.end)
        : new Date(startDate.getTime() + 60 * 60 * 1000);
      googleEvent.end.dateTime = endDate.toISOString();
      googleEvent.end.timeZone = "Asia/Tokyo"; // タイムゾーンを固定
    }
  } catch (e) {
    console.warn("イベントの開始日時が無効です。スキップします:", event);
    return null; // 無効な開始日時は変換しない
  }

  // 場所の設定
  if (event.location) {
    googleEvent.location = event.location;
  }

  // 追加のメタデータ
  let additionalInfo = [];

  if (event.category) {
    additionalInfo.push(`カテゴリ: ${event.category}`);
  }

  if (event.tags) {
    additionalInfo.push(`タグ: ${event.tags}`);
  }

  if (event.status) {
    additionalInfo.push(`ステータス: ${event.status}`);
  }

  let finalDescription = googleEvent.description; // finalDescription を googleEvent.description で初期化
  if (additionalInfo.length > 0) {
    const additionalText = additionalInfo.join("\n");

    if (finalDescription && finalDescription.trim() !== "") {
      // finalDescription が空でない場合のみ追記
      finalDescription += "\n\n" + additionalText;
    } else {
      finalDescription = additionalText;
    }
  }

  googleEvent.description = finalDescription; // 初期化された finalDescription を使用

  // リマインダー設定
  if (event.reminder && !isNaN(parseInt(event.reminder))) {
    googleEvent.reminders = {
      useDefault: false,
      overrides: [
        {
          method: "popup",
          minutes: parseInt(event.reminder),
        },
      ],
    };
  }

  // 招待者の設定
  if (event.attendees && Array.isArray(event.attendees)) {
    googleEvent.attendees = event.attendees.map((email) => ({
      email: email,
      responseStatus: "needsAction",
    }));
  }

  return googleEvent;
}

// Google Calendarイベントをウエディングカレンダー形式に変換
function convertFromGoogleEvent(googleEvent) {
  const event = {
    id: `google_${googleEvent.id}`,
    title: googleEvent.summary || "無題",
    description: cleanDescription(googleEvent.description || ""),
    backgroundColor: getWeddingColorFromGoogle(googleEvent.colorId),
    allDay: !!googleEvent.start.date,
  };

  // 日時の設定
  if (event.allDay) {
    event.start = googleEvent.start.date;
    event.end = googleEvent.end.date;
  } else {
    event.start = googleEvent.start.dateTime;
    event.end = googleEvent.end.dateTime;
  }

  // 場所の設定
  if (googleEvent.location) {
    event.location = googleEvent.location;
  }

  // メタデータの抽出
  if (googleEvent.description) {
    const categoryMatch = googleEvent.description.match(/カテゴリ: (.+)/);
    if (categoryMatch) {
      event.category = categoryMatch[1].trim();
    }

    const tagsMatch = googleEvent.description.match(/タグ: (.+)/);
    if (tagsMatch) {
      event.tags = tagsMatch[1].trim();
    }

    const statusMatch = googleEvent.description.match(/ステータス: (.+)/);
    if (statusMatch) {
      event.status = statusMatch[1].trim();
    }
  }

  // 招待者の設定
  if (googleEvent.attendees && Array.isArray(googleEvent.attendees)) {
  }
  // descriptionから抽出した情報を追加
  if (googleEvent.description) {
    const descriptionLines = googleEvent.description.split("\n");
    descriptionLines.forEach((line) => {
      const [key, value] = line.split(":").map((s) => s.trim());
      if (key && value) {
        switch (key.toLowerCase()) {
          case "category":
            event.category = value;
            break;
          case "tags":
            event.tags = value;
            break;
          case "status":
            event.status = value;
            break;
        }
      }
    });
  }

  return event;
}

// 説明文からメタデータを除去
function cleanDescription(description) {
  return description
    .replace(/\nカテゴリ: .+/g, "")
    .replace(/\nタグ: .+/g, "")
    .replace(/\nステータス: .+/g, "")
    .trim();
}

// 背景色をGoogle Calendar色IDに変換
function getGoogleColorId(backgroundColor) {
  const colorMap = {
    "#FFD1DC": "4", // パステルピンク
    "#B5DCFD": "1", // パステルブルー
    "#B3EFB2": "2", // パステルグリーン
    "#FFF4BD": "5", // パステルイエロー
    "#E0B0FF": "3", // パステルラベンダー
    "#FFDAB9": "6", // パステルピーチ
    "#FFFFFF": "9", // ホワイト
    "#7fb9e8": "1", // デフォルト
    "#FF6B6B": "11", // レッド
    "#4ECDC4": "10", // ターコイズ
    "#45B7D1": "1", // ブルー
    "#96CEB4": "2", // グリーン
    "#FFEAA7": "5", // イエロー
  };

  return colorMap[backgroundColor] || "1";
}

// Google Color IDをウエディングカレンダー色に変換
function getWeddingColorFromGoogle(colorId) {
  const colorMap = {
    1: "#B5DCFD", // ブルー
    2: "#B3EFB2", // グリーン
    3: "#E0B0FF", // ラベンダー
    4: "#FFD1DC", // ピンク
    5: "#FFF4BD", // イエロー
    6: "#FFDAB9", // ピーチ
    7: "#87CEEB", // スカイブルー
    8: "#98FB98", // ライトグリーン
    9: "#FFFFFF", // ホワイト
    10: "#4ECDC4", // ターコイズ
    11: "#FF6B6B", // レッド
  };

  return colorMap[colorId] || "#7fb9e8";
}

// エラーハンドリングミドルウェア
app.use((error, req, res, next) => {
  console.error("サーバーエラー:", error);

  // エラータイプに応じた処理
  if (error.name === "ValidationError") {
    return res.status(400).json({
      error: "入力データが無効です",
      details: config.nodeEnv === "development" ? error.message : undefined,
    });
  }

  if (error.code === "ECONNREFUSED") {
    return res.status(503).json({
      error: "外部サービスに接続できません",
    });
  }

  res.status(500).json({
    error: "サーバー内部エラーが発生しました",
    message: config.nodeEnv === "development" ? error.message : undefined,
  });
});

// 404ハンドラー
app.use((req, res) => {
  res.status(404).json({
    error: "エンドポイントが見つかりません",
    path: req.path,
    method: req.method,
  });
});

// プロセス終了時の処理
process.on("SIGTERM", () => {
  console.log("📤 SIGTERM受信、サーバーを正常終了します");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("📤 SIGINT受信、サーバーを正常終了します");
  process.exit(0);
});

// ★ExpressアプリをCloud Functionとしてエクスポート
exports.api = functions.region("asia-northeast1").https.onRequest(app);
