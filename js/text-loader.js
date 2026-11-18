"use strict";

// ============================================================
// FILE LISTS
// ============================================================

const GUIDE_FILES = [
    "01-1-getting-started.txt",
    "02-2-variables-and-data-types.txt",
    "03-3-math-and-operators.txt",
    "04-4-functions-loops-and-recursion.txt",
    "05-5-sprite-sheets.txt",
    "06-6-palette-swapping-and-sprite-reuse.txt",
    "07-7-drawing-and-colors.txt",
    "08-8-touch-input-and-animation.txt",
    "09-9-built-in-functions.txt",
    "10-10-binary-compression.txt",
    "11-11-compiling-and-testing-games.txt"
];

const SPEC_FILES = Array.from(
    { length: 7 },
    (_, index) =>
        `12-specification-${String(index + 1).padStart(2, "0")}.txt`
);

const INTERFACE_FILES = [
    "14-editor-interface.txt",
    "15-output-and-preview.txt",
    "16-player-interface.txt"
];

const DEFAULT_GAME_FILE = "13-example-chess-source.txt";


// ============================================================
// FETCHING
// ============================================================

async function fetchText(filename) {
    const url = "/txt/" + filename;

    const response = await fetch(url, {
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(
            `Failed to fetch ${url}: HTTP ${response.status}`
        );
    }

    const content = await response.text();

    if (/^\s*<!doctype html/i.test(content)) {
        throw new Error(
            `${url} returned HTML instead of text.`
        );
    }

    console.log("Loaded:", filename);

    return content.replace(/\r\n?/g, "\n");
}


// ============================================================
// MARKDOWN
// ============================================================

function escapeHTML(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Convert the original extracted CODE EXAMPLE sections into
// fenced Markdown blocks. Existing Markdown fences are preserved.
function normalizeMarkdown(content) {
    const lines = content.split("\n");
    const result = [];

    let insideFence = false;
    let insideExample = false;

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const trimmed = line.trim();

        if (/^(```|~~~)/.test(trimmed)) {
            if (insideExample) {
                result.push("```");
                insideExample = false;
            }

            insideFence = !insideFence;
            result.push(line);
            continue;
        }

        if (!insideFence && /^CODE EXAMPLE:\s*$/i.test(trimmed)) {
            result.push("");
            result.push("```qg");
            insideExample = true;
            continue;
        }

        if (insideExample && trimmed === "") {
            // End the extracted example when a blank line
            // separates it from the following explanation.
            const nextLine = lines
                .slice(index + 1)
                .find(value => value.trim() !== "");

            if (nextLine !== undefined) {
                result.push("```");
                result.push("");
                insideExample = false;
                continue;
            }
        }

        result.push(line);
    }

    if (insideExample) {
        result.push("```");
    }

    return result.join("\n");
}

function renderMarkdown(element, content) {
    if (!element) {
        return;
    }

    const markdown = normalizeMarkdown(content);

    if (
        typeof marked === "undefined" ||
        typeof DOMPurify === "undefined"
    ) {
        // Safe fallback if the CDN scripts are unavailable.
        // It also preserves code blocks as readable text.
        element.textContent = markdown;
        element.style.whiteSpace = "pre-wrap";
        console.warn("Markdown libraries unavailable.");
        return;
    }

    const renderedHTML = marked.parse(markdown, {
        gfm: true,
        breaks: false
    });

    element.innerHTML = DOMPurify.sanitize(renderedHTML);

    element.style.whiteSpace = "normal";

    // Keep code indentation and allow horizontal scrolling.
    for (const pre of element.querySelectorAll("pre")) {
        pre.style.whiteSpace = "pre";
        pre.style.overflowX = "auto";
        pre.style.maxWidth = "100%";
        pre.style.padding = "14px";
    }
}


// ============================================================
// SECTION PARSING
// ============================================================

function parseSection(content, fallbackTitle) {
    const lines = content.split("\n");

    const firstIndex = lines.findIndex(
        line => line.trim() !== ""
    );

    if (firstIndex < 0) {
        return {
            title: fallbackTitle,
            body: ""
        };
    }

    const title = lines[firstIndex]
        .trim()
        .replace(/^#{1,6}\s+/, "");

    const body = lines
        .slice(firstIndex + 1)
        .join("\n")
        .trim();

    return {
        title: title || fallbackTitle,
        body
    };
}

function createSection(content, fallbackTitle, expanded = false) {
    const section = parseSection(content, fallbackTitle);

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const body = document.createElement("div");

    details.open = expanded;
    summary.textContent = section.title;

    body.className = "txt-content";
    body.style.padding = "14px";

    renderMarkdown(body, section.body);

    details.appendChild(summary);
    details.appendChild(body);

    return details;
}


// ============================================================
// HEADER
// ============================================================

async function loadHeader() {
    const content = await fetchText("00-header.txt");
    const lines = content
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);

    // Original extracted header contains the individual
    // labels and introductory description in this order.
    if (lines.length >= 8) {
        const brand = document.querySelector(".brand");

        if (brand) {
            brand.textContent = lines[0] + " ";

            const span = document.createElement("span");
            span.textContent = lines[1];

            brand.appendChild(span);
        }

        const navLinks = document.querySelectorAll(".topbar nav a");

        for (let index = 0; index < 3; index++) {
            if (navLinks[index]) {
                navLinks[index].textContent = lines[index + 2];
            }
        }

        const eyebrow = document.querySelector(".hero .eyebrow");
        const heading = document.querySelector(".hero h1");
        const description = document.querySelector(".hero p");

        if (eyebrow) eyebrow.textContent = lines[5];
        if (heading) heading.textContent = lines[6];

        if (description) {
            description.textContent = lines
                .slice(7)
                .join(" ");
        }
    }
}


// ============================================================
// LANGUAGE GUIDE
// ============================================================

async function loadLanguageGuide() {
    const files = await Promise.all(
        GUIDE_FILES.map(fetchText)
    );

    const container = $("guide-sections");

    if (!container) {
        throw new Error("Missing #guide-sections in index.html");
    }

    container.replaceChildren();

    // The introduction is already described in the header.
    // Show a short introduction in the guide as well.
    $("guide-intro").textContent =
        "QG is a compact programming language for browser games.";

    files.forEach((content, index) => {
        container.appendChild(
            createSection(
                content,
                `Guide ${index + 1}`,
                index === 0
            )
        );
    });
}


// ============================================================
// BINARY SPECIFICATION
// ============================================================

async function loadBinarySpecification() {
    const overview = await fetchText(
        "12-binary-specification-overview.txt"
    );

    renderMarkdown($("spec-intro"), overview);

    const files = await Promise.all(
        SPEC_FILES.map(fetchText)
    );

    const container = $("spec-sections");

    if (!container) {
        throw new Error("Missing #spec-sections in index.html");
    }

    container.replaceChildren();

    files.forEach((content, index) => {
        const details = createSection(
            content,
            `Specification ${index + 1}`,
            index === 0
        );

        if (index === 2) {
            const opcodeDisplay = document.createElement("pre");
            opcodeDisplay.id = "v2codes";

            details.querySelector(".txt-content")
                .appendChild(opcodeDisplay);
        }

        container.appendChild(details);
    });

    // Use the real opcode table from optimized-codec.js.
    const opcodeDisplay = $("v2codes");

    if (opcodeDisplay && typeof Q2_CODES !== "undefined") {
        opcodeDisplay.textContent = Object.entries(Q2_CODES)
            .map(([name, bits]) =>
                name.padEnd(10) +
                " " +
                bits +
                " (" +
                bits.length +
                " bits)"
            )
            .join("\n");
    }
}


// ============================================================
// INTERFACE LABELS
// ============================================================

function setLabel(selector, value) {
    const element = document.querySelector(selector);

    if (element && value) {
        element.textContent = value;
    }
}

async function loadInterfaceText() {
    const contents = await Promise.all(
        INTERFACE_FILES.map(fetchText)
    );

    const editorLabels = contents[0]
        .split("\n")
        .map(value => value.trim())
        .filter(Boolean);

    const outputLabels = contents[1]
        .split("\n")
        .map(value => value.trim())
        .filter(Boolean);

    const playerLabels = contents[2]
        .split("\n")
        .map(value => value.trim())
        .filter(Boolean);

    // Editor interface
    setLabel("#editor h2", editorLabels[0]);
    setLabel("#compile", editorLabels[1]);
    setLabel("#download", editorLabels[2]);
    setLabel("#copy", editorLabels[3]);
    setLabel("#copylink", editorLabels[4]);

    // Output interface: retain existing labels if the
    // extracted file does not have the expected format.
    if (outputLabels.length >= 6) {
        const headings = document.querySelectorAll(
            "#results h2, main > .grid section h2"
        );

        // Output labels are loaded and available, but the
        // established heading order remains unchanged.
        console.log("Output labels:", outputLabels);
    }

    // Player interface
    setLabel(".player-bar span", playerLabels[0]);
}


// ============================================================
// DEFAULT GAME
// ============================================================

function isEditorPage() {
    const path = window.location.pathname;

    return path === "/" || path === "/index.html";
}

async function loadDefaultGame() {
    const source = await fetchText(DEFAULT_GAME_FILE);
    const editor = $("source");

    if (!editor) {
        throw new Error("Missing #source in index.html");
    }

    if (isEditorPage() && !editor.value.trim()) {
        editor.value = source.trim();
    }
}


// ============================================================
// INITIALIZATION
// ============================================================

async function initializeTextContent() {
    const status = $("status");

    function updateStatus(message, error = false) {
        if (status) {
            status.textContent = message;
            status.classList.toggle("err", error);
        }

        if (error) {
            console.error(message);
        } else {
            console.log(message);
        }
    }

    try {
        updateStatus("Loading text files...");

        await Promise.all([
            loadHeader(),
            loadLanguageGuide(),
            loadBinarySpecification(),
            loadInterfaceText(),
            loadDefaultGame()
        ]);

        updateStatus("Text files loaded.");
        return true;

    } catch (error) {
        updateStatus(
            "Loading failed: " + error.message,
            true
        );

        console.error(error);
        return false;
    }
}

window.initializeTextContent = initializeTextContent;