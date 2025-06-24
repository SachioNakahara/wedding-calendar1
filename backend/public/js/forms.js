// イベントリスナーの設定（DOMContentLoaded を追加）
document.addEventListener("DOMContentLoaded", function () {
  // モーダルの閉じるボタンにイベントリスナーを設定
  const closeButtons = document.querySelectorAll(".modal-close");
  closeButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const modal = button.closest(".modal");
      hideModal(modal);
    });
  });

  // 「+」ボタンにイベントリスナーを追加
  const addButton = document.getElementById("add-button");
  if (addButton) {
    addButton.addEventListener("click", function () {
      // 現在の日付を取得
      const currentDate = new Date();
      // 拡張イベントモーダルを表示
      addNewEnhancedEvent(currentDate);
    });
  }

  const uploadButton = document.querySelector(".upload-btn");
  const fileInput = document.getElementById("file-input");
  const imageContainer = document.getElementById("image-container");

  if (uploadButton && fileInput && imageContainer) {
    // アップロードボタンがクリックされたときの処理
    uploadButton.addEventListener("click", function () {
      // 画像選択ダイアログを開く
      fileInput.click();
    });

    // ファイル選択時の処理
    fileInput.addEventListener("change", function (event) {
      const files = event.target.files;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        reader.onload = function (e) {
          const img = document.createElement("img");
          img.src = e.target.result;
          img.alt = file.name;
          img.classList.add("uploaded-image");
          imageContainer.appendChild(img);

          // ローカルストレージに画像を保存
          const imageData = {
            name: file.name,
            url: e.target.result,
          };
          saveImageToStorage(imageData);
        };

        reader.readAsDataURL(file);
      }
    });

    // ストレージ内に保存された画像を補完
    const storedImages = JSON.parse(
      localStorage.getItem("uploadedImages") || "[]"
    );

    if (storedImages.length > 0) {
      storedImages.forEach((imageData) => {
        const img = document.createElement("img");
        img.src = imageData.url;
        img.alt = imageData.name || "Uploaded Image";
        img.classList.add("uploaded-image");
        imageContainer.appendChild(img);
      });
      console.log("ストレージ内の画像が補完されました");
    }
  }
});

// 画像をローカルストレージに保存する関数
function saveImageToStorage(imageData) {
  const storedImages = JSON.parse(
    localStorage.getItem("uploadedImages") || "[]"
  );
  storedImages.push(imageData);
  localStorage.setItem("uploadedImages", JSON.stringify(storedImages));
  console.log("画像がストレージに保存されました");
}

