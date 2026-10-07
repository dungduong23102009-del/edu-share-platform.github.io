import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { pdfFixture, docxFixture } from "./fixtures.mjs";
const validation = await import(
  new URL("../src/lib/documents/validation.ts", import.meta.url).href
);
const {
  validateMetadata,
  validateContent,
  sanitizeFilename,
  MAX_FILE_SIZE,
  PDF_MIME,
  DOCX_MIME,
} = validation;

test("only nonempty PDF/DOCX files up to 20 MiB with matching MIME are accepted", () => {
  assert.equal(
    validateMetadata({ name: "a.pdf", size: MAX_FILE_SIZE, type: PDF_MIME }),
    null,
  );
  assert.equal(
    validateMetadata({ name: "a.docx", size: 10, type: DOCX_MIME }),
    null,
  );
  for (const invalid of [
    { name: "a.txt", size: 1, type: "text/plain" },
    { name: "a.pdf", size: 0, type: PDF_MIME },
    { name: "a.pdf", size: MAX_FILE_SIZE + 1, type: PDF_MIME },
    { name: "a.pdf", size: 1, type: "text/html" },
  ])
    assert.ok(validateMetadata(invalid));
});
test("renaming content to PDF or DOCX does not bypass content validation", () => {
  assert.equal(validateContent("valid.pdf", pdfFixture()), null);
  assert.equal(validateContent("valid.docx", docxFixture()), null);
  assert.ok(validateContent("fake.pdf", strToU8("<html>secret</html>")));
  assert.ok(validateContent("fake.docx", pdfFixture()));
  assert.ok(
    validateContent("fake.pdf", strToU8("%PDF-1.4 without end marker")),
  );
  assert.ok(
    validateContent(
      "fake.docx",
      zipSync({ "readme.txt": strToU8("not a Word document") }),
    ),
  );
  assert.ok(
    validateContent(
      "fake.docx",
      zipSync({
        "[Content_Types].xml": strToU8("x".repeat(65537)),
        "word/document.xml": strToU8("x"),
      }),
    ),
  );
});
test("storage names contain no traversal segments, unicode separators or unsafe characters", () => {
  assert.equal(
    sanitizeFilename("Đề cương Vật lí 12.pdf"),
    "de-cuong-vat-li-12.pdf",
  );
  for (const name of [
    "../../secret.pdf",
    "\\evil\\file.docx",
    "💡.pdf",
    "a".repeat(300) + ".pdf",
  ]) {
    const safe = sanitizeFilename(name);
    assert.match(safe, /^[a-z0-9-]+\.(pdf|docx)$/);
    assert.ok(safe.length <= 105);
  }
});

test("callback origins preserve the local cookie host and ignore attacker hosts", async () => {
  const { applicationOrigin } = await import(
    new URL("../src/lib/supabase/origin.ts", import.meta.url).href
  );
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  try {
    process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3001";
    assert.equal(
      applicationOrigin(
        new Request("http://localhost:3001/auth/callback", {
          headers: { host: "127.0.0.1:3001" },
        }),
      ),
      "http://127.0.0.1:3001",
    );
    assert.equal(
      applicationOrigin(
        new Request("http://localhost:3001/auth/callback", {
          headers: { host: "localhost:3001" },
        }),
      ),
      "http://localhost:3001",
    );
    assert.equal(
      applicationOrigin(
        new Request("http://localhost:3001/auth/callback", {
          headers: {
            host: "attacker.example",
            "x-forwarded-host": "attacker.example",
          },
        }),
      ),
      "http://127.0.0.1:3001",
    );
    process.env.NEXT_PUBLIC_APP_URL = "https://study.example.org";
    assert.equal(
      applicationOrigin(
        new Request("http://localhost/auth/callback", {
          headers: { host: "attacker.example" },
        }),
      ),
      "https://study.example.org",
    );
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});
