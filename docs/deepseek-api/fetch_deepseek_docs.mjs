import fs from "node:fs/promises";
import path from "node:path";

const outDir = new URL("./snapshots/", import.meta.url);
const wrapWidth = 88;

const docs = [
  {
    slug: "thinking_mode",
    title: "思考模式",
    url: "https://api-docs.deepseek.com/zh-cn/guides/thinking_mode",
  },
  {
    slug: "multi_round_chat",
    title: "多轮对话",
    url: "https://api-docs.deepseek.com/zh-cn/guides/multi_round_chat",
  },
  {
    slug: "json_mode",
    title: "JSON Output",
    url: "https://api-docs.deepseek.com/zh-cn/guides/json_mode",
  },
  {
    slug: "tool_calls",
    title: "Tool Calls",
    url: "https://api-docs.deepseek.com/zh-cn/guides/tool_calls",
  },
  {
    slug: "kv_cache",
    title: "上下文硬盘缓存",
    url: "https://api-docs.deepseek.com/zh-cn/guides/kv_cache",
  },
  {
    slug: "create_chat_completion",
    title: "创建聊天补全",
    url: "https://api-docs.deepseek.com/zh-cn/api/create-chat-completion",
  },
  {
    slug: "list_models",
    title: "列出模型",
    url: "https://api-docs.deepseek.com/zh-cn/api/list-models",
  },
];

const blockTags = new Set([
  "article",
  "blockquote",
  "br",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "ol",
  "p",
  "pre",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

function entityDecode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html) {
  return entityDecode(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""))
    .replace(/\u0000/g, "");
}

function normalizeHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, "")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "");
}

function extractMarkdownRoot(html) {
  const openMatch = html.match(
    new RegExp(
      String.raw`<div\b[^>]*class=["'][^"']*` +
        String.raw`\btheme-doc-markdown\b[^"']*` +
        String.raw`\bmarkdown\b[^"']*["'][^>]*>`,
      "i",
    ),
  );
  if (!openMatch || openMatch.index === undefined) {
    throw new Error("markdown root element not found");
  }

  const start = openMatch.index;
  const openEnd = start + openMatch[0].length;
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = openEnd;

  let depth = 1;
  let match;
  while ((match = tagPattern.exec(html)) !== null) {
    if (match[0].startsWith("</")) {
      depth -= 1;
    } else {
      depth += 1;
    }
    if (depth === 0) {
      return html.slice(openEnd, match.index);
    }
  }

  throw new Error("markdown root closing div not found");
}

function codeLanguage(attrs) {
  const classMatch = attrs.match(/language-([a-z0-9_-]+)/i);
  return classMatch ? classMatch[1] : "";
}

function convertPreBlocks(html) {
  return html.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi, (_, attrs, body) => {
    const lang = codeLanguage(attrs);
    const code = stripTags(body).replace(/\n{3,}/g, "\n\n").trimEnd();
    return `\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
  });
}

function convertTables(html) {
  return html.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_, body) => {
    const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
      [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
        stripTags(cell[1]).replace(/\s+/g, " ").trim(),
      ),
    );
    if (rows.length === 0) {
      return "\n\n";
    }
    const columnCount = Math.max(...rows.map((row) => row.length));
    const normalizedRows = rows.map((row) => {
      const normalized = [...row];
      while (normalized.length < columnCount) {
        normalized.push("");
      }
      return normalized;
    });
    const sections = normalizedRows.map((row, rowIndex) => {
      const cells = row
        .map((cell, cellIndex) => `  - 列 ${cellIndex + 1}: ${cell}`)
        .join("\n");
      return `- 行 ${rowIndex + 1}:\n${cells}`;
    });
    return `\n\n表格：\n${sections.join("\n")}\n\n`;
  });
}

function convertHeadings(html) {
  return html.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, body) => {
    const text = stripTags(body).replace(/\s+/g, " ").trim();
    return `\n\n${"#".repeat(Number(level))} ${text}\n\n`;
  });
}

function convertLinks(html) {
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_, attrs, body) => {
    const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
    const text = stripTags(body).replace(/\s+/g, " ").trim();
    if (!href || !text || text === "​") {
      return text;
    }
    return text;
  });
}

function convertInline(html) {
  return html
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, body) => {
      const code = stripTags(body).replace(/`/g, "\\`");
      return `\`${code}\``;
    })
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");
}

