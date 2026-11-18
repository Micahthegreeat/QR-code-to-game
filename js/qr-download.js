"use strict";

let currentQRURL = "";

function getCompiledGameURL() {
    const link = document.getElementById("gameURL");

    if (!link) return null;

    const href = link.getAttribute("href");

    if (!href || href === "#") return null;

    return new URL(href, location.href).href;
}

function updateQRCode() {
    const canvas = document.getElementById("qr-canvas");
    const button = document.getElementById("downloadQR");
    const message = document.getElementById("qr-message");

    if (!canvas || !button || !message) return;

    button.disabled = true;
    canvas.hidden = true;
    currentQRURL = "";

    const url = getCompiledGameURL()?.toUpperCase();

    if (!url) {
        message.textContent = "Compile a game first.";
        return;
    }

    try {
        if (typeof qrcode !== "function") {
            throw new Error("QR library is not loaded.");
        }

        // Type 0 automatically chooses QR versions 1 through 40.
        // L is the lowest error correction level (~7%).
        const qr = qrcode(0, "L");

        qr.addData(url, "Alphanumeric");
        qr.make();

        const modules = qr.getModuleCount();
        const margin = 4;
        const scale = 8;

        canvas.width = (modules + margin * 2) * scale;
        canvas.height = canvas.width;

        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#000000";

        for (let row = 0; row < modules; row++) {
            for (let col = 0; col < modules; col++) {
                if (qr.isDark(row, col)) {
                    ctx.fillRect(
                        (col + margin) * scale,
                        (row + margin) * scale,
                        scale,
                        scale
                    );
                }
            }
        }

        const version = (modules - 17) / 4;

        const set = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };

        set("qr-version", `${version} / 40`);
        set("qr-dimensions", `${modules} × ${modules}`);
        set("qr-characters", url.length);
        set("qr-encoding", "Alphanumeric");

        canvas.hidden = false;
        button.disabled = false;
        message.textContent = "";
        currentQRURL = url;

        console.log(`QR generated: version ${version}, error correction L`);

    } catch (error) {
        console.error("QR generation error:", error);
        message.textContent = "QR generation failed: " + error.message;
    }
}

function downloadQRCode() {
    const canvas = document.getElementById("qr-canvas");

    if (!canvas || !currentQRURL) return;

    const link = document.createElement("a");

    link.href = canvas.toDataURL("image/png");
    link.download = "qg-game-qr.png";

    document.body.appendChild(link);
    link.click();
    link.remove();
}

function initializeQRCode() {
    const button = document.getElementById("downloadQR");
    const gameLink = document.getElementById("gameURL");

    if (button) {
        button.addEventListener("click", downloadQRCode);
    }

    if (gameLink) {
        new MutationObserver(updateQRCode).observe(gameLink, {
            attributes: true,
            attributeFilter: ["href"]
        });
    }

    updateQRCode();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeQRCode);
} else {
    initializeQRCode();
}