// 標準イベントの詳細を表示する関数
function showEventDetails(event) {
  // モーダルを取得
  const modal = document.getElementById("event-modal");
  if (!modal) {
    console.error("イベントモーダル要素が見つかりません");
    return;
  }

  const modalTitle = modal.querySelector(".modal-title");
  const form = modal.querySelector("form");

  if (!modalTitle || !form) {
    console.error("モーダル内の必要な要素が見つかりません");
    return;
  }

  // モーダルのタイトルを変更
  modalTitle.textContent = "イベント詳細";

  // フォームの内容をクリア
  form.innerHTML = "";

  // イベント情報を表示
  const eventDetails = document.createElement("div");
  eventDetails.classList.add("event-details");

  // イベントのタイトル
  const titleEl = document.createElement("h3");
  titleEl.textContent = event.title;
  // タイトルの色があれば適用
  if (event.textColor) {
    titleEl.style.color = event.textColor;
  }
  eventDetails.appendChild(titleEl);

  // 日時情報
  const dateInfo = document.createElement("p");
  if (event.allDay) {
    dateInfo.textContent = `日付: ${moment(event.start).format(
      "YYYY年MM月DD日"
    )} (終日)`;
  } else {
    dateInfo.textContent = `日時: ${moment(event.start).format(
      "YYYY年MM月DD日 HH:mm"
    )} 〜 ${moment(event.end || event.start).format("HH:mm")}`;
  }
  eventDetails.appendChild(dateInfo);

  // 編集ボタン
  const editButton = document.createElement("button");
  editButton.textContent = "編集";
  editButton.classList.add("btn", "btn-warning");
  editButton.addEventListener("click", function () {
    // 編集モードに切り替え
    editEvent(event);
  });

  // 削除ボタン
  const deleteButton = document.createElement("button");
  deleteButton.textContent = "削除";
  deleteButton.classList.add("btn", "btn-danger");
  // deleteButton.style.marginLeft = "10px"; // CSSで管理
  deleteButton.addEventListener("click", async function () {
    // asyncキーワードを追加
    const googleEventId = event.extendedProps?.googleEventId;
    const localEventId = event.id || event.extendedProps?.id;

    // 確認ダイアログ
    if (!confirm("このイベントを削除してもよろしいですか？")) {
      return;
    }

    try {
      // イベントを削除
      event.remove();
      // 変更を保存
      saveEvents();
      // モーダルを閉じる
      hideModal(modal);

      // Google Calendar連携インスタンスがあり、認証済みの場合
      if (
        window.googleCalendarIntegration &&
        window.googleCalendarIntegration.authenticated &&
        typeof window.googleCalendarIntegration.deleteGoogleEvent === "function" // メソッド存在確認
      ) {
        if (googleEventId) {
          try {
            console.log(
              `Google CalendarからイベントID: ${googleEventId} の削除を試みます。`
            );
            await window.googleCalendarIntegration.deleteGoogleEvent(
              googleEventId
            );
            window.googleCalendarIntegration.showSuccess(
              "Google Calendar上のイベントも削除しました。"
            );
          } catch (gcalError) {
            console.error(
              "Google Calendarからのイベント削除に失敗:",
              gcalError
            );
            window.googleCalendarIntegration.showError(
              "Google Calendar上のイベント削除に失敗しました。手動同期で整合性が取れる場合があります。"
            );
          }
        } else {
          console.log(
            `イベント (ローカルID: ${localEventId}) はGoogle Calendarと未同期か、Google Event IDが不明なため、Google Calendarからの削除はスキップします。`
          );
        }
      }
    } catch (error) {
      console.error("イベントの削除処理中にエラーが発生しました:", error);
      alert("イベントの削除に失敗しました。");
    }
  });

  // 日表示ボタンを追加
  const viewDayButton = document.createElement("button");
  viewDayButton.textContent = "日表示で確認";
  viewDayButton.classList.add("btn", "btn-info");
  // viewDayButton.style.marginLeft = "10px"; // CSSで管理
  viewDayButton.addEventListener("click", function () {
    // 日表示に切り替え
    if (window.weddingCalendar) {
      window.weddingCalendar.changeView("timeGridDay", event.start);
      // モーダルを閉じる
      hideModal(modal);
    } else {
      console.error("カレンダーが初期化されていません");
    }
  });

  // ボタンコンテナ
  const buttonContainer = document.createElement("div");
  buttonContainer.classList.add("button-container"); // CSSで管理
  buttonContainer.appendChild(editButton);
  buttonContainer.appendChild(deleteButton);
  buttonContainer.appendChild(viewDayButton);
  eventDetails.appendChild(buttonContainer);

  form.appendChild(eventDetails);

  // モーダルを表示
  showModal(modal);
}

