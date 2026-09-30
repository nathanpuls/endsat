import {ARROW_LEFT, COPY} from './lucide-icons.js';

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function markdownToHtml(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let paragraph = [];
    let listOpen = "";
    let blockquote = [];

    function getMarkdownTitle() {
        const firstContentLine = lines.find((line) => {
            const trimmed = line.trim();
            return trimmed && !/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed);
        });

        if (!firstContentLine) return "";

        const title = firstContentLine
            .trim()
            .replace(/^>\s?/, "")
            .replace(/^#{1,6}\s+/, "")
            .replace(/^[-*+]\s+/, "")
            .replace(/^\d+[.)]\s+/, "")
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, "$1")
            .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, "$1")
            .replace(/[*_`]/g, "")
            .replace(/\s*\|\s*/g, " ")
            .trim();

        return title;
    }

    function renderInline(value) {
        return escapeHtml(value)
            .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<img src="$2" alt="$1">')
            .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<a href="$2">$1</a>')
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/__([^_]+)__/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>")
            .replace(/_([^_]+)_/g, "<em>$1</em>")
            .replace(/`([^`]+)`/g, "<code>$1</code>");
    }

    function splitTableRow(line) {
        return line
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim());
    }

    function isTableSeparator(line) {
        return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
    }

    function isTableRow(line) {
        return line.trim().includes("|");
    }

    function flushParagraph() {
        if (!paragraph.length) return;
        html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
        paragraph = [];
    }

    function closeList() {
        if (!listOpen) return;
        html.push(`</${listOpen}>`);
        listOpen = "";
    }

    function flushBlockquote() {
        if (!blockquote.length) return;
        flushParagraph();
        closeList();
        const quoteHtml = markdownToHtml(blockquote.join("\n"))
            .match(/<article class="preview-content">\s*([\s\S]*?)\s*<\/article>/)?.[1]
            .trim() || renderInline(blockquote.join(" "));
        html.push(`<blockquote>${quoteHtml}</blockquote>`);
        blockquote = [];
    }

    function renderTable(startIndex) {
        const headers = splitTableRow(lines[startIndex]);
        let rowIndex = startIndex + 2;
        const rows = [];

        while (rowIndex < lines.length && isTableRow(lines[rowIndex].trim()) && lines[rowIndex].trim()) {
            rows.push(splitTableRow(lines[rowIndex]));
            rowIndex += 1;
        }

        html.push("<table>");
        html.push("<thead>");
        html.push(`<tr>${headers.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr>`);
        html.push("</thead>");

        if (rows.length) {
            html.push("<tbody>");
            for (const row of rows) {
                html.push(`<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`);
            }
            html.push("</tbody>");
        }

        html.push("</table>");
        return rowIndex - 1;
    }

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const trimmed = line.trim();

        if (!trimmed) {
            flushBlockquote();
            flushParagraph();
            closeList();
            continue;
        }

        const quote = trimmed.match(/^>\s?(.*)$/);
        if (quote) {
            blockquote.push(quote[1]);
            continue;
        }

        flushBlockquote();

        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            flushParagraph();
            closeList();
            html.push("<hr>");
            continue;
        }

        if (
            isTableRow(trimmed) &&
            index + 1 < lines.length &&
            isTableSeparator(lines[index + 1])
        ) {
            flushParagraph();
            closeList();
            index = renderTable(index);
            continue;
        }

        const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
            flushParagraph();
            closeList();
            const level = heading[1].length;
            html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
            continue;
        }

        const unorderedItem = trimmed.match(/^[-*+]\s+(.+)$/);
        if (unorderedItem) {
            flushParagraph();
            if (listOpen !== "ul") {
                closeList();
                html.push("<ul>");
                listOpen = "ul";
            }
            html.push(`<li>${renderInline(unorderedItem[1])}</li>`);
            continue;
        }

        const orderedItem = trimmed.match(/^\d+[.)]\s+(.+)$/);
        if (orderedItem) {
            flushParagraph();
            if (listOpen !== "ol") {
                closeList();
                html.push("<ol>");
                listOpen = "ol";
            }
            html.push(`<li>${renderInline(orderedItem[1])}</li>`);
            continue;
        }

        paragraph.push(trimmed);
    }

    flushBlockquote();
    flushParagraph();
    closeList();

    const documentTitle = escapeHtml(getMarkdownTitle());

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${documentTitle}</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      --accent: #6b7280;
      --accent-soft: #f3f4f6;
      --accent-border: #e5e7eb;
      --link-color: #111827;
      margin: 0;
      background: #ffffff;
      color: #111827;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    .preview-content {
      max-width: 720px;
      margin: 0 auto;
      padding: 64px 20px 80px;
      font-size: 16px;
      line-height: 1.72;
    }

    .preview-content h1,
    .preview-content h2,
    .preview-content h3,
    .preview-content h4 {
      margin: 36px 0 18px;
      font-weight: 650;
    }

    .preview-content h1 {
      font-size: 32px;
      font-weight: 700;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }

    .preview-content h2 {
      font-size: 24px;
      line-height: 1.25;
    }

    .preview-content h3 {
      font-size: 20px;
      line-height: 1.3;
    }

    .preview-content h4 {
      font-size: 18px;
      line-height: 1.35;
    }

    .preview-content > :first-child {
      margin-top: 0;
    }

    .preview-content p,
    .preview-content li {
      font-size: 17px;
      margin: 0 0 16px;
    }

    .preview-content ul,
    .preview-content ol {
      margin: 0 0 20px;
      padding-left: 1.5rem;
    }

    .preview-content a {
      color: var(--link-color);
      text-decoration: underline;
      text-decoration-color: var(--accent);
      text-decoration-thickness: 1px;
      text-underline-offset: 0.25em;
    }

    .preview-content blockquote {
      margin: 24px 0;
      padding: 0 0 0 16px;
      border-left: 3px solid var(--accent-border);
      color: #4b5563;
    }

    .preview-content blockquote p {
      margin-bottom: 0;
    }

    .preview-content code:not(pre code) {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.92em;
      background: var(--accent-soft);
      color: #111827;
      border-radius: 5px;
      padding: 0.2em 0.4em;
    }

    .preview-content pre {
      background: #f9fafb;
      border: 1px solid var(--accent-border);
      border-radius: 8px;
      padding: 1.25rem;
      margin: 1.5rem 0;
      overflow-x: auto;
    }

    .preview-content pre code {
      background: transparent;
      padding: 0;
      border-radius: 0;
      color: inherit;
      font-size: 0.9em;
      line-height: 1.6;
    }

    .preview-content img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 20px 0;
      border-radius: 12px;
    }

    .preview-content hr {
      border: 0;
      border-top: 1px solid var(--accent-border);
      margin: 36px 0;
    }

    .preview-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      font-size: 15px;
    }

    .preview-content th,
    .preview-content td {
      padding: 10px 12px;
      border: 1px solid #e5e7eb;
      text-align: left;
    }

    .preview-content th {
      background: var(--accent-soft);
      font-weight: 650;
    }
  </style>