function addBlockBreaks(html) {
  return html.replace(/<\/?([a-z0-9]+)\b[^>]*>/gi, (match, tag) => {
    const lower = tag.toLowerCase();
    if (lower === "li" && match.startsWith("<li")) {
      return "\n- ";
    }
    if (blockTags.has(lower)) {
      return "\n\n";
    }
    return "";
  });
}

function splitLongToken(token, width) {
  const chars = Array.from(token);
  const chunks = [];
  let current = "";
  for (const char of chars) {
    if (byteLength(current + char) > width && current) {
      chunks.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

function byteLength(text) {
  return Buffer.byteLength(text, "utf8");
}

function wrapText(text, width) {
  const tokens = text.split(/(\s+)/);
  const out = [];
  let current = "";

  function pushCurrent() {
    if (current) {
      out.push(current.trimEnd());
      current = "";
    }
  }

  for (const token of tokens) {
    if (!token) {
      continue;
    }

    if (/^\s+$/.test(token)) {
      if (current && byteLength(current + token) <= width) {
        current += token;
      }
      continue;
    }

    if (byteLength(token) > width) {
      pushCurrent();
      const chunks = splitLongToken(token, width);
      out.push(...chunks.slice(0, -1));
      current = chunks.at(-1) ?? "";
      continue;
    }

    if (!current) {
      current = token;
      continue;
    }

    if (byteLength(`${current} ${token}`) > width) {
      pushCurrent();
      current = token;
    } else {
      current += ` ${token}`;
    }
  }

  pushCurrent();
  return out.length > 0 ? out : [text];
}

function wrapLine(line, width = wrapWidth) {
  if (byteLength(line) <= width || line.startsWith("```")) {
    return line;
  }

  const bullet = line.match(/^(\s*(?:[-*]|\d+\.)\s+)(.*)$/);
  if (bullet) {
    const [, prefix, text] = bullet;
    const available = Math.max(20, width - prefix.length);
    const wrapped = wrapText(text, available);
    return wrapped
      .map((part, index) => {
        const currentPrefix = index === 0 ? prefix : " ".repeat(prefix.length);
        return `${currentPrefix}${part}`;
      })
      .join("\n");
  }

  const indent = line.match(/^(\s+)(.*)$/);
  if (indent) {
    const [, prefix, text] = indent;
    const available = Math.max(20, width - prefix.length);
    return wrapText(text, available)
      .map((part) => `${prefix}${part}`)
      .join("\n");
  }

  return wrapText(line, width).join("\n");
}

function wrapMarkdown(markdown) {
  const lines = markdown.split("\n");
  const out = [];
  let inFence = false;
  for (const line of lines) {
    if (line.startsWith("```")) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    out.push(wrapLine(line));
  }
  return out.join("\n").replace(/\n{4,}/g, "\n\n\n").trimEnd() + "\n";
}

function htmlToMarkdown(articleHtml, source) {
  let html = normalizeHtml(articleHtml);
  html = convertPreBlocks(html);
  html = convertTables(html);
  html = convertHeadings(html);
  html = convertLinks(html);
  html = convertInline(html);
  html = addBlockBreaks(html);
  let body = stripTags(html)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  body = body
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");

  const header = [
    "---",
    `title: "${source.title}"`,
    `source_url: "${source.url}"`,
    'retrieved_at: "2026-05-12"',
    "---",
    "",
  ].join("\n");

  return wrapMarkdown(header + body);
}

await fs.mkdir(outDir, { recursive: true });

for (const doc of docs) {
  const response = await fetch(doc.url);
  if (!response.ok) {
    throw new Error(`failed to fetch ${doc.url}: ${response.status}`);
  }
  const html = await response.text();
  const markdown = htmlToMarkdown(extractMarkdownRoot(html), doc);
  const filePath = path.join(outDir.pathname, `${doc.slug}.md`);
  await fs.writeFile(filePath, markdown, "utf8");
  console.log(`wrote ${filePath}`);
}