// イベント編集関数
function editEvent(event) {
  // モーダルを取得
  const modal = document.getElementById("event-modal");
  if (!modal) {
    console.error("イベントモーダル要素が見つかりません");
    return;
  }

  const modalTitle = modal.querySelector(".modal-title");
  const form = modal.querySelector("form");

  if (!modalTitle || !form) {
    console.error("モーダル内の必要な要素が見つかりません");
    return;
  }

  // モーダルのタイトルを変更
  modalTitle.textContent = "イベントを編集";

  // フォームの内容をクリア
  form.innerHTML = "";

  // イベント編集フォームを作成
  // タイトル入力
  const titleGroup = document.createElement("div");
  titleGroup.classList.add("form-group");

  const titleLabel = document.createElement("label");
  titleLabel.setAttribute("for", "event-title");
  titleLabel.textContent = "タイトル";

  const titleInput = document.createElement("input");
  titleInput.setAttribute("type", "text");
  titleInput.setAttribute("id", "event-title");
  titleInput.setAttribute("required", "true");
  titleInput.classList.add("form-control");
  titleInput.value = event.title;

  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  form.appendChild(titleGroup);

  // 色選択時の処理
  function selectColor(colorValue) {
    // 隠しinputの値を更新
    hiddenColorInput.value = colorValue;

    // 全てのスウォッチのスタイルをリセット
    document.querySelectorAll(".color-swatch").forEach((swatch) => {
      // swatch.style.border = "2px solid transparent"; // CSSで管理
      swatch.setAttribute("aria-selected", "false");
    });

    // 選択されたスウォッチのスタイルを変更
    const selectedSwatch = document.querySelector(
      `.color-swatch[data-color="${colorValue}"]`
    );
    if (selectedSwatch) {
      // selectedSwatch.style.border = "2px solid #333"; // CSSで管理
      selectedSwatch.setAttribute("aria-selected", "true");
    }

    // イベントを発火して変更を通知
    const changeEvent = new Event("change");
    hiddenColorInput.dispatchEvent(changeEvent);
  }

  // 開始日時
  const startGroup = document.createElement("div");
  startGroup.classList.add("form-group");

  const startLabel = document.createElement("label");
  startLabel.setAttribute("for", "event-start");
  startLabel.textContent = "開始日時";

  const startInput = document.createElement("input");
  startInput.setAttribute("type", "datetime-local");
  startInput.setAttribute("id", "event-start");
  startInput.classList.add("form-control");
  startInput.value = moment(event.start).format("YYYY-MM-DDTHH:mm");

  startGroup.appendChild(startLabel);
  startGroup.appendChild(startInput);
  form.appendChild(startGroup);

  // 終了日時
  const endGroup = document.createElement("div");
  endGroup.classList.add("form-group");

  const endLabel = document.createElement("label");
  endLabel.setAttribute("for", "event-end");
  endLabel.textContent = "終了日時";

  const endInput = document.createElement("input");
  endInput.setAttribute("type", "datetime-local");
  endInput.setAttribute("id", "event-end");
  endInput.classList.add("form-control");
  if (event.end) {
    endInput.value = moment(event.end).format("YYYY-MM-DDTHH:mm");
  } else {
    // 終了時間が設定されていない場合は開始時間の1時間後
    endInput.value = moment(event.start)
      .add(1, "hour")
      .format("YYYY-MM-DDTHH:mm");
  }

  endGroup.appendChild(endLabel);
  endGroup.appendChild(endInput);
  form.appendChild(endGroup);

  // 終日チェックボックス
  const allDayGroup = document.createElement("div");
  allDayGroup.classList.add("form-group");

  const allDayCheckbox = document.createElement("input");
  allDayCheckbox.setAttribute("type", "checkbox");
  allDayCheckbox.setAttribute("id", "event-allday");
  allDayCheckbox.checked = event.allDay;

  const allDayLabel = document.createElement("label");
  allDayLabel.setAttribute("for", "event-allday");
  allDayLabel.textContent = "終日";
  // allDayLabel.style.marginLeft = "5px"; // CSSで管理

  allDayGroup.appendChild(allDayCheckbox);
  allDayGroup.appendChild(allDayLabel);
  form.appendChild(allDayGroup);

  // 色選択
  const colorGroup = document.createElement("div");
  colorGroup.classList.add("form-group");

  const colorLabel = document.createElement("label");
  colorLabel.setAttribute("for", "event-color");
  colorLabel.textContent = "背景色";

  const colorSelect = document.createElement("select");
  colorSelect.setAttribute("id", "event-color");
  colorSelect.classList.add("form-control");

  // プリセットの色定義
  const colors = [
    { value: "#7fb9e8", label: "青" },
    { value: "#9de8a0", label: "緑" },
    { value: "#e8ad7f", label: "オレンジ" },
    { value: "#ff9999", label: "赤" },
    { value: "#b99ce8", label: "紫" },
    // { value: "", label: "-- 色を選択 --" } // 必要であれば未選択オプション
  ];

  colors.forEach((color) => {
    const option = document.createElement("option");
    option.value = color.value;
    option.textContent = color.label;
    if (event.backgroundColor === color.value) {
      option.selected = true; // ★ プリセットの色が選択されていたら反映
    }
    colorSelect.appendChild(option);
  });

  colorGroup.appendChild(colorLabel);
  colorGroup.appendChild(colorSelect);
  form.appendChild(colorGroup);

  // カスタム背景色入力を追加
  const customColorGroup = document.createElement("div");
  customColorGroup.classList.add("form-group");

  const customColorLabel = document.createElement("label");
  customColorLabel.setAttribute("for", "event-custom-color");
  customColorLabel.textContent = "カスタム背景色";

  const customColorInput = document.createElement("input");
  customColorInput.setAttribute("type", "color");
  customColorInput.setAttribute("id", "event-custom-color");
  customColorInput.classList.add("form-control");
  // ★ 編集対象イベントの backgroundColor を初期値として設定
  // ただし、パステルカラーやプリセットカラーでない場合のみ、こちらを優先的に表示
  const isPastel = pastelColors.some(
    (pc) => pc.value === event.backgroundColor
  );
  const isPreset = colors.some(
    (c) => c.value === event.backgroundColor && c.value !== ""
  );

  if (event.backgroundColor && !isPastel && !isPreset) {
    customColorInput.value = event.backgroundColor;
  } else {
    customColorInput.value = event.backgroundColor || "#7fb9e8"; // デフォルトまたは既存のプリセット/パステル色
  }

  customColorGroup.appendChild(customColorLabel);
  customColorGroup.appendChild(customColorInput);
  form.appendChild(customColorGroup);

  // カスタム色を適用するチェックボックス
  const useCustomColorGroup = document.createElement("div");
  useCustomColorGroup.classList.add("form-group");

  const useCustomColorCheckbox = document.createElement("input");
  useCustomColorCheckbox.setAttribute("type", "checkbox");
  useCustomColorCheckbox.setAttribute("id", "use-custom-color");

  // ★ 編集対象イベントの色が、パステルカラーでもプリセットカラーでもない場合にチェック
  //    かつ、event.backgroundColor が存在する場合
  if (event.backgroundColor && !isPastel && !isPreset) {
    useCustomColorCheckbox.checked = true;
  }

  const useCustomColorLabel = document.createElement("label");
  useCustomColorLabel.setAttribute("for", "use-custom-color");
  useCustomColorLabel.textContent = "カスタム背景色を使用する";
  // useCustomColorLabel.style.marginLeft = "5px"; // CSSで管理

  useCustomColorGroup.appendChild(useCustomColorCheckbox);
  useCustomColorGroup.appendChild(useCustomColorLabel);
  form.appendChild(useCustomColorGroup);

  // ボタンコンテナ
  const buttonContainer = document.createElement("div");
  buttonContainer.classList.add("button-container"); // CSSで管理

  // 保存ボタン
  const saveButton = document.createElement("button");
  saveButton.setAttribute("type", "button"); // フォーム送信を防止
  saveButton.classList.add("btn", "btn-primary");
  saveButton.textContent = "保存";
  saveButton.addEventListener("click", function () {
    // イベントの更新
    event.setProp("title", titleInput.value);
    event.setStart(moment(startInput.value).toDate());
    event.setEnd(moment(endInput.value).toDate());
    event.setAllDay(allDayCheckbox.checked);
    // 背景色の設定ロジック
    const customPickerValue = customColorInput.value;
    const presetDropdownValue = colorSelect.value; // 480行目
    const isCustomChecked = useCustomColorCheckbox.checked;

    let chosenBackgroundColor = event.backgroundColor; // デフォルトは現在の色

    // 背景色選択ロジック (パステルカラーパレット部分は削除済み)
    if (
      // 変更点: 最初の条件分岐のため 'if' に修正します (以前は 'else if' で始まっていました)

      isCustomChecked &&
      customPickerValue &&
      customPickerValue !== "#7fb9e8"
    ) {
      chosenBackgroundColor = customPickerValue;
      // 3. プリセットドロップダウン (値が空でない場合)
    } else if (presetDropdownValue && presetDropdownValue !== "") {
      chosenBackgroundColor = presetDropdownValue; // 490行目
      // 4. フォールバック (カスタムもプリセットも選択されていない場合)
    } else {
      // それ以外は chosenBackgroundColor (event.backgroundColor) が維持される
    }

    // タイトル色の設定
    // event.setProp("textColor", titleColorInput.value); // 注意: titleColorInput がこのスコープで定義されていません。
    event.setProp("display", "block"); // 独立した表示設定を追加

    // 変更を保存
    event.setProp("backgroundColor", chosenBackgroundColor);
    saveEvents();

    // モーダルを閉じる
    hideModal(modal);

    // イベントが変更された日付の日表示に移動
    if (window.weddingCalendar) {
      window.weddingCalendar.changeView(
        "timeGridDay",
        moment(startInput.value).toDate()
      );
    } else {
      console.error("カレンダーが初期化されていません");
    }
  });
  buttonContainer.appendChild(saveButton);

  // 削除ボタン
  const deleteButton = document.createElement("button");
  deleteButton.setAttribute("type", "button"); // フォーム送信を防止
  deleteButton.classList.add("btn", "btn-danger");
  deleteButton.textContent = "削除";
  // deleteButton.style.marginLeft = "10px"; // CSSで管理
  deleteButton.addEventListener("click", async function () {
    const googleEventId = event.extendedProps?.googleEventId;
    const localEventId = event.id || event.extendedProps?.id;

    // 確認ダイアログ
    if (!confirm("このイベントを削除してもよろしいですか？")) {
      return;
    }

    try {
      // イベントを削除
      event.remove();
      // 変更を保存
      saveEvents();
      // モーダルを閉じる
      hideModal(modal);

      // Google Calendar連携インスタンスがあり、認証済みの場合
      if (
        window.googleCalendarIntegration &&
        window.googleCalendarIntegration.authenticated &&
        typeof window.googleCalendarIntegration.deleteGoogleEvent === "function" // メソッド存在確認
      ) {
        if (googleEventId) {
          try {
            console.log(
              `Google CalendarからイベントID: ${googleEventId} の削除を試みます。`
            );
            await window.googleCalendarIntegration.deleteGoogleEvent(
              googleEventId
            );
            window.googleCalendarIntegration.showSuccess(
              "Google Calendar上のイベントも削除しました。"
            );
          } catch (gcalError) {
            console.error(
              "Google Calendarからのイベント削除に失敗:",
              gcalError
            );
            window.googleCalendarIntegration.showError(
              "Google Calendar上のイベント削除に失敗しました。手動同期で整合性が取れる場合があります。"
            );
          }
        } else {
          console.log(
            `イベント (ローカルID: ${localEventId}) はGoogle Calendarと未同期か、Google Event IDが不明なため、Google Calendarからの削除はスキップします。`
          );
        }
      }
    } catch (error) {
      console.error("イベントの削除処理中にエラーが発生しました:", error);
      alert("イベントの削除に失敗しました。");
    }
  });

  buttonContainer.appendChild(deleteButton);

  form.appendChild(buttonContainer);

  // モーダルを表示
  showModal(modal);
}

