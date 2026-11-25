// MMS Trial Balance Template (Typst BiDi)
//
// Rendered by the worker's Typst engine for the Accounting reports. The payload is
// validated by `typstTrialBalancePayloadSchema`; `lang`/`direction` arrive inside
// `data.json` exactly like the financial-ledger template, so an Arabic/Urdu/Farsi
// statement is shaped by HarfBuzz and laid out RTL instead of printing LTR.
#let doc_data = json("/data.json")
#let lang = doc_data.at("lang", default: "en")
#let is_rtl = doc_data.at("direction", default: "ltr") == "rtl"
#set page(
  paper: "a4",
  margin: (x: 1.4cm, y: 1.4cm),
  header: align(right)[
    #text(8pt, fill: luma(120))[ميزان المراجعة | Trial Balance]
  ],
  footer: [
    #align(center)[#text(8pt, fill: luma(100))[صفحة #counter(page).display()]]
  ]
)

#set text(
  font: ("Readex Pro", "Noto Nastaliq Urdu", "Geist", "Liberation Sans"),
  size: 8.5pt,
  lang: lang,
  dir: if is_rtl { rtl } else { ltr }
)

#let institution = doc_data.at("institution", default: "Madrasa Management System")
#let period = doc_data.at("period", default: "")
#let currency = doc_data.at("currency", default: "PKR")
#let sections = doc_data.at("sections", default: ())
#let total_debit = doc_data.at("totalDebit", default: "0.00")
#let total_credit = doc_data.at("totalCredit", default: "0.00")
#let prepared_by = doc_data.at("preparedBy", default: "")
#let generated_at = doc_data.at("generatedAt", default: "")
#let period_line = if period != "" { period + " | " } else { "" }

#align(center)[
  #text(15pt, weight: "bold", fill: rgb("#0f172a"))[#institution] \
  #text(11pt, weight: "medium", fill: rgb("#0f766e"))[ميزان المراجعة | Trial Balance] \
  #text(9pt, fill: rgb("#64748b"))[#period_line العملة: #currency]
]

#v(8pt)

// One table per section keeps the header repeatable and the totals row aligned.
#for section in sections [
  #text(10pt, weight: "bold", fill: rgb("#0f766e"))[#section.at("title", default: "")]
  #table(
    columns: (2.2fr, 1.6fr, 1.4fr, 1.4fr, 1.6fr),
    stroke: 0.5pt + rgb("#cbd5e1"),
    inset: 4.5pt,
    align: (col, row) => if col == 0 {
      if is_rtl { right } else { left }
    } else {
      center
    },
    table.header(
      [#text(fill: white, weight: "bold")[الحساب / Account]],
      [#text(fill: white, weight: "bold")[الرمز / Code]],
      [#text(fill: white, weight: "bold")[مدين / Debit]],
      [#text(fill: white, weight: "bold")[دائن / Credit]],
      [#text(fill: white, weight: "bold")[الرصيد / Balance]],
    ),
    ..for row in section.at("rows", default: ()) {
      (
        [#row.at("name", default: "-")],
        [#row.at("code", default: "-")],
        [#row.at("debit", default: "0.00")],
        [#row.at("credit", default: "0.00")],
        [#row.at("balance", default: "0.00")],
      )
    },
    (
      table.cell(colspan: 2, align: if is_rtl { left } else { right })[
        #text(weight: "bold")[#section.at("title", default: "") — المجموع]
      ],
      [#text(weight: "bold")[#section.at("totalDebit", default: "0.00")]],
      [#text(weight: "bold")[#section.at("totalCredit", default: "0.00")]],
      [],
    ),
  )
  #v(6pt)
]

#align(right)[
  #text(9.5pt, weight: "bold")[المجموع الكلي | Grand total: #total_debit / #total_credit]
]

#v(18pt)
#grid(
  columns: (1fr, 1fr),
  [#text(9pt)[أعدّه / Prepared by: #prepared_by]],
  [#align(right)[#text(9pt)[تاريخ الإنشاء / Generated: #generated_at]]],
)
