const BTN_CLASS = "fml-dl-btn";

function isFmlLink(a) {
  if (!a || !a.href) return false;
  try {
    const url = new URL(a.href, location.href);
    return url.pathname.toLowerCase().endsWith(".fml");
  } catch {
    return false;
  }
}

function addButton(a) {
  if (a.dataset.fmlDecorated) return;
  a.dataset.fmlDecorated = "1";

  const btn = document.createElement("button");
  btn.textContent = "Download .fml";
  btn.className = BTN_CLASS;
  btn.style.marginLeft = "8px";
  btn.style.padding = "2px 6px";
  btn.style.fontSize = "12px";
  btn.style.cursor = "pointer";

  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const url = new URL(a.href, location.href).href;
    chrome.runtime.sendMessage({ type: "DOWNLOAD_ONE", url });
  });

  a.insertAdjacentElement("afterend", btn);
}

function scan() {
  const anchors = document.querySelectorAll("a[href]");
  for (const a of anchors) {
    if (isFmlLink(a)) addButton(a);
  }
}

const obs = new MutationObserver(() => scan());
obs.observe(document.documentElement, { childList: true, subtree: true });

scan();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "COLLECT_FMLS") {
    const anchors = Array.from(document.querySelectorAll("a[href]"));
    const urls = anchors
      .filter(isFmlLink)
      .map((a) => new URL(a.href, location.href).href);
    chrome.runtime.sendMessage({ type: "DOWNLOAD_FMLS", urls });
    sendResponse({ ok: true, found: urls.length });
  }
});

const style = document.createElement("style");
style.textContent = `
.${BTN_CLASS} {
border: 1px solid rgba(0,0,0,.2);
background: rgba(255,255,255,.9);
border-radius: 4px;
}
.${BTN_CLASS}:hover { filter: brightness(0.95) }
`;
document.documentElement.appendChild(style);