// 拡張イベント機能（より詳細な情報を持つイベント）
function addNewEnhancedEvent(date) {
  // 拡張イベントモーダルを表示
  showEnhancedEventModal();

  // 日付フィールドに選択された日付を設定
  const dateInput = document.getElementById("enhanced-event-date");
  if (dateInput) {
    dateInput.value = moment(date).format("YYYY-MM-DD");
  } else {
    console.error("日付入力要素が見つかりません");
  }

  // 時間フィールドに現在時刻を設定
  const timeInput = document.getElementById("enhanced-event-time");
  if (timeInput) {
    timeInput.value = moment(date).format("HH:mm");
  } else {
    console.error("時間入力要素が見つかりません");
  }

  // 拡張イベント保存ボタンのイベントリスナーを設定
  const saveButton = document.getElementById("save-enhanced-event");
  if (saveButton) {
    // 以前のイベントリスナーを削除
    const newSaveButton = saveButton.cloneNode(true);
    saveButton.parentNode.replaceChild(newSaveButton, saveButton);

    newSaveButton.addEventListener("click", function () {
      // 拡張イベントデータを収集
      const title =
        document.getElementById("enhanced-event-title")?.value || "";
      const titleColor =
        document.getElementById("enhanced-event-title-color")?.value || "";
      const date = document.getElementById("enhanced-event-date")?.value || "";
      const time = document.getElementById("enhanced-event-time")?.value || "";
      const duration =
        document.getElementById("enhanced-event-duration")?.value || 60; // デフォルト60分
      const description =
        document.getElementById("enhanced-event-description")?.value || "";
      const category =
        document.getElementById("enhanced-event-category")?.value || "";
      const priorityElem = document.querySelector(
        'input[name="priority"]:checked'
      );
      const priority = priorityElem ? priorityElem.value : "medium";

      // カスタム背景色の処理
      let backgroundColor;
      const useCustomBgColorCheckbox = document.getElementById(
        "use-custom-background-color"
      );
      const customBgColorInput = document.getElementById(
        "enhanced-event-custom-color"
      );

      if (
        useCustomBgColorCheckbox?.checked &&
        customBgColorInput?.value &&
        customBgColorInput.value !== getPriorityColor("medium")
      ) {
        // デフォルトの優先度色と異なる場合
        backgroundColor = customBgColorInput.value;
      } else {
        backgroundColor = getPriorityColor(priority);
      }

      // バリデーション
      if (!title.trim()) {
        alert("タイトルを入力してください");
        return;
      }

      if (!date.trim() || !time.trim()) {
        alert("日付と時間を入力してください");
        return;
      }

      // 開始時間と終了時間の計算
      try {
        const start = moment(`${date} ${time}`).toDate();
        const end = moment(`${date} ${time}`)
          .add(parseInt(duration, 10), "minutes")
          .toDate();

        // IDを生成 (saveEventsのフォールバックロジックと同様)
        const newEventId =
          typeof generateEventId === "function" // main.jsのgenerateEventIdがグローバルにあれば使用
            ? generateEventId()
            : `form_event_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}`;

        // 拡張イベントデータを作成
        const newEvent = {
          title: title,
          start: start,
          end: end,
          backgroundColor: backgroundColor,
          textColor: titleColor || null, // タイトル色の設定
          extendedProps: {
            id: newEventId, // ★ extendedProps にもIDを設定
            isEnhanced: true, // 既存のプロパティ
            description: description,
            category: category,
            priority: priority,
            duration: duration,
          },
          display: "block",
        };
        newEvent.id = newEventId; // ★ FullCalendarが直接参照するIDも設定

        // カレンダーにイベントを追加
        if (window.weddingCalendar) {
          window.weddingCalendar.addEvent(newEvent);
          console.log("新しい拡張イベントが追加されました:", newEvent);

          // 変更を保存
          saveEvents();

          // モーダルを閉じる
          hideEnhancedEventModal();

          // 保存後、イベントが追加された日付の日表示に移動
          window.weddingCalendar.changeView("timeGridDay", start);
        } else {
          console.error("カレンダーが初期化されていません");
          alert(
            "カレンダーが初期化されていません。ページを再読み込みしてください。"
          );
        }
      } catch (e) {
        console.error("日付処理エラー:", e);
        alert("日付と時間の形式が正しくありません");
      }
    });
  } else {
    console.error("保存ボタン要素が見つかりません");
  }
}

