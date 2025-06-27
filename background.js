chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openSaveWindow") {
        chrome.windows.create({
            url: chrome.runtime.getURL("popup.html") + `?text=${encodeURIComponent(request.text)}`,
            type: "popup",
            height: 200,
            width: 400
        });
    }
});

let db;

// Initialize IndexedDB for background script
function initDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('TracerDB', 1);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            db.createObjectStore('savedTexts', { keyPath: 'id', autoIncrement: true });
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve();
        };

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

// Get all texts from IndexedDB
function getAllTexts() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('IndexedDB not initialized');
            return;
        }
        const transaction = db.transaction(['savedTexts'], 'readonly');
        const store = transaction.objectStore('savedTexts');
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = (event) => {
            console.error('Error getting all texts:', event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

// Listen for navigation to the specific page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'clearSyncedData') {
        if (db) {
            const transaction = db.transaction(['savedTexts'], 'readwrite');
            const store = transaction.objectStore('savedTexts');
            store.delete(request.id);
        }
    }
});

chrome.webNavigation.onCompleted.addListener(async (details) => {
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
                        const pageDbRequest = indexedDB.open('TracerPageDB', 1);

                        pageDbRequest.onupgradeneeded = (event) => {
                            const pageDb = event.target.result;
                            pageDb.createObjectStore('syncedTexts', { keyPath: 'id', autoIncrement: true });
                        };

                        pageDbRequest.onsuccess = (event) => {
                            const pageDb = event.target.result;
                            const transaction = pageDb.transaction(['syncedTexts'], 'readwrite');
                            const store = transaction.objectStore('syncedTexts');

                            data.forEach((item) => {
                                const request = store.put(item);
                                request.onerror = (e) => {
                                    if (e.target.error.name === 'ConstraintError') {
                                        console.log('Item already exists, skipping:', item);
                                    } else {
                                        console.error('Error syncing item:', e.target.error.message, 'Item:', item);
                                    }
                                };
                                request.onsuccess = () => {
                                    // Notify the background script to clear the synced data
                                    chrome.runtime.sendMessage({
                                        action: 'clearSyncedData',
                                        id: item.id
                                    });
                                };
                            });

                            transaction.oncomplete = () => {
                                console.log('Data sync operation completed!');
                            };

                            transaction.onerror = (e) => {
                                const error = e?.target?.error || new Error('Unknown error');
                                console.error('Error during sync transaction:', error.message);
                            };
                        };

                        pageDbRequest.onerror = (event) => {
                            console.error('Page IndexedDB error:', event.target.errorCode);
                        };
                    },
                    args: [savedData]
                });
            }
        } catch (error) {
            console.error('Error during IndexedDB sync process:', error);
        }
    }
}, { url: [{ urlMatches: "https://soukai-japan.github.io/tracer/.*" }] });