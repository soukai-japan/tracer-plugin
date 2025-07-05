chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openSaveWindow") {
    chrome.windows.getCurrent((currentWindow) => {
      const popupWidth = 400;
      const popupHeight = 500;
      const left = currentWindow.left + (currentWindow.width - popupWidth) / 2;
      const top = currentWindow.top + (currentWindow.height - popupHeight) / 2;

      chrome.windows.create({
        url:
          chrome.runtime.getURL("popup.html") +
          `?text=${encodeURIComponent(request.text)}`,
        type: "popup",
        height: popupHeight,
        width: popupWidth,
        left: Math.max(0, left),
        top: Math.max(0, top),
      });
    });
  }
});

let db;

// Initialize IndexedDB for background script
function initDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("TracerDB", 1);

    request.onupgradeneeded = (event) => {
      db = event.target.result;
      db.createObjectStore("savedTexts", {
        keyPath: "id",
        autoIncrement: true,
      });
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve();
    };

    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.errorCode);
      reject(event.target.errorCode);
    };
  });
}

// Get all texts from IndexedDB
function getAllTexts() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject("IndexedDB not initialized");
      return;
    }
    const transaction = db.transaction(["savedTexts"], "readonly");
    const store = transaction.objectStore("savedTexts");
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = (event) => {
      console.error("Error getting all texts:", event.target.errorCode);
      reject(event.target.errorCode);
    };
  });
}

// Listen for navigation to the specific page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "clearSyncedData") {
    if (db) {
      const transaction = db.transaction(["savedTexts"], "readwrite");
      const store = transaction.objectStore("savedTexts");
      store.delete(request.id);
    }
  }
});

chrome.webNavigation.onCompleted.addListener(
  async (details) => {
    if (details.url.startsWith("https://soukai-japan.github.io/tracer/")) {
      console.log("Navigated to tracer page, attempting to sync IndexedDB.");
      try {
        await initDb();
        const savedData = await getAllTexts();
        console.log("Data from extension IndexedDB:", savedData);

        if (savedData.length > 0) {
          chrome.scripting.executeScript({
            target: { tabId: details.tabId },
            function: (data) => {
              // Function to run in the target page's context
              console.log("Attempting to sync data to page IndexedDB:", data);
              const pageDbRequest = indexedDB.open("soukaiJapanDatabase", 21);

              pageDbRequest.onupgradeneeded = (event) => {
                const pageDb = event.target.result;
                if (!pageDb.objectStoreNames.contains("words")) {
                  pageDb.createObjectStore("words", {
                    keyPath: "id",
                    autoIncrement: true,
                  });
                }
                // No need to create 'paragraphs' store if not handling it yet
              };

              pageDbRequest.onsuccess = (event) => {
                const pageDb = event.target.result;

                const wordItems = data.filter((item) => item.type === "word");
                const paragraphItems = data.filter(
                  (item) => item.type === "paragraph"
                );

                if (wordItems.length > 0) {
                  const wordTransaction = pageDb.transaction(
                    ["words"],
                    "readwrite"
                  );
                  const wordStore = wordTransaction.objectStore("words");

                  wordItems.forEach((item) => {
                    const wordData = {
                      writing: item.text,
                      reading: item.text, // Assuming reading is same as writing if not provided
                      chineseTranslation: "", // Placeholder, as it's not in original item
                      createdAt: item.timestamp,
                    };
                    const request = wordStore.add(wordData);
                    request.onerror = (e) => {
                      if (e.target.error.name === "ConstraintError") {
                        console.log("Word already exists, skipping:", item);
                      } else {
                        console.error(
                          "Error syncing word:",
                          e.target.error.message,
                          "Item:",
                          item
                        );
                      }
                    };
                    request.onsuccess = () => {
                      chrome.runtime.sendMessage({
                        action: "clearSyncedData",
                        id: item.id,
                      });
                    };
                  });
                  wordTransaction.oncomplete = () => {
                    console.log("Word data sync operation completed!");
                  };
                  wordTransaction.onerror = (e) => {
                    const error =
                      e?.target?.error || e || new Error("Unknown error");
                    console.error("Error during word sync transaction:", error);
                  };
                }
                if (paragraphItems.length > 0) {
                  console.log("Paragraph type not handled for sync:", item);
                }
                if (wordItems.length === 0 && paragraphItems.length === 0) {
                  console.log("No data to sync.");
                }
              };

              pageDbRequest.onerror = (event) => {
                console.error(
                  "Page IndexedDB error:",
                  event.target.error || event.target.errorCode
                );
              };
            },
            args: [savedData],
          });
        }
      } catch (error) {
        console.error("Error during IndexedDB sync process:", error);
      }
    }
  },
  { url: [{ urlMatches: "https://soukai-japan.github.io/tracer/.*" }] }
);
