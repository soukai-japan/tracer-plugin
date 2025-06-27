const selectedTextArea = document.getElementById('selectedText');
const saveButton = document.getElementById('saveButton');
const saveTypeSelect = document.getElementById('saveType');
const savedList = document.getElementById('savedList');
const savedHeader = document.querySelector('h3');

// 动态调整 textarea 高度
function adjustTextareaHeight() {
    selectedTextArea.style.height = 'auto';
    const maxHeight = 150; // 设置最大高度
    let newHeight = selectedTextArea.scrollHeight;
    newHeight = Math.min(newHeight, maxHeight);
    selectedTextArea.style.height = `${newHeight}px`;
}

// 初始化 textarea 高度
function initTextarea() {
    adjustTextareaHeight();
    selectedTextArea.addEventListener('input', adjustTextareaHeight);
}

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
        const type = saveTypeSelect.value;
        const request = store.add({ text: text, type: type, timestamp: new Date().toISOString() });

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
document.addEventListener('DOMContentLoaded', () => {
    initTextarea();
});

const urlParams = new URLSearchParams(window.location.search);
const textToSave = urlParams.get('text');
if (textToSave) {
    selectedTextArea.value = decodeURIComponent(textToSave);
    adjustTextareaHeight();
    savedList.style.display = 'none';
    savedHeader.style.display = 'none';
}

saveButton.addEventListener('click', async () => {
    const text = selectedTextArea.value.trim();
    if (text) {
        try {
            await initDb();
            await saveText(text);
            console.log(`Saved text in plugin: ${text}`);
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

// Get all saved texts from IndexedDB
function getAllSavedTexts() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['savedTexts'], 'readonly');
        const store = transaction.objectStore('savedTexts');
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = (event) => {
            console.error('Error getting saved texts:', event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

// Display saved texts in a list
async function displaySavedTexts() {
    try {
        const savedTexts = await getAllSavedTexts();
        const savedList = document.getElementById('savedList');
        savedList.innerHTML = '';
        
        savedTexts.forEach(textItem => {
            const listItem = document.createElement('li');
            const textNode = document.createTextNode(`${textItem.text} - ${new Date(textItem.timestamp).toLocaleString()}`);
            listItem.appendChild(textNode);
            savedList.appendChild(listItem);
        });
    } catch (error) {
        console.error('Error displaying saved texts:', error);
    }
}

// If opened as a popup, initialize DB and display saved texts
initDb().then(() => {
    if (!textToSave) {
        displaySavedTexts();
    }
});