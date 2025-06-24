// 空のサービスワーカー
// 将来的にオフライン機能やキャッシュ機能を追加する予定の場合に使用

console.log("Service Worker loaded");

// 基本的なイベントリスナー（何もしない）
self.addEventListener("install", function (event) {
  console.log("Service Worker: Install");
});

self.addEventListener("activate", function (event) {
  console.log("Service Worker: Activate");
});

self.addEventListener("fetch", function (event) {
  // 何もしない（通常のネットワークリクエストを通す）
});
