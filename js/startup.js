"use strict";

document.addEventListener("DOMContentLoaded", async () => {
    const path = window.location.pathname;

    // Game routes should launch directly, without loading the editor.
    if (/^\/[01]\/[^/]+\/?$/.test(path)) {
        const route = parseGameRoute();

        if (route) {
            document.getElementById("studio").style.display = "none";
            document.querySelector(".site-header").style.display = "none";

            const player = document.getElementById("player-shell");
            player.style.display = "block";

            try {
                await openGameRoute(route);
            } catch (error) {
                console.error("Game loading failed:", error);

                document.getElementById("player-error").textContent =
                    "Unable to load game: " + error.message;
            }

            return;
        }
    }

    // Normal editor page.
    const loaded = await window.initializeTextContent();

    if (!loaded) return;

    const compileButton = document.getElementById("compile");

    if (compileButton) {
        const originalCompile = compileButton.onclick;

        compileButton.onclick = () => {
            if (typeof originalCompile === "function") {
                originalCompile();
            }

            if (typeof updateGameLink === "function") {
                updateGameLink();
            }

            if (typeof updateQRCode === "function") {
                updateQRCode();
            }
        };

        compileButton.click();
    }
});