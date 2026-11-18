"use strict";

document.addEventListener("DOMContentLoaded", async () => {
    const loaded = await window.initializeTextContent();

    if (!loaded) {
        return;
    }

    // Preserve the compiler's existing click handler.
    const previousCompile = $("compile").onclick;

    $("compile").onclick = () => {
        if (typeof previousCompile === "function") {
            previousCompile();
        }

        updateGameLink();
    };

    // Preserve the decompiler's existing click handler.
    const previousDecode = $("decode").onclick;

    $("decode").onclick = () => {
        if (typeof previousDecode === "function") {
            previousDecode();
        }

        updateGameLink();
    };

    // Handle standalone game URLs.
    const route = parseGameRoute();

    if (route) {
        openGameRoute(route);
    } else {
        // The chess source is loaded before this runs.
        $("compile").click();
    }
});