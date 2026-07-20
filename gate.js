/* ============================================================
   Simple password gate for sehyoung.com
   NOTE: this is a light deterrent, not real security — the page
   content still loads in the browser. To change the password,
   edit the one line below.
   ============================================================ */
(function () {
  var PASSWORD = "sunday";   // <-- change the password here

  // Already unlocked this browser session? reveal and stop.
  if (sessionStorage.getItem("sehgate") === "1") {
    document.documentElement.classList.remove("gated");
    return;
  }

  function build() {
    var g = document.createElement("div");
    g.id = "seh-gate";
    g.innerHTML =
      '<div style="text-align:center;max-width:340px;width:100%;padding:24px">' +
        '<div style="font-weight:600;font-size:19px;letter-spacing:-.01em;color:#171512">Sehyoung Hamjong<span style="color:#e8501f">.</span></div>' +
        '<div style="font-family:Newsreader,Georgia,serif;font-style:italic;font-size:16px;color:#6b6862;margin:8px 0 24px">This portfolio is private.</div>' +
        '<input id="seh-pw" type="password" autocomplete="current-password" placeholder="Password" ' +
          'style="width:100%;padding:12px 14px;border:1px solid #cfc6b6;border-radius:8px;font-size:15px;box-sizing:border-box;font-family:inherit;background:#fff" />' +
        '<div id="seh-err" style="color:#e8501f;font-size:13px;height:18px;margin-top:8px"></div>' +
        '<button id="seh-go" ' +
          'style="width:100%;padding:12px;border:0;border-radius:8px;background:#171512;color:#faf9f6;font-weight:600;font-size:15px;cursor:pointer;font-family:inherit">Enter</button>' +
      "</div>";
    document.body.appendChild(g);

    var pw = document.getElementById("seh-pw");
    var err = document.getElementById("seh-err");

    function go() {
      if (pw.value === PASSWORD) {
        sessionStorage.setItem("sehgate", "1");
        document.documentElement.classList.remove("gated");
        g.parentNode.removeChild(g);
      } else {
        err.textContent = "Incorrect password";
        pw.value = "";
        pw.focus();
      }
    }
    document.getElementById("seh-go").addEventListener("click", go);
    pw.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    pw.focus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