</head>
<body>
  <article class="preview-content">
    ${html.join("\n    ")}
  </article>
</body>
</html>`;
}

function readerControls(html, source, backPath) {
    const css = `<style>
      .reader-header{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:4px max(12px,env(safe-area-inset-left));padding-top:max(4px,env(safe-area-inset-top));background:rgba(255,255,255,.96)}
      .reader-header button{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:0;border-radius:6px;background:transparent;color:#171717;cursor:pointer;touch-action:manipulation}
      .reader-header button:hover{background:#f5f5f5}.reader-header button:focus-visible{outline:2px solid #888;outline-offset:2px}.reader-header svg{width:20px;height:20px}
      .reader-copy{position:relative}.reader-feedback{position:absolute;right:0;top:48px;white-space:nowrap;font:13px system-ui,sans-serif;color:#555;background:#fff;padding:5px 8px;border:1px solid #eee;border-radius:5px;opacity:0;pointer-events:none}.reader-feedback.visible{opacity:1}
    </style>`;
    const controls = `<header class="reader-header" aria-label="Page controls"><button id="reader-back" type="button" aria-label="Back" title="Back">${ARROW_LEFT}</button><div class="reader-copy"><button id="reader-copy" type="button" aria-label="Copy source" title="Copy source">${COPY}</button><span id="reader-feedback" class="reader-feedback" role="status" aria-live="polite"></span></div></header>`;
    const data = JSON.stringify({source,backPath}).replace(/</g,'\\u003c');
    const script = `<script type="application/json" id="reader-source">${data}</script><script>
      (()=>{const {source,backPath}=JSON.parse(document.getElementById('reader-source').textContent);let feedbackTimer;
      document.getElementById('reader-back').onclick=()=>{if(history.length>1&&(document.referrer||window.navigation?.currentEntry?.index>0))history.back();else location.assign(backPath);};
      document.getElementById('reader-copy').onclick=async()=>{const feedback=document.getElementById('reader-feedback');let copied=false;
        try{await navigator.clipboard.writeText(source);copied=true;}catch{const field=document.createElement('textarea');field.value=source;field.setAttribute('readonly','');field.style.cssText='position:fixed;top:0;left:-9999px';document.body.append(field);field.select();field.setSelectionRange(0,field.value.length);try{copied=document.execCommand('copy');}catch{}field.remove();document.getElementById('reader-copy').focus({preventScroll:true});}
        clearTimeout(feedbackTimer);feedback.textContent=copied?'Copied':'Could not copy';feedback.classList.add('visible');feedbackTimer=setTimeout(()=>{feedback.classList.remove('visible');feedback.textContent='';},1600);
      };})();
    </script>`;
    return html.replace('</head>',css+'</head>').replace('<body>','<body>'+controls).replace('</body>',script+'</body>');
}

function getRenderableHtml(value, {backPath = '/projects'} = {}) {
    const trimmed = value.trim();
    const withoutCodeFence = trimmed
        .replace(/^```(?:html|markdown|md)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    if (/^<!doctype html/i.test(withoutCodeFence) || /^<html[\s>]/i.test(withoutCodeFence)) {
        return withoutCodeFence;
    }

    if (/<[a-z][a-z0-9-]*(?:\s[^>]*|\s*)>/i.test(withoutCodeFence)) {
        return withoutCodeFence;
    }

    return readerControls(markdownToHtml(withoutCodeFence), value, backPath);
}

function getRedirectUrl(value) {
    const trimmed = value.trim();

    if (!trimmed || /\s/.test(trimmed) || /[<>]/.test(trimmed)) {
        return "";
    }

    if (/^(mailto|tel|sms):/i.test(trimmed)) {
        return trimmed;
    }

    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
        return "";
    }

    if (/^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(\/.*)?$/i.test(trimmed)) {
        return `https://${trimmed}`;
    }

    return "";
}


export {escapeHtml, markdownToHtml, getRenderableHtml, getRedirectUrl};