// 拡張イベントの詳細を表示する関数
function showEnhancedEventDetails(event) {
  // モーダルを取得
  const modal = document.getElementById("enhanced-event-details-modal");
  if (!modal) {
    console.error("拡張イベント詳細モーダル要素が見つかりません");
    return;
  }

  const modalTitle = modal.querySelector(".modal-title");
  const modalBody = modal.querySelector(".modal-body");

  if (!modalTitle || !modalBody) {
    console.error("モーダル内の必要な要素が見つかりません");
    return;
  }

  // モーダルのタイトルを設定
  modalTitle.textContent = event.title;
  if (event.textColor) {
    modalTitle.style.color = event.textColor;
  } else {
    modalTitle.style.color = ""; // デフォルトに戻す
  }

  // モーダルの内容をクリア
  modalBody.innerHTML = "";

  // イベント情報を表示
  const eventDetails = document.createElement("div");
  eventDetails.classList.add("enhanced-event-details");

  // 日時情報
  const dateInfo = document.createElement("p");
  dateInfo.innerHTML = `<strong>日時:</strong> ${moment(event.start).format(
    "YYYY年MM月DD日 HH:mm"
  )} 〜 ${moment(event.end).format("HH:mm")}`;
  eventDetails.appendChild(dateInfo);

  // カテゴリ
  if (event.extendedProps && event.extendedProps.category) {
    const categoryInfo = document.createElement("p");
    categoryInfo.innerHTML = `<strong>カテゴリ:</strong> ${event.extendedProps.category}`;
    eventDetails.appendChild(categoryInfo);
  }

  // 優先度
  if (event.extendedProps && event.extendedProps.priority) {
    const priorityInfo = document.createElement("p");
    priorityInfo.innerHTML = `<strong>優先度:</strong> ${getPriorityLabel(
      event.extendedProps.priority
    )}`; // 色はCSSクラスで適用
    priorityInfo.classList.add(
      `priority-label-${event.extendedProps.priority}`
    );

    eventDetails.appendChild(priorityInfo);
  }

  // 説明
  if (event.extendedProps && event.extendedProps.description) {
    const descriptionTitle = document.createElement("h4");
    descriptionTitle.textContent = "説明";
    eventDetails.appendChild(descriptionTitle);

    const descriptionText = document.createElement("p");
    descriptionText.textContent = event.extendedProps.description;
    descriptionText.classList.add("event-description");
    eventDetails.appendChild(descriptionText);
  }

  modalBody.appendChild(eventDetails);

  // ボタンコンテナを作成
  const buttonContainer = document.createElement("div");
  buttonContainer.classList.add("button-container");
  // buttonContainer.style.marginTop = "20px"; // CSSで管理

  // 編集ボタン
  const editButton = document.createElement("button");
  editButton.textContent = "編集";
  editButton.classList.add("btn", "btn-warning");
  editButton.addEventListener("click", function () {
    // モーダルを閉じる
    hideModal(modal);
    // 編集モーダルを表示
    editEnhancedEvent(event);
  });
  buttonContainer.appendChild(editButton);

  // 削除ボタン
  const deleteButton = document.createElement("button");
  deleteButton.textContent = "削除";
  deleteButton.classList.add("btn", "btn-danger");
  deleteButton.style.marginLeft = "10px"; // CSSで管理
  deleteButton.addEventListener("click", async function () {
    // asyncキーワードを追加
    const googleEventId = event.extendedProps?.googleEventId;
    const localEventId = event.id || event.extendedProps?.id;
    // 確認ダイアログ
    if (!confirm("このイベントを削除してもよろしいですか？")) {
      return;
    }

    try {
      // イベントを削除
      event.remove();
      // 変更を保存
      saveEvents();
      // モーダルを閉じる
      hideModal(modal);
      // Google Calendar連携インスタンスがあり、認証済みの場合
      if (
        window.googleCalendarIntegration &&
        window.googleCalendarIntegration.authenticated &&
        typeof window.googleCalendarIntegration.deleteGoogleEvent === "function"
      ) {
        if (googleEventId) {
          try {
            console.log(
              `Google CalendarからイベントID: ${googleEventId} の削除を試みます。`
            );
            await window.googleCalendarIntegration.deleteGoogleEvent(
              googleEventId
            );
            window.googleCalendarIntegration.showSuccess(
              "Google Calendar上のイベントも削除しました。"
            );
          } catch (gcalError) {
            console.error(
              "Google Calendarからのイベント削除に失敗:",
              gcalError
            );
            window.googleCalendarIntegration.showError(
              "Google Calendar上のイベント削除に失敗しました。手動同期で整合性が取れる場合があります。"
            );
          }
        } else {
          console.log(
            `イベント (ローカルID: ${localEventId}) はGoogle Calendarと未同期か、Google Event IDが不明なため、Google Calendarからの削除はスキップします。`
          );
        }
      }
    } catch (error) {
      console.error("イベントの削除処理中にエラーが発生しました:", error);
      alert("イベントの削除に失敗しました。");
    }
  });
  buttonContainer.appendChild(deleteButton);

  // 日表示ボタン
  const viewDayButton = document.createElement("button");
  viewDayButton.textContent = "日表示で確認";
  viewDayButton.classList.add("btn", "btn-info");
  // viewDayButton.style.marginLeft = "10px"; // CSSで管理
  viewDayButton.addEventListener("click", function () {
    // 日表示に切り替え
    if (window.weddingCalendar) {
      window.weddingCalendar.changeView("timeGridDay", event.start);
      // モーダルを閉じる
      hideModal(modal);
    } else {
      console.error("カレンダーが初期化されていません");
    }
  });
  buttonContainer.appendChild(viewDayButton);

  modalBody.appendChild(buttonContainer);

  // モーダルを表示
  showModal(modal);
}

