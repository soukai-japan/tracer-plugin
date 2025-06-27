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
        logoDiv.innerHTML = `<img src="${chrome.runtime.getURL('icons/icon48.svg')}" style="width: 28px; height: 28px;">`;
        logoDiv.style.animation = 'jelly 0.5s ease';
        const style = document.createElement('style');
        style.textContent = `
            @keyframes jelly {
                0% {
                    transform: scale(0);
                }
                50% {
                    transform: scale(1.2);
                }
                100% {
                    transform: scale(1);
                }
            }
        `;
        document.head.appendChild(style);
        logoDiv.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document.mousedown from closing immediately
            const selectedText = window.getSelection().toString().trim();
            if (selectedText.length > 0) {
                if (chrome.runtime?.id) {
                chrome.runtime.sendMessage({ 
                        action: "openSaveWindow", 
                        text: selectedText, 
                        x: x, 
                        y: y 
                    }, (response) => {
                    let lastError = chrome.runtime.lastError
                    if (lastError) {
                        console.log(`Message send error: ${JSON.stringify(lastError)}`);
                    }
                    hideLogo();
                });
            } else {
                console.error('Extension context invalidated, cannot send message.');
                hideLogo();
            }
            }
        });
        document.body.appendChild(logoDiv);
    }
    const logoWidth = 16;
    const logoHeight = 16;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let left = x + 5;
    let top = y + 5;
    
    if (left + logoWidth > windowWidth) {
        left = windowWidth - logoWidth - 5;
    }
    if (top + logoHeight > windowHeight) {
        top = windowHeight - logoHeight - 5;
    }
    
    logoDiv.style.left = `${left}px`;
    logoDiv.style.top = `${top}px`;
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