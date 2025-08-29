async function getCurrentTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

async function collectFromPage() {
  const tabId = await getCurrentTabId();
  if (!tabId) return [];
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_FML_URLS", tabId }, (urls) => {
      resolve(urls || []);
    });
  });
}

function houseNameFromUrl(url) {
  try {
    const u = new URL(url);
    const pathname = u.pathname.split("/").filter(Boolean);
    const houseName = pathname[3] || "file";
    return houseName.endsWith(".fml") ? houseName : `${houseName}.fml`;
  } catch {
    return "file.fml";
  }
}

async function renderList(urls) {
  const ul = document.getElementById("list");
  ul.innerHTML = "";
  urls = [...new Set(urls)];

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tabs[0]?.url || "";
  const filename = houseNameFromUrl(tabUrl);

  for (const u of urls) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = u;
    a.textContent = filename;
    a.target = "_blank";

    const btn = document.createElement("button");
    btn.textContent = "Download";
    btn.addEventListener("click", () =>
      chrome.runtime.sendMessage({ type: "DOWNLOAD_ONE", url: u, filename })
    );

    li.appendChild(a);
    li.appendChild(document.createTextNode(" "));
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

document.getElementById("scan").addEventListener("click", async () => {
  setStatus("Aan het scannen...");
  const urls = await collectFromPage();
  const downloadAllBtn = document.getElementById("downloadAll");
  if (urls.length === 0) {
    setStatus("Geen bestanden gevonden.");
    document.getElementById("list").innerHTML = "";
    downloadAllBtn.disabled = true;
    return;
  }

  downloadAllBtn.disabled = false;

  if (urls.length === 1) {
    setStatus("1 bestand gevonden.");
  } else {
    setStatus(`${urls.length} bestanden gevonden`);
  }
  renderList(urls);
});

document.getElementById("downloadAll").addEventListener("click", async () => {
  setStatus("Start downloads...");
  const urls = await collectFromPage();

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tabs[0]?.url || "";
  const baseFilename = houseNameFromUrl(tabUrl).replace(/\.fml$/, "");

  const filenames = urls.map((u, i) =>
    urls.length === 1 ? `${baseFilename}.fml` : `${baseFilename}-${i + 1}.fml`
  );

  chrome.runtime.sendMessage({ type: "DOWNLOAD_FMLS", urls, filenames });

  setStatus(`${urls.length} downloads in de wachtrij gezet.`);
});