// 拡張イベントを編集する関数
function editEnhancedEvent(event) {
  // 拡張イベント編集モーダルを表示
  showEnhancedEventModal(true); // 編集モードフラグをtrueで渡す

  // フォームに現在の値を設定
  document.getElementById("enhanced-event-title").value = event.title;
  document.getElementById("enhanced-event-title-color").value =
    event.textColor || "";
  document.getElementById("enhanced-event-date").value = moment(
    event.start
  ).format("YYYY-MM-DD");
  document.getElementById("enhanced-event-time").value = moment(
    event.start
  ).format("HH:mm");

  // 所要時間の計算（分単位）
  const durationInMinutes =
    event.extendedProps && event.extendedProps.duration
      ? event.extendedProps.duration
      : moment(event.end).diff(moment(event.start), "minutes");
  document.getElementById("enhanced-event-duration").value = durationInMinutes;

  // 説明フィールドの設定
  if (event.extendedProps && event.extendedProps.description) {
    document.getElementById("enhanced-event-description").value =
      event.extendedProps.description;
  } else {
    document.getElementById("enhanced-event-description").value = "";
  }

  // カテゴリの設定
  if (event.extendedProps && event.extendedProps.category) {
    document.getElementById("enhanced-event-category").value =
      event.extendedProps.category;
  } else {
    document.getElementById("enhanced-event-category").value = "";
  }

  // 優先度の設定
  if (event.extendedProps && event.extendedProps.priority) {
    const priorityRadio = document.querySelector(
      `input[name="priority"][value="${event.extendedProps.priority}"]`
    );
    if (priorityRadio) {
      priorityRadio.checked = true;
    }
  }

  // 背景色の設定
  document.getElementById("enhanced-event-custom-color").value =
    event.backgroundColor || getPriorityColor("medium");

  // カスタム背景色を使用するかどうか
  const isPriorityColor =
    event.extendedProps &&
    event.extendedProps.priority &&
    event.backgroundColor === getPriorityColor(event.extendedProps.priority);
  document.getElementById("use-custom-background-color").checked =
    !isPriorityColor;

  // モーダルタイトルを変更
  const modalTitle = document.querySelector(
    "#enhanced-event-modal .modal-title"
  );
  if (modalTitle) {
    modalTitle.textContent = "イベントを編集";
  }

  // 拡張イベント保存ボタンのイベントリスナーを設定
  const saveButton = document.getElementById("save-enhanced-event");
  if (saveButton) {
    // 以前のイベントリスナーを削除
    const newSaveButton = saveButton.cloneNode(true);
    saveButton.parentNode.replaceChild(newSaveButton, saveButton);

    newSaveButton.addEventListener("click", function () {
      // 拡張イベントデータを収集
      const title = document.getElementById("enhanced-event-title").value;
      const titleColor = document.getElementById(
        "enhanced-event-title-color"
      ).value;
      const date = document.getElementById("enhanced-event-date").value;
      const time = document.getElementById("enhanced-event-time").value;
      const duration =
        document.getElementById("enhanced-event-duration").value || 60; // デフォルト60分
      const description = document.getElementById(
        "enhanced-event-description"
      ).value;
      const category = document.getElementById("enhanced-event-category").value;
      const priorityElem = document.querySelector(
        'input[name="priority"]:checked'
      );
      const priority = priorityElem ? priorityElem.value : "medium";

      // カスタム背景色の処理
      let backgroundColor;
      const useCustomBgColorCheckbox = document.getElementById(
        "use-custom-background-color"
      );
      const customBgColorInput = document.getElementById(
        "enhanced-event-custom-color"
      );

      if (
        useCustomBgColorCheckbox?.checked &&
        customBgColorInput?.value &&
        customBgColorInput.value !== getPriorityColor(priority || "medium")
      ) {
        backgroundColor = customBgColorInput.value;
      } else {
        backgroundColor = getPriorityColor(priority);
      }

      // バリデーション
      if (!title.trim()) {
        alert("タイトルを入力してください");
        return;
      }

      if (!date.trim() || !time.trim()) {
        alert("日付と時間を入力してください");
        return;
      }

      // 開始時間と終了時間の計算
      try {
        const start = moment(`${date} ${time}`).toDate();
        const end = moment(`${date} ${time}`)
          .add(parseInt(duration, 10), "minutes")
          .toDate();

        // イベントを更新
        event.setProp("title", title);
        event.setProp("backgroundColor", backgroundColor);
        event.setProp("textColor", titleColor || null);
        event.setStart(start);
        event.setEnd(end);

        // 拡張プロパティを更新
        event.setExtendedProp("isEnhanced", true);
        event.setExtendedProp("description", description);
        event.setExtendedProp("category", category);
        event.setExtendedProp("priority", priority);
        event.setExtendedProp("duration", duration);

        // 変更を保存
        saveEvents();

        // モーダルを閉じる
        hideEnhancedEventModal();

        // 保存後、イベントが編集された日付の日表示に移動
        if (window.weddingCalendar) {
          window.weddingCalendar.changeView("timeGridDay", start);
        }
      } catch (e) {
        console.error("日付処理エラー:", e);
        alert("日付と時間の形式が正しくありません");
      }
    });
  } else {
    console.error("保存ボタン要素が見つかりません");
  }
}

