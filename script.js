// 背景のみを回転させるアニメーション
document.addEventListener("DOMContentLoaded", function () {
    const background = document.querySelector(".background");
  
    // ゆっくりと回転するアニメーション
    setTimeout(() => {
      background.style.transition = "transform 20s ease-in-out";
      background.style.transform = "rotate(360deg)";
  
      // 継続的に回転するためのループ
      setInterval(() => {
        background.style.transition = "none";
        background.style.transform = "rotate(0deg)";
  
        setTimeout(() => {
          background.style.transition = "transform 20s ease-in-out";
          background.style.transform = "rotate(360deg)";
        }, 50);
      }, 20050);
    }, 1000);
  });