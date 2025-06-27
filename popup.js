const selectedTextArea = document.getElementById('selectedText');
const saveButton = document.getElementById('saveButton');

let db;

// Initialize IndexedDB
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

// Save text to IndexedDB
function saveText(text) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['savedTexts'], 'readwrite');
        const store = transaction.objectStore('savedTexts');
        const request = store.add({ text: text, timestamp: new Date().toISOString() });

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = (event) => {
            console.error('Error saving text:', event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

// Get text from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const textToSave = urlParams.get('text');
if (textToSave) {
    selectedTextArea.value = decodeURIComponent(textToSave);
}

saveButton.addEventListener('click', async () => {
    const text = selectedTextArea.value.trim();
    if (text) {
        try {
            await initDb();
            await saveText(text);
            alert('文本已保存！');
            // Close the popup window after saving
            window.close();
            // Send message to content script to hide logo
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: "closePopup" });
            });
        } catch (error) {
            console.error('保存失败:', error);
            alert('保存失败，请查看控制台。');
        }
    } else {
        alert('请输入要保存的文本。');
    }
});

// If opened as a popup, initialize DB immediately
initDb();