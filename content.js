let logoDiv = null;

document.addEventListener('mouseup', (event) => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText.length > 0) {
        showLogo(event.pageX, event.pageY);
    } else {
        hideLogo();
    }
});

document.addEventListener('mousedown', (event) => {
    if (logoDiv && !logoDiv.contains(event.target)) {
        hideLogo();
    }
});

function showLogo(x, y) {
    if (!logoDiv) {
        logoDiv = document.createElement('div');
        logoDiv.style.position = 'absolute';
        logoDiv.style.zIndex = '99999';
        logoDiv.style.cursor = 'pointer';
        logoDiv.innerHTML = `<img src="${chrome.runtime.getURL('icons/icon16.svg')}" style="width: 16px; height: 16px;">`;
        logoDiv.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document.mousedown from closing immediately
            const selectedText = window.getSelection().toString().trim();
            if (selectedText.length > 0) {
                if (chrome.runtime?.id) {
                    if (chrome.runtime?.id) {
                    chrome.runtime.sendMessage({ action: "openSaveWindow", text: selectedText }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('Message send error:', chrome.runtime.lastError);
                        }
                    });
                } else {
                    console.error('Extension context invalidated, cannot send message.');
                }
                } else {
                    console.error('Extension context invalidated, cannot send message.');
                }
                hideLogo();
            }
        });
        document.body.appendChild(logoDiv);
    }
    logoDiv.style.left = `${x + 5}px`;
    logoDiv.style.top = `${y + 5}px`;
    logoDiv.style.display = 'block';
}

function hideLogo() {
    if (logoDiv) {
        logoDiv.style.display = 'none';
    }
}

// Listen for messages from background script to close popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "closePopup") {
        hideLogo();
    }
});