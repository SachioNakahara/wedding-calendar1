// c:\Users\nakah\OneDrive\デスクトップ\NEW@schedule\frontend\sidebar.js
document.addEventListener("DOMContentLoaded", function () {
  const sidebar = document.querySelector(".sidebar");
  // サイドバー要素が見つからない場合は処理を中断
  if (!sidebar) {
    console.error("Sidebar element (.sidebar) not found.");
    return;
  }

  const toggleButton = document.createElement("button");
  toggleButton.classList.add("sidebar-toggle-button"); // CSSクラスでスタイルを適用
  toggleButton.innerHTML = '<i class="fas fa-chevron-left"></i>'; // 初期アイコン
  document.body.appendChild(toggleButton); // ボタンをbodyに追加

  let isSidebarCollapsed = false;

  // サイドバーの初期幅を取得（transform で隠すために必要）
  // getComputedStyle を使うと、CSSで定義された幅をより確実に取得できる場合がある
  let initialSidebarWidth = window.getComputedStyle(sidebar).width;
  // offsetWidth が 0 で、getComputedStyle でも '0px' や 'auto' の場合、
  // 固定値を設定するか、CSSで明示的な幅を指定することを検討
  if (
    sidebar.offsetWidth === 0 &&
    (initialSidebarWidth === "0px" || initialSidebarWidth === "auto")
  ) {
    console.warn(
      "Sidebar width could not be determined automatically. " +
        "Ensure it has a defined width in CSS or provide a fallback value. " +
        "Using a default fallback of 250px for transform."
    );
    initialSidebarWidth = "250px"; // 例: デフォルトの幅を設定
  } else if (sidebar.offsetWidth > 0) {
    initialSidebarWidth = sidebar.offsetWidth + "px"; // offsetWidthが取得できればそれを使う
  }
  // 'px' が含まれていない場合は追加（getComputedStyle対策）
  if (!initialSidebarWidth.endsWith("px")) {
    console.warn(
      "Initial sidebar width might not be in pixels. Ensure CSS width is set correctly."
    );
    // 必要に応じて数値部分だけ取り出して 'px' をつける処理を追加
  }

  function toggleSidebar() {
    // transformで隠す幅を再計算（ウィンドウリサイズ対応など）
    // ここでも getComputedStyle を使う方が良い場合がある
    const currentSidebarWidth =
      window.getComputedStyle(sidebar).width || initialSidebarWidth;

    isSidebarCollapsed = !isSidebarCollapsed;
    if (isSidebarCollapsed) {
      // サイドバーを格納（translateXで左に移動）
      sidebar.style.transform = `translateX(-${currentSidebarWidth})`;
      toggleButton.innerHTML = '<i class="fas fa-chevron-right"></i>'; // アイコン変更
    } else {
      // サイドバーを展開（translateXで元の位置に戻す）
      sidebar.style.transform = "translateX(0)";
      toggleButton.innerHTML = '<i class="fas fa-chevron-left"></i>'; // アイコン変更
    }
  }

  // ボタンクリックでサイドバーの表示/非表示を切り替え
  toggleButton.addEventListener("click", toggleSidebar);

  // --- ここから下にあった <style> タグ生成と追加のコードは削除 ---

  // 必要に応じて初期状態でサイドバーを非表示にする場合
  // 例: 初期状態で非表示にするならコメントを外す
  // isSidebarCollapsed = true; // 初期状態を格納済みに設定
  // sidebar.style.transform = `translateX(-${initialSidebarWidth})`;
  // toggleButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
});
