/**
 * Cole este código em: Planilha Google -> Extensões -> Apps Script
 * Depois clique em: Implantar -> Nova implantação -> App da Web
 * - Executar como: Eu (sua conta Google)
 * - Quem pode acessar: Qualquer pessoa
 * Copie a URL gerada e cole em config.js -> googleScriptUrl
 */

const SHEET_NAME = "Presentes";

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["id", "name", "sizes", "wishes", "avoid", "pin", "updated_at"]);
  }
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const entries = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0] && !row[1]) continue;

    let wishes = [];
    try {
      wishes = row[3] ? JSON.parse(row[3]) : [];
    } catch (err) {
      wishes = [];
    }

    entries.push({
      id: String(row[0] || ""),
      name: String(row[1] || ""),
      sizes: String(row[2] || ""),
      wishes: Array.isArray(wishes) ? wishes : [],
      avoid: String(row[4] || ""),
      pin: String(row[5] || ""),
      updated_at: String(row[6] || ""),
    });
  }

  entries.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return jsonResponse_({ ok: true, entries });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();

    if (body.action === "delete" && body.id) {
      const targetId = String(body.id);
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === targetId) {
          sheet.deleteRow(i + 1);
          return jsonResponse_({ ok: true, deleted: targetId });
        }
      }
      return jsonResponse_({ ok: false, error: "Registro não encontrado" });
    }

    if (body.action === "upsert" && body.entry) {
      const entry = body.entry;
      const id = entry.id ? String(entry.id) : Utilities.getUuid();
      const now = new Date().toISOString();
      const rowData = [
        id,
        String(entry.name || "").trim(),
        String(entry.sizes || "").trim(),
        JSON.stringify(Array.isArray(entry.wishes) ? entry.wishes : []),
        String(entry.avoid || "").trim(),
        String(entry.pin || "").trim(),
        now,
      ];

      let foundRow = -1;
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === id) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow > 0) {
        sheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }

      return jsonResponse_({
        ok: true,
        entry: {
          id,
          name: rowData[1],
          sizes: rowData[2],
          wishes: Array.isArray(entry.wishes) ? entry.wishes : [],
          avoid: rowData[4],
          pin: rowData[5],
          updated_at: now,
        },
      });
    }

    return jsonResponse_({ ok: false, error: "Ação inválida" });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
