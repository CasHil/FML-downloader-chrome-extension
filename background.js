const MENU_DOWNLOAD_ALL = "fml-download-all";

const fmlUrls = {};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_DOWNLOAD_ALL,
    title: "Download all .fml files on page",
    contexts: ["page", "selection", "link"],
  });
});

chrome.webRequest.onCompleted.addListener(
  (details) => {
    console.log(
      "[FML] webRequest.onCompleted",
      details.url,
      "tabId:",
      details.tabId
    );
    if (/\.fml([?#].*)?$/i.test(details.url)) {
      const tabId = details.tabId;
      if (tabId < 0) {
        console.log(
          "[FML] Ignored .fml request not tied to a tab:",
          details.url
        );
        return;
      }
      if (!fmlUrls[tabId]) fmlUrls[tabId] = new Set();
      const match = details.url.match(/^(.*?\.fml)(?:[?#].*)?$/i);
      const cleanUrl = match ? match[1] : details.url;
      fmlUrls[tabId].add(cleanUrl);
      console.log(`[FML] Captured .fml for tab ${tabId}:`, cleanUrl);
    }
  },
  { urls: ["<all_urls>"] }
);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === MENU_DOWNLOAD_ALL) {
    if (tab && tab.id) {
      await chrome.tabs.sendMessage(tab.id, { type: "COLLECT_FMLS" });
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "DOWNLOAD_FMLS" && Array.isArray(msg.urls)) {
    downloadMany(msg.urls);
    sendResponse({ ok: true, total: msg.urls.length });
  }
  if (msg && msg.type === "DOWNLOAD_ONE" && typeof msg.url === "string") {
    downloadOne(msg.url, msg.filename);
    sendResponse({ ok: true });
  }
  if (msg && msg.type === "GET_FML_URLS") {
    const tabId = msg.tabId;
    const urls = tabId && fmlUrls[tabId] ? Array.from(fmlUrls[tabId]) : [];
    console.log(`[FML] GET_FML_URLS for tab ${tabId}:`, urls);
    sendResponse(urls);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") {
    if (fmlUrls[tabId]) {
      delete fmlUrls[tabId];
      console.log(
        `[FML] Cleared URLs for tab ${tabId} due to navigation/reload.`
      );
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (fmlUrls[tabId]) {
    delete fmlUrls[tabId];
    console.log(`[FML] Cleared URLs for tab ${tabId} due to tab close.`);
  }
});

async function downloadMany(urls) {
  for (const u of unique(urls)) {
    await downloadOne(u);
  }
}

function unique(arr) {
  return [...new Set(arr)];
}

async function downloadOne(url, filename) {
  try {
    await chrome.downloads.download({
      url,
      filename: filename || filenameFromUrl(url),
    });
  } catch (e) {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      await chrome.downloads.download({
        url: objectUrl,
        filename: filename || filenameFromUrl(url),
      });
      URL.revokeObjectURL(objectUrl);
    } catch (inner) {
      console.error("Het downloaden is niet gelukt.", url, inner);
    }
  }
}

function filenameFromUrl(url) {
  try {
    const u = new URL(url);
    const pathname = u.pathname.split("/").filter(Boolean);
    const houseName = pathname[3] || "file";
    return sanitizeFilename(
      houseName.endsWith(".fml") ? houseName : `${houseName}.fml`
    );
  } catch {
    return sanitizeFilename(`file-${Date.now()}.fml`);
  }
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_");
}