// 優先度に応じた色を返す関数
function getPriorityColor(priority) {
  switch (priority) {
    case "high":
      return "#ff7675"; // 赤
    case "medium":
      return "#fdcb6e"; // 黄
    case "low":
      return "#74b9ff"; // 青
    default:
      return "#fdcb6e"; // デフォルト：黄
  }
}

// 優先度のラベルを返す関数
function getPriorityLabel(priority) {
  switch (priority) {
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
      return "低";
    default:
      return "中";
  }
}

// モーダルを表示する関数
function showModal(modal) {
  if (modal) {
    modal.style.display = "block";
    modal.classList.add("show");
    document.body.classList.add("modal-open");

    // モーダル背景を作成（存在しない場合）
    let backdrop = document.querySelector(".modal-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.classList.add("modal-backdrop", "fade", "show");
      document.body.appendChild(backdrop);
    }
  }
}

// モーダルを非表示にする関数
function hideModal(modal) {
  if (modal) {
    modal.style.display = "none";
    modal.classList.remove("show");
    document.body.classList.remove("modal-open");

    // モーダル背景を削除
    const backdrop = document.querySelector(".modal-backdrop");
    if (backdrop) {
      backdrop.remove();
    }
  }
}

// 拡張イベントモーダルを表示する関数
function showEnhancedEventModal(isEditMode = false) {
  const modal = document.getElementById("enhanced-event-modal");
  if (modal) {
    // モーダルタイトルを設定
    const modalTitle = modal.querySelector(".modal-title");
    if (modalTitle) {
      modalTitle.textContent = isEditMode ? "イベントを編集" : "新しいイベント";
    }

    // モーダルを表示
    showModal(modal);
  }
}

// 拡張イベントモーダルを非表示にする関数
function hideEnhancedEventModal() {
  const modal = document.getElementById("enhanced-event-modal");
  if (modal) {
    hideModal(modal);
  }
}

// イベントをローカルストレージに保存する関数
function saveEvents() {
  if (window.weddingCalendar) {
    const events = window.weddingCalendar.getEvents().map((event) => {
      const serializedEvent = {
        // main.js と同様に extendedProps.id を優先
        id:
          event.extendedProps?.id ||
          (typeof generateEventId === "function"
            ? generateEventId()
            : `form_event_${Date.now()}`),
        title: event.title,
        start: event.start ? event.start.toISOString() : null,
        end: event.end ? event.end.toISOString() : null,
        allDay: event.allDay,
        backgroundColor: event.backgroundColor,
        textColor: event.textColor,
        display: event.display || "block",
        extendedProps: event.extendedProps || {},
      };
      if (!serializedEvent.extendedProps.id && serializedEvent.id)
        serializedEvent.extendedProps.id = serializedEvent.id; // 念のため同期
      return serializedEvent;
    });

    localStorage.setItem("calendarEvents", JSON.stringify(events)); // 保存先キーを calendarEvents に統一
    console.log("イベントが calendarEvents に保存されました");
  } else {
    console.error("カレンダーが初期化されていません");
  }
}
